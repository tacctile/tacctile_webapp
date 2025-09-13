import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream, WriteStream } from 'fs';
import {
  ApplicationError,
  ErrorLogger as IErrorLogger,
  ErrorLogQuery,
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  ErrorConfiguration
} from './types';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: ErrorSeverity;
  error: ApplicationError;
  formatted: string;
  metadata?: Record<string, any>;
}

export interface LogRotationInfo {
  currentFile: string;
  archivedFiles: string[];
  totalSize: number;
}

export class ErrorLogger extends EventEmitter implements IErrorLogger {
  private logDir: string;
  private currentLogFile: string;
  private writeStream?: WriteStream;
  private config: ErrorConfiguration['logging'];
  private logBuffer: LogEntry[] = [];
  private bufferFlushInterval?: NodeJS.Timeout;
  private rotationCheckInterval?: NodeJS.Timeout;
  private isInitialized = false;
  private logCounter = 0;

  constructor(logDir = './logs', config?: Partial<ErrorConfiguration['logging']>) {
    super();
    this.logDir = logDir;
    this.config = {
      enabled: true,
      level: ErrorSeverity.MEDIUM,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: 'json',
      includeStackTrace: true,
      includeUserActions: true,
      includeSystemInfo: true,
      ...config
    };

    const now = new Date();
    this.currentLogFile = path.join(
      this.logDir, 
      `error-${now.toISOString().split('T')[0]}.log`
    );
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await fs.mkdir(this.logDir, { recursive: true });
      await this.initializeLogFile();
      this.startBufferFlush();
      this.startRotationCheck();
      this.isInitialized = true;
      this.emit('initialized', { logFile: this.currentLogFile });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async log(error: ApplicationError): Promise<void> {
    if (!this.config.enabled || !this.shouldLog(error)) {
      return;
    }

    const logEntry = await this.createLogEntry(error);
    this.logBuffer.push(logEntry);
    
    this.emit('logged', logEntry);

    // Immediately flush for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      await this.flushBuffer();
    }
  }

  public async query(filters: ErrorLogQuery): Promise<ApplicationError[]> {
    const logFiles = await this.getLogFiles();
    const errors: ApplicationError[] = [];

    for (const logFile of logFiles) {
      const fileErrors = await this.queryLogFile(logFile, filters);
      errors.push(...fileErrors);
    }

    return this.applyFilters(errors, filters);
  }

  public async count(filters: ErrorLogQuery): Promise<number> {
    const errors = await this.query(filters);
    return errors.length;
  }

  public async cleanup(olderThan: Date): Promise<number> {
    const logFiles = await this.getLogFiles();
    let deletedCount = 0;

    for (const logFile of logFiles) {
      try {
        const stats = await fs.stat(logFile);
        if (stats.mtime < olderThan) {
          await fs.unlink(logFile);
          deletedCount++;
          this.emit('file-deleted', { file: logFile, date: stats.mtime });
        }
      } catch (error) {
        console.warn(`Failed to cleanup log file ${logFile}:`, error);
      }
    }

    return deletedCount;
  }

