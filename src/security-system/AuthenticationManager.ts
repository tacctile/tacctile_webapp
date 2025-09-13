import { app } from 'electron';
import { EventEmitter } from 'events';
import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as keytar from 'keytar';
import * as os from 'os';
import {
  User,
  UserSession,
  AuthenticationCredentials,
  AuthenticationResult,
  AuthenticationError,
  AuthErrorCode,
  DeviceInfo,
  SecurityPolicy,
  SecurityAuditLog,
  SecurityEvent,
  OfflineAuthData,
  SecurityManagerEvents
} from './types';
import { SessionManager } from './SessionManager';
import { LicenseValidator } from './LicenseValidator';
import { EncryptionManager } from './EncryptionManager';
import { AuditLogger } from './AuditLogger';

export class AuthenticationManager extends EventEmitter {
  private sessionManager: SessionManager;
  private licenseValidator: LicenseValidator;
  private encryptionManager: EncryptionManager;
  private auditLogger: AuditLogger;
  private securityPolicy: SecurityPolicy;
  private usersPath: string;
  private offlineAuthPath: string;
  private users: Map<string, User> = new Map();
  private offlineAuthData: Map<string, OfflineAuthData> = new Map();
  private rateLimiter: Map<string, { attempts: number; resetTime: number }> = new Map();

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.usersPath = path.join(userDataPath, 'users.encrypted');
    this.offlineAuthPath = path.join(userDataPath, 'offline-auth.encrypted');
    
    this.sessionManager = new SessionManager();
    this.licenseValidator = new LicenseValidator();
    this.encryptionManager = new EncryptionManager();
    this.auditLogger = new AuditLogger();
    
