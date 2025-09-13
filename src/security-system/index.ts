import { app, BrowserWindow, ipcMain } from 'electron';
import { EventEmitter } from 'events';
import { AuthenticationManager } from './AuthenticationManager';
import { SessionManager } from './SessionManager';
import { LicenseValidator } from './LicenseValidator';
import { EncryptionManager } from './EncryptionManager';
import { AuditLogger } from './AuditLogger';
import { NetworkSecuritySystem } from '../network-security';
import { LicenseManagementSystem } from '../license-management';
import {
  User,
  UserSession,
  AuthenticationCredentials,
  AuthenticationResult,
  SecurityMetrics,
  License,
  EncryptedData,
  SecurityAuditLog
} from './types';

export class SecuritySystem extends EventEmitter {
  private authManager: AuthenticationManager;
  private sessionManager: SessionManager;
  private licenseValidator: LicenseValidator;
  private encryptionManager: EncryptionManager;
  private auditLogger: AuditLogger;
  private networkSecurity: NetworkSecuritySystem;
  private licenseManagement: LicenseManagementSystem;
  private mainWindow: BrowserWindow | null = null;
  private initialized = false;
  private securityMetrics: SecurityMetrics;

  constructor() {
    super();
    
    this.authManager = new AuthenticationManager();
    this.sessionManager = new SessionManager();
    this.licenseValidator = new LicenseValidator();
    this.encryptionManager = new EncryptionManager();
    this.auditLogger = new AuditLogger();
    this.networkSecurity = new NetworkSecuritySystem();
    this.licenseManagement = new LicenseManagementSystem();
    
    this.initializeSecurityMetrics();
    this.setupEventForwarding();
  }

