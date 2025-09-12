// Global Error Management System for Professional Investigation Software
// Complete integration and initialization

export * from './types';
export { ErrorManager } from './ErrorManager';
export { CrashReporter } from './CrashReporter';
export { ErrorDialogManager, type ErrorDialogRenderer } from './ErrorDialogManager';
export { RecoveryManager } from './RecoveryManager';
export { ErrorLogger } from './ErrorLogger';
export { ErrorAnalytics } from './ErrorAnalytics';

import { ErrorManager } from './ErrorManager';
import { CrashReporter } from './CrashReporter';
import { ErrorDialogManager } from './ErrorDialogManager';
import { RecoveryManager } from './RecoveryManager';
import { ErrorLogger } from './ErrorLogger';
import { ErrorAnalytics } from './ErrorAnalytics';
import {
  ApplicationError,
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  ErrorConfiguration,
  ErrorFactory,
  ErrorTransformer,
  ErrorFilter,
  ErrorContext
} from './types';

export interface GlobalErrorSystemConfig {
  logDirectory?: string;
  crashReportsDirectory?: string;
  configuration?: Partial<ErrorConfiguration>;
  enableAnalytics?: boolean;
  enableCrashReporting?: boolean;
  enableDialogs?: boolean;
  enableRecovery?: boolean;
  enableLogging?: boolean;
}

export class GlobalErrorSystem {
  private static instance: GlobalErrorSystem;
  
  public readonly errorManager: ErrorManager;
  public readonly crashReporter: CrashReporter;
  public readonly dialogManager: ErrorDialogManager;
  public readonly recoveryManager: RecoveryManager;
  public readonly logger: ErrorLogger;
  public readonly analytics: ErrorAnalytics;
  
  private isInitialized = false;
  private config: GlobalErrorSystemConfig;

  private constructor(config: GlobalErrorSystemConfig = {}) {
    this.config = config;
    
    // Initialize all components
    this.errorManager = ErrorManager.getInstance();
    this.crashReporter = new CrashReporter(config.crashReportsDirectory);
    this.dialogManager = new ErrorDialogManager();
    this.recoveryManager = new RecoveryManager();
    this.logger = new ErrorLogger(config.logDirectory, config.configuration?.logging);
    this.analytics = new ErrorAnalytics();
    
    this.setupIntegrations();
  }

