import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { 
  CrashReport, 
  ApplicationError, 
  UserAction, 
  ErrorReporter,
  ErrorReportStatus
} from './types';

export class CrashReporter extends EventEmitter implements ErrorReporter {
  private crashReportsPath: string;
  private isElectronMain: boolean;
  private lastUserActions: UserAction[] = [];
  private maxUserActions = 50;
  private crashCounter = 0;

  constructor(crashReportsPath = './crash-reports') {
    super();
    this.crashReportsPath = crashReportsPath;
    this.isElectronMain = this.detectElectronMain();
    this.setupUserActionTracking();
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.crashReportsPath, { recursive: true });
      await this.setupCrashHandlers();
      await this.cleanupOldReports();
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async report(error: ApplicationError): Promise<string> {
    const crashReport = await this.createCrashReport(error);
    await this.saveCrashReport(crashReport);
    
    this.emit('crash:detected', crashReport);
    
    // Try to send to remote endpoint if configured
    try {
      await this.sendCrashReport(crashReport);
      this.emit('crash:reported', crashReport);
    } catch (reportingError) {
      console.warn('Failed to send crash report to remote endpoint:', reportingError);
    }

    return crashReport.id;
  }

  public async reportBatch(errors: ApplicationError[]): Promise<string[]> {
    const reportIds: string[] = [];
    for (const error of errors) {
      try {
        const reportId = await this.report(error);
        reportIds.push(reportId);
      } catch (error) {
        console.error('Failed to report error in batch:', error);
      }
    }
    return reportIds;
  }

  public async getReportStatus(reportId: string): Promise<ErrorReportStatus> {
    try {
      const reportPath = path.join(this.crashReportsPath, `${reportId}.json`);
      await fs.access(reportPath);
      return ErrorReportStatus.NEW;
    } catch {
      return ErrorReportStatus.RESOLVED;
    }
  }

  public trackUserAction(action: string, component: string, details: Record<string, unknown> = {}): void {
    const userAction: UserAction = {
      timestamp: Date.now(),
      action,
      component,
      details
    };

    this.lastUserActions.push(userAction);
    
    if (this.lastUserActions.length > this.maxUserActions) {
      this.lastUserActions.shift();
    }
  }

  private async createCrashReport(error: ApplicationError): Promise<CrashReport> {
    const timestamp = Date.now();
    const crashId = `crash_${timestamp}_${++this.crashCounter}`;

    const systemMetrics = await this.collectSystemMetrics();

    const crashReport: CrashReport = {
      id: crashId,
      timestamp,
      appVersion: process.env.APP_VERSION || 'unknown',
      electronVersion: process.versions.electron || 'unknown',
      platform: os.platform(),
      architecture: os.arch(),
      processType: this.getProcessType(),
      exitCode: process.exitCode || undefined,
      signal: undefined, // Will be set by signal handlers
      crashDump: await this.generateCrashDump(error),
      minidump: await this.generateMinidump(),
      error,
      lastUserActions: [...this.lastUserActions],
      systemMetrics,
      reproduced: false,
      reported: false,
      analyzed: false
    };

    return crashReport;
  }

  private async saveCrashReport(crashReport: CrashReport): Promise<string> {
    const filename = `${crashReport.id}.json`;
    const filepath = path.join(this.crashReportsPath, filename);

    try {
      const reportData = JSON.stringify(crashReport, null, 2);
      await fs.writeFile(filepath, reportData, 'utf8');
      return filepath;
    } catch (error) {
      console.error('Failed to save crash report:', error);
      throw error;
    }
  }

