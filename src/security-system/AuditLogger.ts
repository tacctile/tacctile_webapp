import { app } from 'electron';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  SecurityAuditLog,
  AuditAction,
  AuditResult,
  RiskLevel,
} from './types';
import { EncryptionManager } from './EncryptionManager';

export class AuditLogger extends EventEmitter {
  private encryptionManager: EncryptionManager;
  private auditLogsPath: string;
  private currentLogFile: string;
  private logQueue: SecurityAuditLog[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly maxLogFileSize = 10 * 1024 * 1024; // 10MB
  private readonly flushInterval = 5000; // 5 seconds
  private readonly retentionDays = 2555; // 7 years for compliance

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.auditLogsPath = path.join(userDataPath, 'audit-logs');
    this.currentLogFile = this.generateLogFileName();
    this.encryptionManager = new EncryptionManager();
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.auditLogsPath, { recursive: true });
      await this.encryptionManager.initialize();
      this.startPeriodicFlush();
      
      await this.log('system', 'audit_system_started', 'success', {
        retention_days: this.retentionDays,
        log_path: this.auditLogsPath
      });

      console.log('AuditLogger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AuditLogger:', error);
      throw error;
    }
  }

  public async log(
    action: AuditAction,
    resourceOrUserId: string,
    result: AuditResult,
    details: Record<string, unknown> = {},
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      const auditLog: SecurityAuditLog = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        userId: userId || (this.isUserAction(action) ? resourceOrUserId : undefined),
        sessionId,
        action,
        resource: this.getResourceFromAction(action),
        resourceId: resourceOrUserId,
        ipAddress: details.ipAddress || this.getLocalIPAddress(),
        userAgent: details.userAgent,
        result,
        details: this.sanitizeDetails(details),
        riskLevel: this.calculateRiskLevel(action, result, details),
        location: details.location,
        deviceId: details.deviceId
      };

      // Add to queue for batch processing
      this.logQueue.push(auditLog);

      // Emit event for real-time monitoring
      this.emit('audit-log-created', auditLog);

      // Handle critical events immediately
      if (auditLog.riskLevel === 'critical') {
        await this.flushLogs();
        this.emit('security-alert', auditLog);
      }

    } catch (error) {
      console.error('Audit logging error:', error);
      // Even if audit logging fails, don't throw - it shouldn't break the main flow
    }
  }

  public async getUserAuditLogs(userId: string, limit = 100): Promise<SecurityAuditLog[]> {
    try {
      const logs: SecurityAuditLog[] = [];
      const logFiles = await this.getLogFiles();

      for (const logFile of logFiles.slice(0, 10)) { // Check last 10 files
        try {
          const fileLogs = await this.readLogFile(logFile);
          const userLogs = fileLogs
            .filter(log => log.userId === userId)
            .slice(0, limit - logs.length);
          
          logs.push(...userLogs);
          
          if (logs.length >= limit) {
            break;
          }
        } catch (error) {
          console.warn(`Failed to read log file ${logFile}:`, error);
        }
      }

      return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get user audit logs:', error);
      return [];
    }
  }

  public async getAuditLogsByAction(
    action: AuditAction, 
    startDate?: Date, 
    endDate?: Date,
    limit = 1000
  ): Promise<SecurityAuditLog[]> {
    try {
      const logs: SecurityAuditLog[] = [];
      const logFiles = await this.getLogFiles();
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
      const end = endDate || new Date();

      for (const logFile of logFiles) {
        if (logs.length >= limit) break;
        
        try {
          const fileLogs = await this.readLogFile(logFile);
          const actionLogs = fileLogs.filter(log => 
            log.action === action &&
            log.timestamp >= start &&
            log.timestamp <= end
          );
          
          logs.push(...actionLogs.slice(0, limit - logs.length));
        } catch (error) {
          console.warn(`Failed to read log file ${logFile}:`, error);
        }
      }

      return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get audit logs by action:', error);
      return [];
    }
  }

  public async getSecurityEvents(
    riskLevel?: RiskLevel,
    hours = 24
  ): Promise<SecurityAuditLog[]> {
    try {
      const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
      const logs: SecurityAuditLog[] = [];
      const logFiles = await this.getLogFiles();

      for (const logFile of logFiles.slice(0, 5)) { // Check last 5 files
        try {
          const fileLogs = await this.readLogFile(logFile);
          const securityLogs = fileLogs.filter(log => {
            const matchesTime = log.timestamp >= startTime;
            const matchesRisk = !riskLevel || log.riskLevel === riskLevel;
            const isSecurityEvent = ['login_failed', 'security_violation', 'unauthorized_access'].includes(log.action);
            
            return matchesTime && matchesRisk && (isSecurityEvent || log.riskLevel === 'high' || log.riskLevel === 'critical');
          });
          
          logs.push(...securityLogs);
        } catch (error) {
          console.warn(`Failed to read log file ${logFile}:`, error);
        }
      }

      return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get security events:', error);
      return [];
    }
  }

  public async generateComplianceReport(startDate: Date, endDate: Date): Promise<{
    totalLogs: number;
    actionsSummary: Record<AuditAction, number>;
    riskSummary: Record<RiskLevel, number>;
    userActivity: Record<string, number>;
    failedLogins: number;
    securityViolations: number;
    reportGenerated: Date;
  }> {
    try {
      const logs = await this.getLogsInDateRange(startDate, endDate);
      
      const actionsSummary: Record<AuditAction, number> = {} as Record<AuditAction, number>;
      const riskSummary: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      const userActivity: Record<string, number> = {};
      let failedLogins = 0;
      let securityViolations = 0;

      for (const log of logs) {
        // Actions summary
        actionsSummary[log.action] = (actionsSummary[log.action] || 0) + 1;
        
        // Risk summary
        riskSummary[log.riskLevel]++;
        
        // User activity
        if (log.userId) {
          userActivity[log.userId] = (userActivity[log.userId] || 0) + 1;
        }
        
        // Failed logins
        if (log.action === 'login_failed') {
          failedLogins++;
        }
        
        // Security violations
        if (log.action === 'security_violation' || log.riskLevel === 'critical') {
          securityViolations++;
        }
      }

      return {
        totalLogs: logs.length,
        actionsSummary,
        riskSummary,
        userActivity,
        failedLogins,
        securityViolations,
        reportGenerated: new Date()
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  public async exportLogs(
    startDate: Date,
    endDate: Date,
    exportPath: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<void> {
    try {
      const logs = await this.getLogsInDateRange(startDate, endDate);
      
      if (format === 'json') {
        const exportData = {
          exportDate: new Date().toISOString(),
          dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
          totalLogs: logs.length,
          logs
        };
        
        await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
      } else if (format === 'csv') {
        const csvContent = this.convertLogsToCSV(logs);
        await fs.writeFile(exportPath, csvContent);
      }
      
      await this.log('export_created', 'audit_logs', 'success', {
        export_path: exportPath,
        format,
        log_count: logs.length,
        date_range: { start: startDate.toISOString(), end: endDate.toISOString() }
      });

      console.log(`Audit logs exported to ${exportPath} (${logs.length} logs)`);
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logQueue.length === 0) {
      return;
    }

    try {
      const logsToFlush = [...this.logQueue];
      this.logQueue = [];

      // Check if we need to rotate log file
      await this.checkLogRotation();

      // Encrypt and write logs
      const logData = JSON.stringify(logsToFlush);
      const encryptedData = await this.encryptionManager.encrypt(logData);
      
      const logFilePath = path.join(this.auditLogsPath, this.currentLogFile);
      const existingData = await this.readExistingLogData(logFilePath);
      
      const combinedData = {
        version: '1.0',
        encrypted: true,
        logs: [...existingData.logs, encryptedData]
      };

      await fs.writeFile(logFilePath, JSON.stringify(combinedData), 'utf8');
      
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Put logs back in queue
      this.logQueue.unshift(...this.logQueue);
    }
  }

  private async readLogFile(fileName: string): Promise<SecurityAuditLog[]> {
    try {
      const filePath = path.join(this.auditLogsPath, fileName);
      const fileData = await fs.readFile(filePath, 'utf8');
      const logFile = JSON.parse(fileData);
      
      if (logFile.encrypted && logFile.logs) {
        const decryptedLogs: SecurityAuditLog[] = [];
        
        for (const encryptedLog of logFile.logs) {
          try {
            const decryptedData = await this.encryptionManager.decrypt(encryptedLog);
            const logs = JSON.parse(decryptedData.toString());
            decryptedLogs.push(...logs.map((log: Record<string, unknown>) => ({
              ...log,
              timestamp: new Date(log.timestamp)
            })));
          } catch (decryptError) {
            console.warn('Failed to decrypt log entry:', decryptError);
          }
        }
        
        return decryptedLogs;
      }
      
      // Legacy unencrypted logs
      return logFile.logs?.map((log: Record<string, unknown>) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      })) || [];
    } catch (error) {
      console.error(`Failed to read log file ${fileName}:`, error);
      return [];
    }
  }

  private async getLogsInDateRange(startDate: Date, endDate: Date): Promise<SecurityAuditLog[]> {
    const logs: SecurityAuditLog[] = [];
    const logFiles = await this.getLogFiles();

    for (const logFile of logFiles) {
      try {
        const fileLogs = await this.readLogFile(logFile);
        const rangeLogs = fileLogs.filter(log => 
          log.timestamp >= startDate && log.timestamp <= endDate
        );
        logs.push(...rangeLogs);
      } catch (error) {
        console.warn(`Failed to read log file ${logFile}:`, error);
      }
    }

    return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.auditLogsPath);
      return files
        .filter(file => file.endsWith('.audit.log'))
        .sort((a, b) => b.localeCompare(a)); // Newest first
    } catch (error) {
      console.error('Failed to get log files:', error);
      return [];
    }
  }

  private calculateRiskLevel(action: AuditAction, result: AuditResult, _details: Record<string, unknown>): RiskLevel {
    // Critical risk actions
    const criticalActions: AuditAction[] = [
      'security_violation',
      'system_compromise',
      'data_breach_attempt'
    ];
    
    // High risk actions
    const highRiskActions: AuditAction[] = [
      'login_failed',
      'user_locked',
      'permission_denied',
      'evidence_deleted'
    ];

    if (criticalActions.includes(action) || result === 'blocked') {
      return 'critical';
    }

    if (highRiskActions.includes(action) || result === 'failure') {
      return 'high';
    }

    if (result === 'warning') {
      return 'medium';
    }

    return 'low';
  }

  private isUserAction(action: AuditAction): boolean {
    const userActions: AuditAction[] = [
      'login', 'logout', 'login_failed', 'password_changed',
      'evidence_created', 'evidence_accessed', 'evidence_modified'
    ];
    return userActions.includes(action);
  }

  private getResourceFromAction(action: AuditAction): string {
    const resourceMap: Record<string, string> = {
      'login': 'authentication',
      'logout': 'authentication',
      'login_failed': 'authentication',
      'user_created': 'user_management',
      'evidence_created': 'evidence',
      'case_created': 'case',
      'system_config_changed': 'system'
    };
    
    return resourceMap[action] || 'unknown';
  }

  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...details };
    
    // Remove sensitive information
    const sensitiveKeys = ['password', 'token', 'key', 'secret'];
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private convertLogsToCSV(logs: SecurityAuditLog[]): string {
    const headers = [
      'timestamp', 'action', 'userId', 'resource', 'result', 'riskLevel', 'ipAddress'
    ];
    
    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.timestamp.toISOString(),
        log.action,
        log.userId || '',
        log.resource,
        log.result,
        log.riskLevel,
        log.ipAddress
      ].join(','))
    ];
    
    return csvRows.join('\n');
  }

  private getLocalIPAddress(): string {
    return '127.0.0.1';
  }

  private generateLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return `${dateStr}.audit.log`;
  }

  private async checkLogRotation(): Promise<void> {
    try {
      const currentLogPath = path.join(this.auditLogsPath, this.currentLogFile);
      const stats = await fs.stat(currentLogPath).catch(() => null);
      
      if (stats && stats.size > this.maxLogFileSize) {
        // Rotate to new file
        this.currentLogFile = this.generateLogFileName();
      }
    } catch (error) {
      console.error('Log rotation check failed:', error);
    }
  }

  private async readExistingLogData(filePath: string): Promise<{ version: string; encrypted: boolean; logs: Record<string, unknown>[] }> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is empty
      return { version: '1.0', encrypted: true, logs: [] };
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining logs
    this.flushLogs();
    
    this.removeAllListeners();
    console.log('AuditLogger destroyed');
  }
}