import { app } from 'electron';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { User, UserSession, DeviceInfo } from './types';

export class SessionManager extends EventEmitter {
  private sessions: Map<string, UserSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private sessionsPath: string;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private maxConcurrentSessions = 3;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
  private maxSessionDuration = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.sessionsPath = path.join(userDataPath, 'sessions.json');
    
    this.startCleanupTimer();
  }

  public async initialize(): Promise<void> {
    try {
      await this.loadSessions();
      await this.cleanupExpiredSessions();
      console.log('SessionManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SessionManager:', error);
      throw error;
    }
  }

  public async createSession(
    user: User, 
    deviceInfo: DeviceInfo, 
    ipAddress: string
  ): Promise<UserSession | null> {
    try {
      // Check concurrent session limit
      const userSessionIds = this.userSessions.get(user.id) || new Set();
      if (userSessionIds.size >= this.maxConcurrentSessions) {
        // Remove oldest session
        await this.removeOldestSession(user.id);
      }

      const sessionId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.maxSessionDuration);

      const session: UserSession = {
        id: sessionId,
        userId: user.id,
        deviceId: deviceInfo.id,
        deviceInfo,
        ipAddress,
        userAgent: this.getUserAgent(),
        createdAt: now,
        expiresAt,
        lastActivity: now,
        isActive: true,
        permissions: user.permissions
      };

      // Store session
      this.sessions.set(sessionId, session);
      
      // Update user session tracking
      if (!this.userSessions.has(user.id)) {
        this.userSessions.set(user.id, new Set());
      }
      this.userSessions.get(user.id)!.add(sessionId);

      await this.saveSessions();

      this.emit('session-created', session);
      console.log(`Session created for user ${user.username}: ${sessionId}`);

      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  }

  public async getSession(sessionId: string): Promise<UserSession | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      await this.invalidateSession(sessionId);
      return null;
    }

    return session;
  }

  public async updateLastActivity(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }

    session.lastActivity = new Date();
    
    // Extend expiration if needed (sliding session)
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry < this.sessionTimeout) {
      session.expiresAt = new Date(Date.now() + this.maxSessionDuration);
    }

    await this.saveSessions();
    return true;
  }

  public async invalidateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Mark as inactive
    session.isActive = false;

    // Remove from user session tracking
    const userSessionIds = this.userSessions.get(session.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
      if (userSessionIds.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove from sessions map
    this.sessions.delete(sessionId);

    await this.saveSessions();

    this.emit('session-invalidated', session);
    console.log(`Session invalidated: ${sessionId}`);

    return true;
  }

  public async invalidateAllUserSessions(userId: string): Promise<number> {
    const userSessionIds = this.userSessions.get(userId);
    
    if (!userSessionIds) {
      return 0;
    }

    let invalidatedCount = 0;
    for (const sessionId of userSessionIds) {
      const success = await this.invalidateSession(sessionId);
      if (success) {
        invalidatedCount++;
      }
    }

    this.emit('user-sessions-invalidated', userId, invalidatedCount);
    console.log(`Invalidated ${invalidatedCount} sessions for user ${userId}`);

    return invalidatedCount;
  }

  public async getUserSessions(userId: string): Promise<UserSession[]> {
    const userSessionIds = this.userSessions.get(userId) || new Set();
    const sessions: UserSession[] = [];

    for (const sessionId of userSessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  public async getAllActiveSessions(): Promise<UserSession[]> {
    const activeSessions: UserSession[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.isActive && !this.isSessionExpired(session)) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  public async getSessionsByDevice(deviceId: string): Promise<UserSession[]> {
    const deviceSessions: UserSession[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.deviceId === deviceId && session.isActive && !this.isSessionExpired(session)) {
        deviceSessions.push(session);
      }
    }

    return deviceSessions;
  }

  public async getSessionsByIP(ipAddress: string): Promise<UserSession[]> {
    const ipSessions: UserSession[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.ipAddress === ipAddress && session.isActive && !this.isSessionExpired(session)) {
        ipSessions.push(session);
      }
    }

    return ipSessions;
  }

  public async extendSession(sessionId: string, extensionMinutes = 60): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive || this.isSessionExpired(session)) {
      return false;
    }

    const extensionMs = extensionMinutes * 60 * 1000;
    session.expiresAt = new Date(session.expiresAt.getTime() + extensionMs);
    session.lastActivity = new Date();

    await this.saveSessions();

    this.emit('session-extended', session, extensionMinutes);
    console.log(`Session ${sessionId} extended by ${extensionMinutes} minutes`);

    return true;
  }

  public async cleanupExpiredSessions(): Promise<number> {
    let cleanedCount = 0;
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      const success = await this.invalidateSession(sessionId);
      if (success) {
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
      this.emit('sessions-cleaned', cleanedCount);
    }

    return cleanedCount;
  }

  public getSessionMetrics(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    userSessionCounts: Map<string, number>;
    averageSessionDuration: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  } {
    let activeSessions = 0;
    let expiredSessions = 0;
    let totalDuration = 0;
    let oldestSession: Date | null = null;
    let newestSession: Date | null = null;
    const userSessionCounts = new Map<string, number>();

    for (const session of this.sessions.values()) {
      const isExpired = this.isSessionExpired(session);
      
      if (isExpired) {
        expiredSessions++;
      } else if (session.isActive) {
        activeSessions++;
      }

      // Track user session counts
      const currentCount = userSessionCounts.get(session.userId) || 0;
      userSessionCounts.set(session.userId, currentCount + 1);

      // Calculate session duration
      const endTime = session.isActive ? new Date() : session.expiresAt;
      const duration = endTime.getTime() - session.createdAt.getTime();
      totalDuration += duration;

      // Track oldest and newest sessions
      if (!oldestSession || session.createdAt < oldestSession) {
        oldestSession = session.createdAt;
      }
      if (!newestSession || session.createdAt > newestSession) {
        newestSession = session.createdAt;
      }
    }

    const totalSessions = this.sessions.size;
    const averageSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    return {
      totalSessions,
      activeSessions,
      expiredSessions,
      userSessionCounts,
      averageSessionDuration: Math.round(averageSessionDuration / 60000), // Convert to minutes
      oldestSession,
      newestSession
    };
  }

  public setSessionConfiguration(config: {
    maxConcurrentSessions?: number;
    sessionTimeout?: number; // minutes
    maxSessionDuration?: number; // minutes
  }): void {
    if (config.maxConcurrentSessions !== undefined) {
      this.maxConcurrentSessions = Math.max(1, config.maxConcurrentSessions);
    }

    if (config.sessionTimeout !== undefined) {
      this.sessionTimeout = Math.max(5, config.sessionTimeout) * 60 * 1000; // Convert to milliseconds
    }

    if (config.maxSessionDuration !== undefined) {
      this.maxSessionDuration = Math.max(30, config.maxSessionDuration) * 60 * 1000; // Convert to milliseconds
    }

    console.log('Session configuration updated:', {
      maxConcurrentSessions: this.maxConcurrentSessions,
      sessionTimeout: this.sessionTimeout / 60000,
      maxSessionDuration: this.maxSessionDuration / 60000
    });
  }

  private isSessionExpired(session: UserSession): boolean {
    const now = Date.now();
    
    // Check absolute expiration
    if (now > session.expiresAt.getTime()) {
      return true;
    }

    // Check inactivity timeout
    const inactivityMs = now - session.lastActivity.getTime();
    if (inactivityMs > this.sessionTimeout) {
      return true;
    }

    return false;
  }

  private async removeOldestSession(userId: string): Promise<void> {
    const userSessionIds = this.userSessions.get(userId);
    
    if (!userSessionIds) {
      return;
    }

    let oldestSessionId: string | null = null;
    let oldestTime = Date.now();

    for (const sessionId of userSessionIds) {
      const session = this.sessions.get(sessionId);
      if (session && session.createdAt.getTime() < oldestTime) {
        oldestTime = session.createdAt.getTime();
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      await this.invalidateSession(oldestSessionId);
      console.log(`Removed oldest session for user ${userId}: ${oldestSessionId}`);
    }
  }

  private getUserAgent(): string {
    return `Ghost Hunter Toolbox/${app.getVersion()} (${process.platform}; ${process.arch})`;
  }

  private startCleanupTimer(): void {
    // Clean up expired sessions every 5 minutes
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        console.error('Session cleanup error:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async loadSessions(): Promise<void> {
    try {
      await fs.access(this.sessionsPath);
      const data = await fs.readFile(this.sessionsPath, 'utf8');
      const sessionsData = JSON.parse(data);

      for (const sessionData of sessionsData) {
        const session: UserSession = {
          ...sessionData,
          createdAt: new Date(sessionData.createdAt),
          expiresAt: new Date(sessionData.expiresAt),
          lastActivity: new Date(sessionData.lastActivity),
          deviceInfo: {
            ...sessionData.deviceInfo,
            registeredAt: new Date(sessionData.deviceInfo.registeredAt)
          }
        };

        // Only load active, non-expired sessions
        if (session.isActive && !this.isSessionExpired(session)) {
          this.sessions.set(session.id, session);
          
          // Update user session tracking
          if (!this.userSessions.has(session.userId)) {
            this.userSessions.set(session.userId, new Set());
          }
          this.userSessions.get(session.userId)!.add(session.id);
        }
      }

      console.log(`Loaded ${this.sessions.size} active sessions`);
    } catch (error) {
      // File doesn't exist or can't be read - start with empty sessions
      console.log('No existing sessions file found, starting fresh');
    }
  }

  private async saveSessions(): Promise<void> {
    try {
      const sessionsData = Array.from(this.sessions.values());
      await fs.writeFile(this.sessionsPath, JSON.stringify(sessionsData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.removeAllListeners();
    console.log('SessionManager destroyed');
  }
}