  public static getInstance(config?: GlobalErrorSystemConfig): GlobalErrorSystem {
    if (!GlobalErrorSystem.instance) {
      GlobalErrorSystem.instance = new GlobalErrorSystem(config);
    }
    return GlobalErrorSystem.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Global Error Management System...');

      // Initialize all components
      await this.errorManager.initialize(this.config.configuration);
      
      if (this.config.enableLogging !== false) {
        await this.logger.initialize();
        this.errorManager.setLogger(this.logger);
      }

      if (this.config.enableCrashReporting !== false) {
        await this.crashReporter.initialize();
        this.errorManager.setReporter(this.crashReporter);
      }

      if (this.config.enableAnalytics !== false) {
        this.analytics.setLogger(this.logger);
      }

      // Set up integrations between components
      this.setupErrorHandling();
      this.setupRecoveryStrategies();
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log('Global Error Management System initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Global Error Management System:', error);
      throw error;
    }
  }

  private setupIntegrations(): void {
    // Set up cross-component communication
    this.errorManager.setCollector(this.analytics);
    this.errorManager.setFilter(new DefaultErrorFilter());
    this.errorManager.setTransformer(new DefaultErrorTransformer());
    this.errorManager.setFactory(new DefaultErrorFactory());
  }

  private setupErrorHandling(): void {
    // Connect error manager to dialog manager
    this.errorManager.on('error:dialog:shown', (error, dialog) => {
      if (this.config.enableDialogs !== false) {
        this.dialogManager.showErrorDialog(error);
      }
    });

    // Connect error manager to analytics
    this.errorManager.on('error:occurred', (error) => {
      if (this.config.enableAnalytics !== false) {
        this.analytics.recordError(error);
      }
    });

    // Connect recovery manager to error manager
    this.errorManager.on('recovery:needed', async (error) => {
      if (this.config.enableRecovery !== false) {
        const recovered = await this.recoveryManager.attemptRecovery(error);
        this.errorManager.emit('recovery:completed', error, recovered);
      }
    });
  }

  private setupRecoveryStrategies(): void {
    // Register default recovery strategies
    this.recoveryManager.registerStrategy({
      code: ErrorCode.DATABASE_CONNECTION_FAILED,
      strategy: 'RESTART_COMPONENT',
      maxAttempts: 3,
      delayMs: 2000,
      condition: (error) => error.category === ErrorCategory.DATABASE,
      action: async (error) => {
        // Database reconnection logic would go here
        console.log(`Attempting to recover from database error: ${error.code}`);
        return true; // Placeholder
      }
    });

    this.recoveryManager.registerStrategy({
      code: ErrorCode.NETWORK_CONNECTION_LOST,
      strategy: 'RETRY',
      maxAttempts: 5,
      delayMs: 1000,
      condition: (error) => error.category === ErrorCategory.NETWORK,
      action: async (error) => {
        // Network reconnection logic would go here
        console.log(`Attempting to recover from network error: ${error.code}`);
        return false; // Will trigger fallback
      },
      fallbackAction: async (error) => {
        console.log(`Enabling offline mode due to network error: ${error.code}`);
      }
    });

    this.recoveryManager.registerStrategy({
      code: ErrorCode.SYSTEM_STARTUP_FAILED,
      strategy: 'RESTART_APPLICATION',
      maxAttempts: 1,
      delayMs: 0,
      condition: (error) => error.severity === ErrorSeverity.CRITICAL,
      action: async (error) => {
        console.log(`System requires restart due to: ${error.code}`);
        return true;
      }
    });
  }

  private setupEventHandlers(): void {
    // Recovery manager events
    this.recoveryManager.on('recovery:successful', (error, context) => {
      console.log(`Successfully recovered from error: ${error.code}`);
    });

    this.recoveryManager.on('recovery:failed', (error, context) => {
      console.log(`Failed to recover from error: ${error.code}, attempts: ${context.attemptNumber}`);
    });

    this.recoveryManager.on('restart:database-requested', (error) => {
      console.log('Database restart requested - implement restart logic');
    });

    this.recoveryManager.on('restart:network-requested', (error) => {
      console.log('Network restart requested - implement reconnection logic');
    });

    this.recoveryManager.on('restart:application-requested', (error, type) => {
      console.log(`Application restart requested (${type}) - implement restart logic`);
    });

    // Analytics events
    this.analytics.on('alert-triggered', (rule, metrics) => {
      console.log(`Analytics alert triggered: ${rule.name}`);
    });

    this.analytics.on('alert-notification', (data) => {
      console.log(`Analytics notification: ${data.message}`);
    });

    // Dialog manager events
    this.dialogManager.on('dialog:shown', (error, dialog) => {
      console.log(`Error dialog shown for: ${error.code}`);
    });

    this.dialogManager.on('action:retry', (error) => {
      console.log(`User requested retry for error: ${error.code}`);
      this.errorManager.handleError(error);
    });

    this.dialogManager.on('action:restart', (error) => {
      console.log(`User requested restart due to error: ${error.code}`);
    });

    this.dialogManager.on('action:send-report', (error) => {
      console.log(`User requested to send report for error: ${error.code}`);
      this.crashReporter.report(error);
    });
  }

  public async handleError(error: Error | ApplicationError): Promise<void> {
    return this.errorManager.handleError(error);
  }

  public async getAnalytics() {
    return this.analytics.getAnalytics();
  }

  public async generateReport(period: { start: Date; end: Date }) {
    return this.analytics.generateReport(period);
  }

  public getRecoveryStatistics() {
    return this.recoveryManager.getRecoveryStatistics();
  }

  public async cleanup(): Promise<void> {
    console.log('Shutting down Global Error Management System...');

    this.errorManager.dispose();
    this.recoveryManager.dispose();
    this.dialogManager.dispose();
    this.analytics.dispose();
    await this.crashReporter.cleanup();
    await this.logger.dispose();

    console.log('Global Error Management System shut down complete');
  }
}

// Default implementations for required interfaces
class DefaultErrorFilter implements ErrorFilter {
  shouldProcess(error: ApplicationError): boolean {
    return true; // Process all errors by default
  }

  shouldLog(error: ApplicationError): boolean {
    return error.severity !== ErrorSeverity.INFO; // Don't log info-level errors
  }

  shouldReport(error: ApplicationError): boolean {
    return error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH;
  }

  shouldNotify(error: ApplicationError): boolean {
    return error.severity === ErrorSeverity.CRITICAL || 
           error.severity === ErrorSeverity.HIGH || 
           error.severity === ErrorSeverity.MEDIUM;
  }
}

class DefaultErrorTransformer implements ErrorTransformer {
  transform(error: Error): ApplicationError {
    const context: ErrorContext = {
      component: 'unknown',
      function: 'unknown',
      file: 'unknown',
      operatingSystem: process.platform,
      electronVersion: process.versions.electron || 'unknown',
      appVersion: process.env.APP_VERSION || 'unknown',
      buildVersion: process.env.BUILD_VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: Date.now()
    };

    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: error.name,
      message: error.message,
      code: ErrorCode.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.SYSTEM,
      context,
      timestamp: Date.now(),
      metadata: {
        stackTrace: error.stack || 'No stack trace available'
      },
      recoverable: true,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: error.message,
      suggestions: ['Try refreshing the application', 'Contact support if the problem persists']
    };
  }

  enrich(error: ApplicationError): ApplicationError {
    return {
      ...error,
      context: {
        ...error.context,
        timestamp: Date.now()
      }
    };
  }
}

