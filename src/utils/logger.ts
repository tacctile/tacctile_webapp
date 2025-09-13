/**
 * Logger Utility
 * Centralized logging for the application
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;
  private enableApiLogging: boolean;
  private context?: string;

  constructor(context?: string) {
    this.level = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
    this.enableApiLogging = process.env.ENABLE_API_LOGGING === 'true';
    this.context = context;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? ` [${this.context}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}]${contextStr} ${message}${dataStr}`;
  }

  error(message: string, error?: any): void {
    if (this.level >= LogLevel.ERROR) {
      const errorData = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error;
      console.error(this.formatMessage('ERROR', message, errorData));
    }
  }

  warn(message: string, data?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  debug(message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  api(message: string, data?: any): void {
    if (this.enableApiLogging) {
      console.log(this.formatMessage('API', message, data));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setApiLogging(enabled: boolean): void {
    this.enableApiLogging = enabled;
  }
}

export { Logger };
export const logger = new Logger();