    this.initializeSecurityPolicy();
    this.setupEventListeners();
  }

  public async initialize(): Promise<void> {
    try {
      await this.sessionManager.initialize();
      await this.licenseValidator.initialize();
      await this.encryptionManager.initialize();
      await this.auditLogger.initialize();
      
      await this.loadUsers();
      await this.loadOfflineAuthData();
      await this.createDefaultAdminUser();
      
      console.log('AuthenticationManager initialized successfully');
      await this.auditLogger.log('system', 'authentication_system_started', 'success');
    } catch (error) {
      console.error('Failed to initialize AuthenticationManager:', error);
      throw error;
    }
  }

  public async authenticate(credentials: AuthenticationCredentials): Promise<AuthenticationResult> {
    const startTime = Date.now();
    const ipAddress = this.getCurrentIPAddress();
    
    try {
      // Rate limiting check
      const rateLimitResult = this.checkRateLimit(credentials.username, ipAddress);
      if (!rateLimitResult.allowed) {
        const error: AuthenticationError = {
          code: 'RATE_LIMITED',
          message: 'Too many failed attempts. Please try again later.',
          remainingAttempts: 0,
          lockoutDuration: rateLimitResult.resetTime - Date.now()
        };

        await this.auditLogger.log(
          'login_failed',
          credentials.username,
          'blocked',
          { reason: 'rate_limited', ip: ipAddress }
        );

        return { success: false, error };
      }

      // Get user
      const user = await this.getUserByUsername(credentials.username);
      if (!user) {
        this.recordFailedAttempt(credentials.username, ipAddress);
        const error: AuthenticationError = {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        };

        await this.auditLogger.log(
          'login_failed',
          credentials.username,
          'failure',
          { reason: 'invalid_username', ip: ipAddress }
        );

        return { success: false, error };
      }

      // Check account status
      const accountCheck = this.checkAccountStatus(user);
      if (!accountCheck.allowed) {
        await this.auditLogger.log(
          'login_failed',
          user.id,
          'blocked',
          { reason: accountCheck.reason, ip: ipAddress }
        );

        return { success: false, error: accountCheck.error };
      }

      // Verify password
      const passwordValid = await this.verifyPassword(credentials.password, user);
      if (!passwordValid) {
        await this.recordFailedLogin(user);
        this.recordFailedAttempt(credentials.username, ipAddress);

        const error: AuthenticationError = {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
          remainingAttempts: this.securityPolicy.passwordPolicy.lockoutAttempts - user.failedLoginAttempts
        };

        await this.auditLogger.log(
          'login_failed',
          user.id,
          'failure',
          { reason: 'invalid_password', ip: ipAddress }
        );

        return { success: false, error };
      }

      // Check license
      const licenseValid = await this.licenseValidator.validateUserLicense(user.id);
      if (!licenseValid) {
        const error: AuthenticationError = {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Invalid or expired license'
        };

        await this.auditLogger.log(
          'login_failed',
          user.id,
          'blocked',
          { reason: 'invalid_license', ip: ipAddress }
        );

        return { success: false, error };
      }

      // Check MFA requirement
      if (this.requiresMFA(user) && !credentials.mfaCode) {
        const mfaChallenge = await this.createMFAChallenge(user);
        
        await this.auditLogger.log(
          'mfa_required',
          user.id,
          'success',
          { challenge_id: mfaChallenge.challengeId, ip: ipAddress }
        );

        return {
          success: false,
          requiresMFA: true,
          mfaChallenge
        };
      }

      // Verify MFA if provided
      if (credentials.mfaCode) {
        const mfaValid = await this.verifyMFA(user, credentials.mfaCode);
        if (!mfaValid) {
          const error: AuthenticationError = {
            code: 'MFA_INVALID',
            message: 'Invalid MFA code'
          };

          await this.auditLogger.log(
            'login_failed',
            user.id,
            'failure',
            { reason: 'invalid_mfa', ip: ipAddress }
          );

          return { success: false, error };
        }
      }

      // Device verification
      const deviceResult = await this.verifyDevice(credentials, user);
      if (!deviceResult.allowed) {
        await this.auditLogger.log(
          'login_failed',
          user.id,
          'blocked',
          { reason: 'device_not_authorized', device_id: credentials.deviceId, ip: ipAddress }
        );

        return { success: false, error: deviceResult.error };
      }

      // Create session
      const session = await this.sessionManager.createSession(user, deviceResult.deviceInfo, ipAddress);
      if (!session) {
        const error: AuthenticationError = {
          code: 'UNKNOWN_ERROR',
          message: 'Failed to create session'
        };
        return { success: false, error };
      }

      // Generate tokens
      const token = this.generateAccessToken(user, session);
      const refreshToken = this.generateRefreshToken(session);

      // Update user login info
      await this.updateLastLogin(user);

      // Reset failed attempts
      this.clearRateLimit(credentials.username);
      await this.clearFailedAttempts(user);

      // Store offline auth data for this user
      await this.updateOfflineAuthData(user, deviceResult.deviceInfo);

      await this.auditLogger.log(
        'login',
        user.id,
        'success',
        {
          session_id: session.id,
          device_id: session.deviceId,
          ip: ipAddress,
          duration: Date.now() - startTime
        }
      );

      this.emit('user-authenticated', user, session);

      return {
        success: true,
        user,
        session,
        token,
        refreshToken
      };

    } catch (error) {
      console.error('Authentication error:', error);
      
      await this.auditLogger.log(
        'login_failed',
        credentials.username,
        'failure',
        { reason: 'system_error', error: error.message, ip: ipAddress }
      );

      const authError: AuthenticationError = {
        code: 'UNKNOWN_ERROR',
        message: 'Authentication failed due to system error'
      };
      
      return { success: false, error: authError };
    }
  }

  public async authenticateOffline(credentials: AuthenticationCredentials): Promise<AuthenticationResult> {
    try {
      const offlineData = this.offlineAuthData.get(credentials.username);
      if (!offlineData) {
        const error: AuthenticationError = {
          code: 'INVALID_CREDENTIALS',
          message: 'No offline authentication data available'
        };
        return { success: false, error };
      }

      // Check if offline auth is still valid
      if (Date.now() > offlineData.validUntil.getTime()) {
        const error: AuthenticationError = {
          code: 'SESSION_EXPIRED',
          message: 'Offline authentication data has expired'
        };
        return { success: false, error };
      }

      // Verify device fingerprint
      const currentFingerprint = await this.generateDeviceFingerprint();
      if (currentFingerprint !== offlineData.deviceFingerprint) {
        const error: AuthenticationError = {
          code: 'DEVICE_NOT_AUTHORIZED',
          message: 'Device not authorized for offline access'
        };
        return { success: false, error };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(credentials.password, offlineData.passwordHash);
      if (!passwordValid) {
        const error: AuthenticationError = {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials'
        };
        return { success: false, error };
      }

      // Create offline user object
      const user: Partial<User> = {
        id: offlineData.userId,
        username: offlineData.username,
        permissions: offlineData.permissions,
        isActive: true,
        lastLogin: new Date()
      };

      // Create offline session
      const session: Partial<UserSession> = {
        id: crypto.randomUUID(),
        userId: offlineData.userId,
        deviceId: currentFingerprint,
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
        isActive: true,
        permissions: offlineData.permissions
      };

      console.log('Offline authentication successful');
      
      return {
        success: true,
        user: user as User,
        session: session as UserSession,
        token: 'offline-token',
        refreshToken: 'offline-refresh-token'
      };

    } catch (error) {
      console.error('Offline authentication error:', error);
      
      const authError: AuthenticationError = {
        code: 'UNKNOWN_ERROR',
        message: 'Offline authentication failed'
      };
      
      return { success: false, error: authError };
    }
  }

  public async logout(sessionId: string): Promise<boolean> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (session) {
        await this.sessionManager.invalidateSession(sessionId);
        
        await this.auditLogger.log(
          'logout',
          session.userId,
          'success',
          { session_id: sessionId }
        );

        this.emit('user-logout', session.userId, sessionId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return false;
      }

      // Verify current password
      const currentValid = await this.verifyPassword(currentPassword, user);
      if (!currentValid) {
        await this.auditLogger.log(
          'password_changed',
          userId,
          'failure',
          { reason: 'invalid_current_password' }
        );
        return false;
      }

      // Validate new password
      const validation = this.validatePassword(newPassword);
      if (!validation.valid) {
        return false;
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user
      user.securitySettings.passwordLastChanged = new Date();
      user.securitySettings.requirePasswordChange = false;
      user.updatedAt = new Date();

      // Store the password securely using keytar
      await keytar.setPassword('ghost-hunter-toolbox', `user-${userId}`, hashedPassword);

      await this.saveUsers();

      await this.auditLogger.log(
        'password_changed',
        userId,
        'success',
        { password_strength: validation.strength }
      );

      return true;
    } catch (error) {
      console.error('Password change error:', error);
      return false;
    }
  }

  public async createUser(userData: Partial<User>, initialPassword: string): Promise<User | null> {
    try {
      const userId = crypto.randomUUID();
      const now = new Date();

      // Validate password
      const passwordValidation = this.validatePassword(initialPassword);
      if (!passwordValidation.valid) {
        throw new Error('Password does not meet security requirements');
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(initialPassword, salt);

      const user: User = {
        id: userId,
        username: userData.username!,
        email: userData.email!,
        role: userData.role || 'viewer',
        permissions: userData.permissions || this.getDefaultPermissions(userData.role || 'viewer'),
        profile: userData.profile || {
          firstName: '',
          lastName: '',
          timezone: 'UTC',
          language: 'en'
        },
        securitySettings: {
          mfaEnabled: false,
          mfaMethod: 'none',
          passwordLastChanged: now,
          sessionTimeout: this.securityPolicy.sessionPolicy.maxDuration,
          ipWhitelist: [],
          allowedDevices: [],
          requirePasswordChange: false,
          accountLocked: false
        },
        createdAt: now,
        updatedAt: now,
        lastLogin: null,
        isActive: true,
        isVerified: false,
        failedLoginAttempts: 0,
        lockedUntil: null
      };

      // Store password securely
      await keytar.setPassword('ghost-hunter-toolbox', `user-${userId}`, hashedPassword);

      this.users.set(userId, user);
      await this.saveUsers();

      await this.auditLogger.log(
        'user_created',
        userId,
        'success',
        { username: user.username, role: user.role }
      );

      return user;
    } catch (error) {
      console.error('User creation error:', error);
      return null;
    }
  }

  public async validateSession(token: string): Promise<User | null> {
    try {
      const decoded = this.verifyAccessToken(token);
      if (!decoded) {
        return null;
      }

      const session = await this.sessionManager.getSession(decoded.sessionId);
      if (!session || !session.isActive) {
        return null;
      }

      const user = this.users.get(session.userId);
      if (!user || !user.isActive) {
        return null;
      }

      // Update last activity
      await this.sessionManager.updateLastActivity(session.id);

      return user;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  public async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  private async verifyPassword(password: string, user: User): Promise<boolean> {
    try {
      // Get stored password hash from keytar
      const storedHash = await keytar.getPassword('ghost-hunter-toolbox', `user-${user.id}`);
      if (!storedHash) {
        return false;
      }

      // Use bcrypt for comparison
      return await bcrypt.compare(password, storedHash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  private validatePassword(password: string): { valid: boolean; strength: number; issues: string[] } {
    const policy = this.securityPolicy.passwordPolicy;
    const issues: string[] = [];
    let strength = 0;

    if (password.length < policy.minLength) {
      issues.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (password.length > policy.maxLength) {
      issues.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      issues.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      strength += 20;
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      issues.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      strength += 20;
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      issues.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      strength += 20;
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      issues.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      strength += 20;
    }

    // Additional strength factors
    if (password.length >= 12) strength += 10;
    if (password.length >= 16) strength += 10;

    return {
      valid: issues.length === 0,
      strength: Math.min(strength, 100),
      issues
    };
  }

  private checkAccountStatus(user: User): { allowed: boolean; error?: AuthenticationError; reason?: string } {
    if (!user.isActive) {
      return {
        allowed: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Account has been disabled'
        },
        reason: 'account_disabled'
      };
    }

    if (user.lockedUntil && Date.now() < user.lockedUntil.getTime()) {
      return {
        allowed: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked',
          lockoutDuration: user.lockedUntil.getTime() - Date.now()
        },
        reason: 'account_locked'
      };
    }

    return { allowed: true };
  }

  private checkRateLimit(username: string, ipAddress: string): { allowed: boolean; resetTime: number } {
    const key = `${username}:${ipAddress}`;
    const limit = this.rateLimiter.get(key);

    if (!limit) {
      return { allowed: true, resetTime: 0 };
    }

    if (Date.now() > limit.resetTime) {
      this.rateLimiter.delete(key);
      return { allowed: true, resetTime: 0 };
    }

    return {
      allowed: limit.attempts < this.securityPolicy.passwordPolicy.lockoutAttempts,
      resetTime: limit.resetTime
    };
  }

  private recordFailedAttempt(username: string, ipAddress: string): void {
    const key = `${username}:${ipAddress}`;
    const limit = this.rateLimiter.get(key);

    if (limit) {
      limit.attempts++;
    } else {
      this.rateLimiter.set(key, {
        attempts: 1,
        resetTime: Date.now() + (this.securityPolicy.passwordPolicy.lockoutDuration * 60 * 1000)
      });
    }
  }

  private clearRateLimit(username: string): void {
    // Clear rate limits for this username
    for (const [key] of this.rateLimiter) {
      if (key.startsWith(username + ':')) {
        this.rateLimiter.delete(key);
      }
    }
  }

  private async recordFailedLogin(user: User): Promise<void> {
    user.failedLoginAttempts++;
    user.updatedAt = new Date();

    if (user.failedLoginAttempts >= this.securityPolicy.passwordPolicy.lockoutAttempts) {
      user.lockedUntil = new Date(Date.now() + (this.securityPolicy.passwordPolicy.lockoutDuration * 60 * 1000));
      user.securitySettings.accountLocked = true;
    }

    await this.saveUsers();
  }

  private async clearFailedAttempts(user: User): Promise<void> {
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.securitySettings.accountLocked = false;
    user.updatedAt = new Date();
    await this.saveUsers();
  }

  private async updateLastLogin(user: User): Promise<void> {
    user.lastLogin = new Date();
    user.updatedAt = new Date();
    await this.saveUsers();
  }

  private requiresMFA(user: User): boolean {
    const policy = this.securityPolicy.mfaPolicy;
    
    if (!policy.required) {
      return user.securitySettings.mfaEnabled;
    }

    if (policy.requiredForRoles.length > 0) {
      return policy.requiredForRoles.includes(user.role) || user.securitySettings.mfaEnabled;
    }

    return user.securitySettings.mfaEnabled;
  }

  private async createMFAChallenge(user: User): Promise<any> {
    // MFA challenge implementation would go here
    // For now, return a mock challenge
    return {
      challengeId: crypto.randomUUID(),
      method: user.securitySettings.mfaMethod,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };
  }

  private async verifyMFA(user: User, code: string): Promise<boolean> {
    // MFA verification implementation would go here
    // For now, return true for any 6-digit code
    return /^\d{6}$/.test(code);
  }

  private async verifyDevice(credentials: AuthenticationCredentials, user: User): Promise<{
    allowed: boolean;
    deviceInfo?: DeviceInfo;
    error?: AuthenticationError;
  }> {
    try {
      const deviceFingerprint = await this.generateDeviceFingerprint();
      
      // Check if device registration is required
      if (this.securityPolicy.sessionPolicy.deviceRegistrationRequired) {
        if (!user.securitySettings.allowedDevices.includes(deviceFingerprint)) {
          return {
            allowed: false,
            error: {
              code: 'DEVICE_NOT_AUTHORIZED',
              message: 'Device not authorized. Please register this device first.'
            }
          };
        }
      }

      const deviceInfo: DeviceInfo = {
        id: deviceFingerprint,
        name: this.getDeviceName(),
        type: 'desktop',
        platform: process.platform,
        version: process.version,
        fingerprint: deviceFingerprint,
        trusted: user.securitySettings.allowedDevices.includes(deviceFingerprint),
        registeredAt: new Date()
      };

      return { allowed: true, deviceInfo };
    } catch (error) {
      return {
        allowed: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Device verification failed'
        }
      };
    }
  }

  private async generateDeviceFingerprint(): Promise<string> {
    const machineInfo = [
      os.platform(),
      os.arch(),
      os.hostname(),
      os.cpus()[0]?.model || 'unknown'
    ].join('|');
    
    return crypto.createHash('sha256').update(machineInfo).digest('hex');
  }

  private getDeviceName(): string {
    return `${os.hostname()} (${os.platform()})`;
  }

  private getCurrentIPAddress(): string {
    // In Electron, this would typically be 127.0.0.1 for local app
    // In a networked environment, you'd get the actual IP
    return '127.0.0.1';
  }

  private generateAccessToken(user: User, session: UserSession): string {
    // This would generate a proper JWT token in production
    return Buffer.from(JSON.stringify({
      userId: user.id,
      sessionId: session.id,
      iat: Date.now(),
      exp: session.expiresAt.getTime()
    })).toString('base64');
  }

  private generateRefreshToken(session: UserSession): string {
    // This would generate a proper refresh token in production
    return Buffer.from(JSON.stringify({
      sessionId: session.id,
      type: 'refresh',
      iat: Date.now()
    })).toString('base64');
  }

  private verifyAccessToken(token: string): any {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (decoded.exp && Date.now() > decoded.exp) {
        return null; // Token expired
      }
      
      return decoded;
    } catch {
      return null;
    }
  }

  private getDefaultPermissions(role: string): any[] {
    // Return default permissions based on role
    return [];
  }

  private async updateOfflineAuthData(user: User, deviceInfo: DeviceInfo): Promise<void> {
    try {
      const deviceFingerprint = await this.generateDeviceFingerprint();
      const passwordHash = await keytar.getPassword('ghost-hunter-toolbox', `user-${user.id}`);
      
      if (!passwordHash) return;

      const offlineData: OfflineAuthData = {
        userId: user.id,
        username: user.username,
        passwordHash,
        salt: crypto.randomBytes(32).toString('hex'),
        permissions: user.permissions,
        lastSync: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        deviceFingerprint,
        encryptionKey: crypto.randomBytes(32).toString('hex')
      };

      this.offlineAuthData.set(user.username, offlineData);
      await this.saveOfflineAuthData();
    } catch (error) {
      console.error('Failed to update offline auth data:', error);
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      await fs.access(this.usersPath);
      const encryptedData = await fs.readFile(this.usersPath, 'utf8');
      const decryptedData = await this.encryptionManager.decrypt(JSON.parse(encryptedData));
      const users = JSON.parse(decryptedData);
      
      for (const userData of users) {
        this.users.set(userData.id, {
          ...userData,
          createdAt: new Date(userData.createdAt),
          updatedAt: new Date(userData.updatedAt),
          lastLogin: userData.lastLogin ? new Date(userData.lastLogin) : null,
          lockedUntil: userData.lockedUntil ? new Date(userData.lockedUntil) : null,
          securitySettings: {
            ...userData.securitySettings,
            passwordLastChanged: new Date(userData.securitySettings.passwordLastChanged)
          }
        });
      }
    } catch (error) {
      // File doesn't exist or can't be read - start with empty users
      console.log('No existing users file found, starting fresh');
    }
  }

  private async saveUsers(): Promise<void> {
    try {
      const users = Array.from(this.users.values());
      const encryptedData = await this.encryptionManager.encrypt(JSON.stringify(users));
      await fs.writeFile(this.usersPath, JSON.stringify(encryptedData), 'utf8');
    } catch (error) {
      console.error('Failed to save users:', error);
    }
  }

  private async loadOfflineAuthData(): Promise<void> {
    try {
      await fs.access(this.offlineAuthPath);
      const encryptedData = await fs.readFile(this.offlineAuthPath, 'utf8');
      const decryptedData = await this.encryptionManager.decrypt(JSON.parse(encryptedData));
      const offlineDataArray = JSON.parse(decryptedData);
      
      for (const data of offlineDataArray) {
        this.offlineAuthData.set(data.username, {
          ...data,
          lastSync: new Date(data.lastSync),
          validUntil: new Date(data.validUntil)
        });
      }
    } catch (error) {
      // File doesn't exist or can't be read
      console.log('No existing offline auth data found');
    }
  }

  private async saveOfflineAuthData(): Promise<void> {
    try {
      const offlineDataArray = Array.from(this.offlineAuthData.values());
      const encryptedData = await this.encryptionManager.encrypt(JSON.stringify(offlineDataArray));
      await fs.writeFile(this.offlineAuthPath, JSON.stringify(encryptedData), 'utf8');
    } catch (error) {
      console.error('Failed to save offline auth data:', error);
    }
  }

  private async createDefaultAdminUser(): Promise<void> {
    // Check if admin user already exists
    for (const user of this.users.values()) {
      if (user.role === 'admin') {
        return; // Admin user already exists
      }
    }

    // Create default admin user
    const adminUser = await this.createUser({
      username: 'admin',
      email: 'admin@localhost',
      role: 'admin',
      profile: {
        firstName: 'System',
        lastName: 'Administrator',
        timezone: 'UTC',
        language: 'en'
      }
    }, 'AdminPassword123!');

    if (adminUser) {
      console.log('Default admin user created. Username: admin, Password: AdminPassword123!');
      console.log('Please change the default password after first login.');
    }
  }

  private initializeSecurityPolicy(): void {
    // Initialize with default security policy
    this.securityPolicy = {
      id: crypto.randomUUID(),
      name: 'Default Security Policy',
      version: '1.0.0',
      effectiveDate: new Date(),
      passwordPolicy: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventReuse: 5,
        maxAge: 90,
        lockoutAttempts: 5,
        lockoutDuration: 30
      },
      sessionPolicy: {
        maxDuration: 480, // 8 hours
        inactivityTimeout: 30, // 30 minutes
        maxConcurrentSessions: 3,
        requireMFAForSensitive: true,
        ipWhitelistRequired: false,
        deviceRegistrationRequired: false
      },
      mfaPolicy: {
        required: false,
        requiredForRoles: ['admin'],
        allowedMethods: ['totp', 'email'],
        backupCodesEnabled: true,
        graceLoginCount: 3
      },
      accessPolicy: {
        defaultRole: 'viewer',
        roleBasedAccess: true,
        attributeBasedAccess: false,
        ipRestrictions: false,
        timeRestrictions: false,
        deviceRestrictions: false
      },
      auditPolicy: {
        enabled: true,
        logLevel: 'detailed',
        retentionDays: 365,
        realTimeMonitoring: true,
        alertThresholds: []
      },
      encryptionPolicy: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90,
        encryptAtRest: true,
        encryptInTransit: true,
        encryptBackups: true,
        keyEscrowEnabled: false
      },
      backupPolicy: {
        enabled: true,
        frequency: 'daily',
        retention: 30,
        encryption: true,
        compression: true,
        verification: true
      },
      complianceSettings: {
        standards: ['CJIS', 'NIST'],
        dataRetentionDays: 2555, // 7 years
        dataResidency: ['US'],
        privacySettings: {
          dataMasking: false,
          pseudonymization: false,
          rightToErasure: false,
          consentManagement: false,
          dataPortability: false
        },
        forensicMode: true
      }
    };
  }

  private setupEventListeners(): void {
    // Set up cleanup timer for expired rate limits
    setInterval(() => {
      const now = Date.now();
      for (const [key, limit] of this.rateLimiter) {
        if (now > limit.resetTime) {
          this.rateLimiter.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  public destroy(): void {
    this.removeAllListeners();
    this.sessionManager?.destroy();
    console.log('AuthenticationManager destroyed');
  }
}