  private async sendCrashReport(crashReport: CrashReport): Promise<void> {
    const endpoint = process.env.CRASH_REPORT_ENDPOINT;
    if (!endpoint) {
      return;
    }

    const apiKey = process.env.CRASH_REPORT_API_KEY;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: crashReport.id,
          timestamp: crashReport.timestamp,
          appVersion: crashReport.appVersion,
          platform: crashReport.platform,
          error: {
            code: crashReport.error?.code,
            message: crashReport.error?.userMessage,
            severity: crashReport.error?.severity,
            category: crashReport.error?.category,
            stackTrace: crashReport.error?.metadata.stackTrace
          },
          systemMetrics: crashReport.systemMetrics,
          userActions: crashReport.lastUserActions.slice(-10) // Send last 10 actions only
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send crash report to remote endpoint:', error);
      throw error;
    }
  }

  private async collectSystemMetrics(): Promise<CrashReport['systemMetrics']> {
    const memoryUsage = process.memoryUsage();

    return {
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: await this.getCPUUsage(),
      diskSpace: await this.getDiskSpace(),
      processes: (await this.getProcessCount())
    };
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        const cpuPercent = ((endUsage.user + endUsage.system) / 1000) / elapsedTime * 100;
        resolve(Math.round(cpuPercent * 100) / 100);
      }, 100);
    });
  }

  private async getDiskSpace(): Promise<number> {
    try {
      const stats = await fs.stat(process.cwd());
      return stats.size / 1024 / 1024 / 1024; // GB
    } catch {
      return 0;
    }
  }

  private async getProcessCount(): Promise<number> {
    try {
      if (os.platform() === 'win32') {
        // Windows process count estimation
        return 100; // Placeholder
      } else {
        // Unix-like systems
        const processes = await fs.readdir('/proc');
        return processes.filter(name => /^\d+$/.test(name)).length;
      }
    } catch {
      return 0;
    }
  }

  private getProcessInfo(): Record<string, unknown> {
    return {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      versions: process.versions,
      execPath: process.execPath,
      execArgv: process.execArgv,
      argv: process.argv,
      env: this.sanitizeEnvironment(),
      cwd: process.cwd(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  private sanitizeEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth'];
    
    for (const [key, value] of Object.entries(process.env)) {
      if (value && !sensitiveKeys.some(sensitive => 
        key.toLowerCase().includes(sensitive))) {
        env[key] = value;
      } else {
        env[key] = '[REDACTED]';
      }
    }
    
    return env;
  }

  private async generateCrashDump(error: ApplicationError): Promise<string> {
    const dump = {
      timestamp: Date.now(),
      error: {
        id: error.id,
        code: error.code,
        message: error.message,
        severity: error.severity,
        category: error.category,
        context: error.context,
        metadata: error.metadata,
        stackTrace: error.metadata.stackTrace
      },
      process: this.getProcessInfo(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        version: os.version(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus(),
        networkInterfaces: os.networkInterfaces()
      },
      modules: Object.keys(require.cache || {}),
      userActions: this.lastUserActions
    };

    return JSON.stringify(dump, null, 2);
  }

  private async generateMinidump(): Promise<string | undefined> {
    // Minidump generation would require native modules
    // For now, return a placeholder
    return undefined;
  }

  private getProcessType(): 'main' | 'renderer' | 'worker' {
    if (typeof window !== 'undefined') {
      return 'renderer';
    }
    
    if (process.env.ELECTRON_IS_MAIN === 'true' || this.isElectronMain) {
      return 'main';
    }

    return 'worker';
  }

  private detectElectronMain(): boolean {
    try {
      return process.type === 'browser' || 
             Object.prototype.hasOwnProperty.call(process.versions, 'electron') &&
             process.type !== 'renderer';
    } catch {
      return false;
    }
  }

  private async setupCrashHandlers(): Promise<void> {
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error, origin: string) => {
      console.error('Uncaught Exception:', error, 'Origin:', origin);
      
      try {
        if (error instanceof Error) {
          await this.handleProcessCrash(error, { origin, exitCode: 1 });
        }
      } catch (reportingError) {
        console.error('Failed to report uncaught exception:', reportingError);
      }
      
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      try {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        await this.handleProcessCrash(error, { origin: 'unhandledRejection' });
      } catch (reportingError) {
        console.error('Failed to report unhandled rejection:', reportingError);
      }
    });

    // Handle process signals
    ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach(signal => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, graceful shutdown...`);
        
        try {
          await this.handleProcessShutdown(signal);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
        }
        
        process.exit(0);
      });
    });

    // Handle Electron main process crashes
    if (this.isElectronMain) {
      try {
        const { app } = await import('electron');
        
        app.on('child-process-gone', (event, details) => {
          console.error('Child process gone:', details);
          this.handleElectronProcessCrash('child-process-gone', details);
        });

        app.on('render-process-gone', (event, webContents, details) => {
          console.error('Render process gone:', details);
          this.handleElectronProcessCrash('render-process-gone', details);
        });
      } catch (error) {
        // Electron not available or not in main process
      }
    }
  }

  private setupUserActionTracking(): void {
    if (typeof window !== 'undefined') {
      // Browser/renderer environment
      
      // Track clicks
      window.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        this.trackUserAction('click', 'browser', {
          tagName: target?.tagName,
          className: target?.className,
          id: target?.id,
          textContent: target?.textContent?.substring(0, 100)
        });
      });

      // Track navigation
      window.addEventListener('popstate', (event) => {
        this.trackUserAction('navigation', 'browser', {
          url: window.location.href,
          state: event.state
        });
      });

      // Track errors
      window.addEventListener('error', (event) => {
        this.trackUserAction('javascript-error', 'browser', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      // Track keyboard shortcuts
      window.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) {
          this.trackUserAction('keyboard-shortcut', 'browser', {
            key: event.key,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey
          });
        }
      });
    }
  }

  private async handleProcessCrash(error: Error, details: Record<string, unknown>): Promise<void> {
    try {
      // Create a basic ApplicationError from native Error
      const appError: Partial<ApplicationError> = {
        id: `crash_${Date.now()}`,
        message: error.message,
        metadata: {
          stackTrace: error.stack || 'No stack trace available'
        }
      };

      const crashReport = await this.createCrashReport(appError as ApplicationError);
      crashReport.exitCode = details.exitCode;
      
      await this.saveCrashReport(crashReport);
      this.emit('crash:detected', crashReport);
      
    } catch (reportingError) {
      console.error('Failed to handle process crash:', reportingError);
    }
  }

  private async handleProcessShutdown(signal: string): Promise<void> {
    this.trackUserAction('process-shutdown', 'system', { signal });
    
    try {
      await this.cleanup();
    } catch (error) {
      console.error('Error during shutdown cleanup:', error);
    }
  }

  private handleElectronProcessCrash(type: string, details: Record<string, unknown>): void {
    this.trackUserAction('electron-process-crash', 'electron', { type, details });
  }

  private async cleanupOldReports(): Promise<void> {
    try {
      const files = await fs.readdir(this.crashReportsPath);
      const now = Date.now();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.crashReportsPath, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old reports:', error);
    }
  }

  public async cleanup(): Promise<void> {
    this.removeAllListeners();
    await this.cleanupOldReports();
  }

  public async getCrashReports(): Promise<CrashReport[]> {
    try {
      const files = await fs.readdir(this.crashReportsPath);
      const reports: CrashReport[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.crashReportsPath, file);
          const data = await fs.readFile(filePath, 'utf8');
          const report = JSON.parse(data) as CrashReport;
          reports.push(report);
        }
      }

      return reports.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get crash reports:', error);
      return [];
    }
  }

  public async deleteCrashReport(reportId: string): Promise<void> {
    const filePath = path.join(this.crashReportsPath, `${reportId}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete crash report:', error);
      throw error;
    }
  }
}