  public async initialize(mainWindow: BrowserWindow): Promise<void> {
    if (this.initialized) {
      console.warn('SecuritySystem already initialized');
      return;
    }

    this.mainWindow = mainWindow;

    try {
      console.log('Initializing SecuritySystem...');

      // Initialize all components in the correct order
      await this.auditLogger.initialize();
      await this.encryptionManager.initialize();
      await this.licenseValidator.initialize();
      await this.sessionManager.initialize();
      await this.authManager.initialize();
      
      // Initialize new systems
      await this.networkSecurity.initialize();
      await this.licenseManagement.initialize();

      this.initialized = true;
      this.setupIpcHandlers();
      
      await this.auditLogger.log('system', 'security_system_started', 'success', {
        version: app.getVersion(),
        platform: process.platform,
        timestamp: new Date().toISOString()
      });

      console.log('SecuritySystem initialized successfully');
      this.emit('initialized');

    } catch (error) {
      console.error('Failed to initialize SecuritySystem:', error);
      await this.auditLogger.log('system', 'security_system_failed', 'failure', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      this.emit('initialization-error', error);
      throw error;
    }
  }

  // Authentication Methods
  public async authenticate(credentials: AuthenticationCredentials): Promise<AuthenticationResult> {
    this.ensureInitialized();
    return await this.authManager.authenticate(credentials);
  }

  public async authenticateOffline(credentials: AuthenticationCredentials): Promise<AuthenticationResult> {
    this.ensureInitialized();
    return await this.authManager.authenticateOffline(credentials);
  }

  public async logout(sessionId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.authManager.logout(sessionId);
  }

  public async validateSession(token: string): Promise<User | null> {
    this.ensureInitialized();
    return await this.authManager.validateSession(token);
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    this.ensureInitialized();
    const result = await this.authManager.changePassword(userId, currentPassword, newPassword);
    
    if (result) {
      await this.auditLogger.log('password_changed', userId, 'success', {}, userId);
    } else {
      await this.auditLogger.log('password_changed', userId, 'failure', {}, userId);
    }
    
    return result;
  }

  // User Management
  public async createUser(userData: Partial<User>, initialPassword: string): Promise<User | null> {
    this.ensureInitialized();
    const user = await this.authManager.createUser(userData, initialPassword);
    
    if (user) {
      await this.auditLogger.log('user_created', user.id, 'success', {
        username: user.username,
        role: user.role
      });
    }
    
    return user;
  }

  public async getUserById(userId: string): Promise<User | null> {
    this.ensureInitialized();
    return await this.authManager.getUserById(userId);
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    this.ensureInitialized();
    return await this.authManager.getUserByUsername(username);
  }

  // Session Management
  public async getUserSessions(userId: string): Promise<UserSession[]> {
    this.ensureInitialized();
    return await this.sessionManager.getUserSessions(userId);
  }

  public async invalidateAllUserSessions(userId: string): Promise<number> {
    this.ensureInitialized();
    const count = await this.sessionManager.invalidateAllUserSessions(userId);
    
    if (count > 0) {
      await this.auditLogger.log('user_sessions_invalidated', userId, 'success', {
        sessions_count: count
      });
    }
    
    return count;
  }

  public async getAllActiveSessions(): Promise<UserSession[]> {
    this.ensureInitialized();
    return await this.sessionManager.getAllActiveSessions();
  }

  // License Management
  public async validateUserLicense(userId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.licenseValidator.validateUserLicense(userId);
  }

  public async activateLicense(licenseKey: string, userId: string): Promise<boolean> {
    this.ensureInitialized();
    const result = await this.licenseValidator.activateLicense(licenseKey, userId);
    
    await this.auditLogger.log('license_activated', userId, result.valid ? 'success' : 'failure', {
      license_key: licenseKey.substring(0, 8) + '...',
      error: result.error
    });
    
    return result.valid;
  }

  public async getLicenseInfo(userId: string): Promise<Record<string, unknown>> {
    this.ensureInitialized();
    return this.licenseValidator.getLicenseInfo(userId);
  }

  public async checkFeatureAccess(userId: string, featureName: string): Promise<boolean> {
    this.ensureInitialized();
    const hasAccess = await this.licenseValidator.checkFeatureAccess(userId, featureName);
    
    if (!hasAccess) {
      await this.auditLogger.log('permission_denied', userId, 'blocked', {
        feature: featureName,
        reason: 'feature_not_licensed'
      });
    }
    
    return hasAccess;
  }

  // Encryption Services
  public async encryptData(data: string | Buffer, userId?: string): Promise<EncryptedData> {
    this.ensureInitialized();
    const encrypted = await this.encryptionManager.encrypt(data);
    
    if (userId) {
      await this.auditLogger.log('data_encrypted', userId, 'success', {
        data_size: typeof data === 'string' ? data.length : data.length,
        algorithm: encrypted.algorithm
      });
    }
    
    return encrypted;
  }

  public async decryptData(encryptedData: EncryptedData, userId?: string): Promise<Buffer> {
    this.ensureInitialized();
    const decrypted = await this.encryptionManager.decrypt(encryptedData);
    
    if (userId) {
      await this.auditLogger.log('data_decrypted', userId, 'success', {
        algorithm: encryptedData.algorithm,
        key_id: encryptedData.keyId
      });
    }
    
    return decrypted;
  }

  public async encryptFile(filePath: string, outputPath: string, userId?: string): Promise<EncryptedData> {
    this.ensureInitialized();
    const encrypted = await this.encryptionManager.encryptFile(filePath, outputPath);
    
    if (userId) {
      await this.auditLogger.log('file_encrypted', userId, 'success', {
        file_path: filePath,
        output_path: outputPath,
        algorithm: encrypted.algorithm
      });
    }
    
    return encrypted;
  }

  public async decryptFile(encryptedFilePath: string, outputPath: string, userId?: string): Promise<void> {
    this.ensureInitialized();
    await this.encryptionManager.decryptFile(encryptedFilePath, outputPath);
    
    if (userId) {
      await this.auditLogger.log('file_decrypted', userId, 'success', {
        encrypted_file: encryptedFilePath,
        output_path: outputPath
      });
    }
  }

  // Audit and Compliance
  public async logSecurityEvent(
    userId: string,
    action: string,
    result: 'success' | 'failure' | 'blocked' | 'warning',
    details: Record<string, unknown> = {}
  ): Promise<void> {
    this.ensureInitialized();
    await this.auditLogger.log(action as string, userId, result, details, userId);
  }

  public async getUserAuditLogs(userId: string, limit = 100): Promise<SecurityAuditLog[]> {
    this.ensureInitialized();
    return await this.auditLogger.getUserAuditLogs(userId, limit);
  }

  public async getSecurityEvents(hours = 24): Promise<SecurityAuditLog[]> {
    this.ensureInitialized();
    return await this.auditLogger.getSecurityEvents(undefined, hours);
  }

  public async generateComplianceReport(startDate: Date, endDate: Date): Promise<Record<string, unknown>> {
    this.ensureInitialized();
    return await this.auditLogger.generateComplianceReport(startDate, endDate);
  }

  public async exportAuditLogs(startDate: Date, endDate: Date, exportPath: string): Promise<void> {
    this.ensureInitialized();
    await this.auditLogger.exportLogs(startDate, endDate, exportPath);
  }

  // System Health and Metrics
  public async getSecurityMetrics(): Promise<SecurityMetrics> {
    this.ensureInitialized();
    
    const sessionMetrics = this.sessionManager.getSessionMetrics();
    const securityEvents = await this.auditLogger.getSecurityEvents(undefined, 24);
    
    this.securityMetrics = {
      totalUsers: 0, // Would be calculated from user store
      activeUsers: sessionMetrics.userSessionCounts.size,
      lockedAccounts: 0, // Would be calculated from user store
      failedLoginAttempts24h: securityEvents.filter(e => e.action === 'login_failed').length,
      mfaEnabledUsers: 0, // Would be calculated from user store
      activeSessions: sessionMetrics.activeSessions,
      averageSessionDuration: sessionMetrics.averageSessionDuration,
      securityViolations24h: securityEvents.filter(e => e.riskLevel === 'critical' || e.riskLevel === 'high').length,
      lastSecurityAudit: new Date(),
      complianceScore: this.calculateComplianceScore()
    };

    return this.securityMetrics;
  }

  public async getSystemHealth(): Promise<{
    securitySystemHealthy: boolean;
    authenticationHealthy: boolean;
    encryptionHealthy: boolean;
    auditingHealthy: boolean;
    licensingHealthy: boolean;
    issues: string[];
  }> {
    this.ensureInitialized();
    
    const issues: string[] = [];
    
    // Check each subsystem
    const authHealthy = true; // Would implement health checks
    const encryptionHealthy = true; // Would implement health checks
    const auditingHealthy = true; // Would implement health checks
    const licensingHealthy = true; // Would implement health checks

    if (!authHealthy) issues.push('Authentication system issues detected');
    if (!encryptionHealthy) issues.push('Encryption system issues detected');
    if (!auditingHealthy) issues.push('Audit system issues detected');
    if (!licensingHealthy) issues.push('Licensing system issues detected');

    return {
      securitySystemHealthy: issues.length === 0,
      authenticationHealthy: authHealthy,
      encryptionHealthy: encryptionHealthy,
      auditingHealthy: auditingHealthy,
      licensingHealthy: licensingHealthy,
      issues
    };
  }

  private setupEventForwarding(): void {
    // Forward events from AuthenticationManager
    this.authManager.on('user-authenticated', (user: User, session: UserSession) => {
      this.emit('user-authenticated', user, session);
      this.updateSecurityMetrics();
    });

    this.authManager.on('user-logout', (userId: string, sessionId: string) => {
      this.emit('user-logout', userId, sessionId);
      this.updateSecurityMetrics();
    });

    this.authManager.on('authentication-failed', (username: string, error: Record<string, unknown>) => {
      this.emit('authentication-failed', username, error);
      this.updateSecurityMetrics();
    });

    // Forward events from SessionManager
    this.sessionManager.on('session-created', (session: UserSession) => {
      this.emit('session-created', session);
    });

    this.sessionManager.on('session-invalidated', (session: UserSession) => {
      this.emit('session-invalidated', session);
    });

    // Forward events from LicenseValidator
    this.licenseValidator.on('license-activated', (license: License) => {
      this.emit('license-activated', license);
    });

    this.licenseValidator.on('license-deactivated', (license: License) => {
      this.emit('license-deactivated', license);
    });

    // Forward events from EncryptionManager
    this.encryptionManager.on('key-generated', (keyId: string, purpose: string) => {
      this.emit('key-generated', keyId, purpose);
    });

    this.encryptionManager.on('key-rotated', (oldKeyId: string, newKeyId: string) => {
      this.emit('key-rotated', oldKeyId, newKeyId);
    });

    // Forward events from AuditLogger
    this.auditLogger.on('audit-log-created', (log: SecurityAuditLog) => {
      this.emit('audit-log-created', log);
      
      // Emit security alerts for high-risk events
      if (log.riskLevel === 'critical' || log.riskLevel === 'high') {
        this.emit('security-alert', log);
      }
    });

    this.auditLogger.on('security-alert', (log: SecurityAuditLog) => {
      this.emit('security-alert', log);
    });

    // Forward events from NetworkSecuritySystem
    this.networkSecurity.on('threat-detected', (threat: Record<string, unknown>) => {
      this.emit('network-threat-detected', threat);
      this.auditLogger.log('security_violation', threat.source, 'blocked', {
        threat_type: threat.type,
        threat_severity: threat.severity,
        description: threat.description
      });
    });

    this.networkSecurity.on('device-registered', (device: Record<string, unknown>) => {
      this.emit('network-device-registered', device);
    });

    this.networkSecurity.on('security-scan-completed', (result: Record<string, unknown>) => {
      this.emit('network-scan-completed', result);
    });

    // Forward events from LicenseManagementSystem
    this.licenseManagement.on('scan-completed', (libraries: Record<string, unknown>[]) => {
      this.emit('license-scan-completed', libraries);
    });

    this.licenseManagement.on('report-generated', (report: Record<string, unknown>) => {
      this.emit('compliance-report-generated', report);
    });

    this.licenseManagement.on('audit-completed', (audit: Record<string, unknown>) => {
      this.emit('license-audit-completed', audit);
    });
  }

  private setupIpcHandlers(): void {
    // Authentication handlers
    ipcMain.handle('security:authenticate', async (_, credentials: AuthenticationCredentials) => {
      return await this.authenticate(credentials);
    });

    ipcMain.handle('security:authenticate-offline', async (_, credentials: AuthenticationCredentials) => {
      return await this.authenticateOffline(credentials);
    });

    ipcMain.handle('security:logout', async (_, sessionId: string) => {
      return await this.logout(sessionId);
    });

    ipcMain.handle('security:validate-session', async (_, token: string) => {
      return await this.validateSession(token);
    });

    ipcMain.handle('security:change-password', async (_, userId: string, currentPassword: string, newPassword: string) => {
      return await this.changePassword(userId, currentPassword, newPassword);
    });

    // User management handlers
    ipcMain.handle('security:create-user', async (_, userData: Partial<User>, initialPassword: string) => {
      return await this.createUser(userData, initialPassword);
    });

    ipcMain.handle('security:get-user', async (_, userId: string) => {
      return await this.getUserById(userId);
    });

    // Session management handlers
    ipcMain.handle('security:get-user-sessions', async (_, userId: string) => {
      return await this.getUserSessions(userId);
    });

    ipcMain.handle('security:invalidate-all-sessions', async (_, userId: string) => {
      return await this.invalidateAllUserSessions(userId);
    });

    // License handlers
    ipcMain.handle('security:activate-license', async (_, licenseKey: string, userId: string) => {
      return await this.activateLicense(licenseKey, userId);
    });

    ipcMain.handle('security:get-license-info', async (_, userId: string) => {
      return await this.getLicenseInfo(userId);
    });

    ipcMain.handle('security:check-feature-access', async (_, userId: string, featureName: string) => {
      return await this.checkFeatureAccess(userId, featureName);
    });

    // Encryption handlers
    ipcMain.handle('security:encrypt-data', async (_, data: string, userId?: string) => {
      return await this.encryptData(data, userId);
    });

    ipcMain.handle('security:decrypt-data', async (_, encryptedData: EncryptedData, userId?: string) => {
      const decrypted = await this.decryptData(encryptedData, userId);
      return decrypted.toString();
    });

    // Audit handlers
    ipcMain.handle('security:get-user-audit-logs', async (_, userId: string, limit: number) => {
      return await this.getUserAuditLogs(userId, limit);
    });

    ipcMain.handle('security:get-security-events', async (_, hours: number) => {
      return await this.getSecurityEvents(hours);
    });

    ipcMain.handle('security:generate-compliance-report', async (_, startDate: string, endDate: string) => {
      return await this.generateComplianceReport(new Date(startDate), new Date(endDate));
    });

    // System health handlers
    ipcMain.handle('security:get-metrics', async () => {
      return await this.getSecurityMetrics();
    });

    ipcMain.handle('security:get-system-health', async () => {
      return await this.getSystemHealth();
    });
  }

  private initializeSecurityMetrics(): void {
    this.securityMetrics = {
      totalUsers: 0,
      activeUsers: 0,
      lockedAccounts: 0,
      failedLoginAttempts24h: 0,
      mfaEnabledUsers: 0,
      activeSessions: 0,
      averageSessionDuration: 0,
      securityViolations24h: 0,
      lastSecurityAudit: new Date(),
      complianceScore: 0
    };
  }

  private updateSecurityMetrics(): void {
    // Update metrics asynchronously
    setTimeout(() => {
      this.getSecurityMetrics();
    }, 1000);
  }

  private calculateComplianceScore(): number {
    // Calculate compliance score based on various factors
    let score = 100;
    
    // Deduct points for security issues
    if (this.securityMetrics.failedLoginAttempts24h > 10) score -= 10;
    if (this.securityMetrics.securityViolations24h > 0) score -= 20;
    if (this.securityMetrics.lockedAccounts > 0) score -= 5;
    
    return Math.max(0, score);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SecuritySystem not initialized. Call initialize() first.');
    }
  }