  private async createLogEntry(error: ApplicationError): Promise<LogEntry> {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${++this.logCounter}`,
      timestamp: Date.now(),
      level: error.severity,
      error,
      formatted: await this.formatError(error),
      metadata: await this.collectMetadata(error)
    };

    return entry;
  }

  private async formatError(error: ApplicationError): Promise<string> {
    if (this.config.format === 'json') {
      return this.formatAsJson(error);
    } else {
      return this.formatAsText(error);
    }
  }

  private formatAsJson(error: ApplicationError): string {
    const logData = {
      timestamp: new Date(error.timestamp).toISOString(),
      id: error.id,
      level: error.severity,
      code: error.code,
      category: error.category,
      message: error.userMessage,
      technicalMessage: error.technicalDetails,
      context: {
        component: error.context.component,
        function: error.context.function,
        file: error.context.file,
        line: error.context.line,
        userId: error.context.userId,
        sessionId: error.context.sessionId,
        investigationId: error.context.investigationId,
        appVersion: error.context.appVersion,
        buildVersion: error.context.buildVersion,
        environment: error.context.environment
      },
      recoverable: error.recoverable,
      correlationId: error.correlationId,
      causedBy: error.causedBy ? {
        id: error.causedBy.id,
        code: error.causedBy.code,
        message: error.causedBy.message
      } : undefined,
      stackTrace: this.config.includeStackTrace ? error.metadata.stackTrace : undefined,
      userActions: this.config.includeUserActions ? error.metadata.userActions : undefined,
      systemInfo: this.config.includeSystemInfo ? error.metadata.systemInfo : undefined,
      performanceMetrics: error.metadata.performanceMetrics,
      suggestions: error.suggestions
    };

    return JSON.stringify(logData, null, 0);
  }

  private formatAsText(error: ApplicationError): string {
    const parts: string[] = [];
    
    parts.push(`[${new Date(error.timestamp).toISOString()}]`);
    parts.push(`[${error.severity.toUpperCase()}]`);
    parts.push(`[${error.code}]`);
    parts.push(`[${error.category}]`);
    
    if (error.context.component) {
      parts.push(`[${error.context.component}]`);
    }
    
    if (error.context.function) {
      parts.push(`[${error.context.function}]`);
    }

    parts.push(`- ${error.userMessage}`);

    if (error.technicalDetails) {
      parts.push(`\n  Technical: ${error.technicalDetails}`);
    }

    if (error.context.file && error.context.line) {
      parts.push(`\n  Location: ${error.context.file}:${error.context.line}`);
    }

    if (error.correlationId) {
      parts.push(`\n  Correlation ID: ${error.correlationId}`);
    }

    if (error.causedBy) {
      parts.push(`\n  Caused by: [${error.causedBy.code}] ${error.causedBy.message}`);
    }

    if (this.config.includeStackTrace && error.metadata.stackTrace) {
      parts.push(`\n  Stack Trace:\n${error.metadata.stackTrace}`);
    }

    if (error.suggestions.length > 0) {
      parts.push(`\n  Suggestions:\n${error.suggestions.map(s => `    - ${s}`).join('\n')}`);
    }

    return parts.join(' ');
  }

  private async collectMetadata(error: ApplicationError): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      platform: process.platform,
      nodeVersion: process.version
    };

    if (this.config.includeSystemInfo && error.metadata.systemInfo) {
      metadata.system = error.metadata.systemInfo;
    }

    if (this.config.includeUserActions && error.metadata.userActions) {
      metadata.userActions = error.metadata.userActions.slice(-5); // Last 5 actions
    }

    if (error.metadata.performanceMetrics) {
      metadata.performance = error.metadata.performanceMetrics;
    }

    return metadata;
  }

  private shouldLog(error: ApplicationError): boolean {
    const severityLevels = {
      [ErrorSeverity.CRITICAL]: 5,
      [ErrorSeverity.HIGH]: 4,
      [ErrorSeverity.MEDIUM]: 3,
      [ErrorSeverity.LOW]: 2,
      [ErrorSeverity.INFO]: 1
    };

    return severityLevels[error.severity] >= severityLevels[this.config.level];
  }

  private async initializeLogFile(): Promise<void> {
    try {
      await fs.access(this.currentLogFile);
      const stats = await fs.stat(this.currentLogFile);
      
      // If file is too large, rotate it
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLog();
      }
    } catch {
      // File doesn't exist, which is fine for a new log file
    }

    this.writeStream = createWriteStream(this.currentLogFile, { flags: 'a' });
    this.writeStream.on('error', (error) => {
      this.emit('stream-error', error);
    });
  }

  private startBufferFlush(): void {
    this.bufferFlushInterval = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flushBuffer().catch(error => {
          console.error('Failed to flush log buffer:', error);
        });
      }
    }, 5000); // Flush every 5 seconds
  }

  private startRotationCheck(): void {
    this.rotationCheckInterval = setInterval(() => {
      this.checkForRotation().catch(error => {
        console.error('Failed to check for log rotation:', error);
      });
    }, 60000); // Check every minute
  }

  private async flushBuffer(): Promise<void> {
    if (!this.writeStream || this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer.length = 0;

    for (const entry of entries) {
      const logLine = `${entry.formatted}\n`;
      this.writeStream.write(logLine);
    }

    // Force flush to disk
    await new Promise<void>((resolve, reject) => {
      this.writeStream!.flush((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private async checkForRotation(): Promise<void> {
    if (!this.writeStream) return;

    try {
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLog();
      }
    } catch (error) {
      console.error('Failed to check log file size:', error);
    }
  }

  private async rotateLog(): Promise<void> {
    // Flush any remaining entries
    await this.flushBuffer();

    // Close current stream
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = undefined;
    }

    // Archive current log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivedFile = path.join(this.logDir, `error-${timestamp}.log`);
    
    try {
      await fs.rename(this.currentLogFile, archivedFile);
      this.emit('log-rotated', { archived: archivedFile, new: this.currentLogFile });
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }

    // Clean up old log files
    await this.cleanupOldLogFiles();

    // Initialize new log file
    await this.initializeLogFile();
  }

  private async cleanupOldLogFiles(): Promise<void> {
    try {
      const logFiles = await this.getLogFiles();
      const sortedFiles = logFiles
        .map(file => ({ file, stats: null as any }))
        .sort((a, b) => b.file.localeCompare(a.file)); // Sort by filename (which includes timestamp)

      // Keep only the configured number of files
      const filesToDelete = sortedFiles.slice(this.config.maxFiles);
      
      for (const { file } of filesToDelete) {
        try {
          await fs.unlink(file);
          this.emit('file-deleted', { file, reason: 'rotation-cleanup' });
        } catch (error) {
          console.error(`Failed to delete old log file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  private async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDir);
      return files
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(this.logDir, file));
    } catch {
      return [];
    }
  }

  private async queryLogFile(logFile: string, filters: ErrorLogQuery): Promise<ApplicationError[]> {
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const errors: ApplicationError[] = [];

      for (const line of lines) {
        try {
          if (this.config.format === 'json') {
            const logData = JSON.parse(line);
            const error = this.reconstructErrorFromLog(logData);
            if (error) {
              errors.push(error);
            }
          }
          // Text format parsing would be more complex and is not implemented here
        } catch (parseError) {
          // Skip invalid log lines
        }
      }

      return errors;
    } catch {
      return [];
    }
  }

  private reconstructErrorFromLog(logData: any): ApplicationError | null {
    try {
      return {
        id: logData.id,
        name: 'ApplicationError',
        message: logData.message,
        code: logData.code,
        severity: logData.level,
        category: logData.category,
        context: logData.context,
        timestamp: new Date(logData.timestamp).getTime(),
        correlationId: logData.correlationId,
        causedBy: logData.causedBy,
        metadata: {
          stackTrace: logData.stackTrace || '',
          userActions: logData.userActions || [],
          systemInfo: logData.systemInfo,
          performanceMetrics: logData.performanceMetrics
        },
        recoverable: logData.recoverable,
        userMessage: logData.message,
        technicalDetails: logData.technicalMessage || '',
        suggestions: logData.suggestions || []
      };
    } catch {
      return null;
    }
  }

  private applyFilters(errors: ApplicationError[], filters: ErrorLogQuery): ApplicationError[] {
    let filteredErrors = errors;

    if (filters.severity && filters.severity.length > 0) {
      filteredErrors = filteredErrors.filter(error => 
        filters.severity!.includes(error.severity)
      );
    }

    if (filters.category && filters.category.length > 0) {
      filteredErrors = filteredErrors.filter(error => 
        filters.category!.includes(error.category)
      );
    }

    if (filters.code && filters.code.length > 0) {
      filteredErrors = filteredErrors.filter(error => 
        filters.code!.includes(error.code)
      );
    }

    if (filters.timeRange) {
      filteredErrors = filteredErrors.filter(error => {
        const timestamp = new Date(error.timestamp);
        return timestamp >= filters.timeRange!.start && timestamp <= filters.timeRange!.end;
      });
    }

    if (filters.userId) {
      filteredErrors = filteredErrors.filter(error => 
        error.context.userId === filters.userId
      );
    }

    if (filters.investigationId) {
      filteredErrors = filteredErrors.filter(error => 
        error.context.investigationId === filters.investigationId
      );
    }

    if (filters.component) {
      filteredErrors = filteredErrors.filter(error => 
        error.context.component === filters.component
      );
    }

    // Apply sorting
    if (filters.sortBy) {
      filteredErrors.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (filters.sortBy) {
          case 'timestamp':
            aValue = a.timestamp;
            bValue = b.timestamp;
            break;
          case 'severity': {
            const severityOrder = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
            aValue = severityOrder[a.severity as keyof typeof severityOrder];
            bValue = severityOrder[b.severity as keyof typeof severityOrder];
            break;
          }
          case 'code':
            aValue = a.code;
            bValue = b.code;
            break;
          default:
            return 0;
        }

        if (filters.sortOrder === 'desc') {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
      });
    }

    // Apply pagination
    if (filters.offset || filters.limit) {
      const offset = filters.offset || 0;
      const limit = filters.limit || filteredErrors.length;
      filteredErrors = filteredErrors.slice(offset, offset + limit);
    }

    return filteredErrors;
  }

  public async getLogRotationInfo(): Promise<LogRotationInfo> {
    const logFiles = await this.getLogFiles();
    let totalSize = 0;

    for (const file of logFiles) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      } catch {
        // Skip files that can't be accessed
      }
    }

    return {
      currentFile: this.currentLogFile,
      archivedFiles: logFiles.filter(file => file !== this.currentLogFile),
      totalSize
    };
  }

  public updateConfiguration(config: Partial<ErrorConfiguration['logging']>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  public getConfiguration(): ErrorConfiguration['logging'] {
    return { ...this.config };
  }

  public async dispose(): Promise<void> {
    // Clear intervals
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = undefined;
    }

    if (this.rotationCheckInterval) {
      clearInterval(this.rotationCheckInterval);
      this.rotationCheckInterval = undefined;
    }

    // Flush remaining entries
    await this.flushBuffer();

    // Close stream
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = undefined;
    }

    this.removeAllListeners();
    this.isInitialized = false;
  }
}