class DefaultErrorFactory implements ErrorFactory {
  create(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext>,
    cause?: Error
  ): ApplicationError {
    const fullContext: ErrorContext = {
      component: 'unknown',
      function: 'unknown',
      file: 'unknown',
      operatingSystem: process.platform,
      electronVersion: process.versions.electron || 'unknown',
      appVersion: process.env.APP_VERSION || 'unknown',
      buildVersion: process.env.BUILD_VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: Date.now(),
      ...context
    };

    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'ApplicationError',
      message,
      code,
      severity: this.getSeverityForCode(code),
      category: this.getCategoryForCode(code),
      context: fullContext,
      timestamp: Date.now(),
      causedBy: cause ? new DefaultErrorTransformer().transform(cause) : undefined,
      metadata: {
        stackTrace: cause?.stack || new Error().stack || 'No stack trace available'
      },
      recoverable: this.isRecoverable(code),
      userMessage: this.getUserMessage(code, message),
      technicalDetails: message,
      suggestions: this.getSuggestions(code)
    };
  }

  createSystem(message: string, context: Partial<ErrorContext>, cause?: Error): ApplicationError {
    return this.create(ErrorCode.SYSTEM_STARTUP_FAILED, message, context, cause);
  }

  createValidation(message: string, context: Partial<ErrorContext>): ApplicationError {
    return this.create(ErrorCode.DATA_VALIDATION_FAILED, message, context);
  }

  createNetwork(message: string, context: Partial<ErrorContext>): ApplicationError {
    return this.create(ErrorCode.NETWORK_CONNECTION_LOST, message, context);
  }

  createDatabase(message: string, context: Partial<ErrorContext>, cause?: Error): ApplicationError {
    return this.create(ErrorCode.DATABASE_CONNECTION_FAILED, message, context, cause);
  }

  createAuth(message: string, context: Partial<ErrorContext>): ApplicationError {
    return this.create(ErrorCode.AUTH_LOGIN_FAILED, message, context);
  }

  createFileSystem(message: string, context: Partial<ErrorContext>, cause?: Error): ApplicationError {
    return this.create(ErrorCode.FILE_NOT_FOUND, message, context, cause);
  }

  private getSeverityForCode(code: ErrorCode): ErrorSeverity {
    // Map error codes to severities
    if (code.startsWith('SYS_')) return ErrorSeverity.CRITICAL;
    if (code.startsWith('AUTH_')) return ErrorSeverity.HIGH;
    if (code.startsWith('NET_')) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.MEDIUM;
  }

  private getCategoryForCode(code: ErrorCode): ErrorCategory {
    if (code.startsWith('SYS_')) return ErrorCategory.SYSTEM;
    if (code.startsWith('AUTH_')) return ErrorCategory.AUTHENTICATION;
    if (code.startsWith('NET_')) return ErrorCategory.NETWORK;
    if (code.startsWith('DATA_')) return ErrorCategory.DATA_PROCESSING;
    if (code.startsWith('FILE_')) return ErrorCategory.FILE_SYSTEM;
    return ErrorCategory.SYSTEM;
  }

  private isRecoverable(code: ErrorCode): boolean {
    const unrecoverableCodes = [
      ErrorCode.SYSTEM_STARTUP_FAILED,
      ErrorCode.MEMORY_ALLOCATION_FAILED,
      ErrorCode.PROCESS_CRASHED
    ];
    return !unrecoverableCodes.includes(code);
  }

  private getUserMessage(code: ErrorCode, technicalMessage: string): string {
    const messageMap: Record<string, string> = {
      [ErrorCode.DATABASE_CONNECTION_FAILED]: 'Unable to connect to the database. Please check your connection.',
      [ErrorCode.NETWORK_CONNECTION_LOST]: 'Network connection lost. Please check your internet connection.',
      [ErrorCode.AUTH_LOGIN_FAILED]: 'Login failed. Please check your credentials.',
      [ErrorCode.FILE_NOT_FOUND]: 'The requested file could not be found.',
      [ErrorCode.SYSTEM_STARTUP_FAILED]: 'The application failed to start properly.'
    };
    
    return messageMap[code] || 'An error occurred while processing your request.';
  }

  private getSuggestions(code: ErrorCode): string[] {
    const suggestionMap: Record<string, string[]> = {
      [ErrorCode.DATABASE_CONNECTION_FAILED]: [
        'Check database connection settings',
        'Verify database server is running',
        'Contact system administrator'
      ],
      [ErrorCode.NETWORK_CONNECTION_LOST]: [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact network administrator if problem persists'
      ],
      [ErrorCode.AUTH_LOGIN_FAILED]: [
        'Verify your username and password',
        'Check if your account is locked',
        'Contact support for password reset'
      ]
    };
    
    return suggestionMap[code] || ['Try again', 'Contact support if problem persists'];
  }
}

// Convenience function for quick setup
export async function initializeErrorHandling(config?: GlobalErrorSystemConfig): Promise<GlobalErrorSystem> {
  const system = GlobalErrorSystem.getInstance(config);
  await system.initialize();
  
  // Set up global error handling
  if (typeof process !== 'undefined') {
    process.on('uncaughtException', (error) => {
      system.handleError(error);
    });
    
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      system.handleError(error);
    });
  }
  
  return system;
}