  public destroy(): void {
    if (!this.initialized) {
      return;
    }

    console.log('Destroying SecuritySystem...');

    this.authManager?.destroy();
    this.sessionManager?.destroy();
    this.licenseValidator?.destroy();
    this.encryptionManager?.destroy();
    this.auditLogger?.destroy();
    this.networkSecurity?.destroy();
    this.licenseManagement?.destroy();

    this.removeAllListeners();
    this.initialized = false;

    console.log('SecuritySystem destroyed');
  }
}

// Global instance for the application
let securitySystem: SecuritySystem | null = null;

export const initializeSecuritySystem = async (mainWindow: BrowserWindow): Promise<SecuritySystem> => {
  if (securitySystem) {
    console.warn('SecuritySystem already exists');
    return securitySystem;
  }

  securitySystem = new SecuritySystem();
  await securitySystem.initialize(mainWindow);
  return securitySystem;
};

export const getSecuritySystem = (): SecuritySystem => {
  if (!securitySystem) {
    throw new Error('SecuritySystem not initialized. Call initializeSecuritySystem() first.');
  }
  return securitySystem;
};

export const destroySecuritySystem = (): void => {
  if (securitySystem) {
    securitySystem.destroy();
    securitySystem = null;
  }
};

// Export all types and classes for external use
export * from './types';
export { AuthenticationManager } from './AuthenticationManager';
export { SessionManager } from './SessionManager';
export { LicenseValidator } from './LicenseValidator';
export { EncryptionManager } from './EncryptionManager';
export { AuditLogger } from './AuditLogger';