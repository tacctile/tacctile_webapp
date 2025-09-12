import { EventEmitter } from 'events';
import {
  ApplicationError,
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  ErrorHandler,
  ErrorHandlerResult,
  ErrorHandlerAction,
  ErrorRecoveryStrategy,
  RecoveryType,
  ErrorConfiguration,
  ErrorThreshold,
  ThresholdAction,
  ErrorCollector,
  ErrorReporter,
  ErrorLogger,
  ErrorFilter,
  ErrorTransformer,
  ErrorFactory,
  ErrorDialog,
  ErrorDialogType,
  ErrorAnalytics,
  CrashReport,
  ErrorEvents
} from './types';

export class ErrorManager extends EventEmitter {
  private static instance: ErrorManager;
  private handlers: ErrorHandler[] = [];
  private recoveryStrategies: Map<ErrorCode, ErrorRecoveryStrategy> = new Map();
  private thresholds: ErrorThreshold[] = [];
  private config: ErrorConfiguration;
  private logger?: ErrorLogger;
  private reporter?: ErrorReporter;
  private collector?: ErrorCollector;
  private filter?: ErrorFilter;
  private transformer?: ErrorTransformer;
  private factory?: ErrorFactory;
  private errorCounts: Map<string, { count: number; firstOccurrence: number; lastOccurrence: number }> = new Map();
  private isInitialized = false;
  private processingQueue: ApplicationError[] = [];
  private isProcessing = false;

  private constructor() {
    super();
    this.config = this.getDefaultConfiguration();
    this.setupUncaughtExceptionHandlers();
    this.setupUnhandledRejectionHandlers();
  }

  public static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  public async initialize(config?: Partial<ErrorConfiguration>): Promise<void> {
    if (this.isInitialized) {
      throw new Error('ErrorManager is already initialized');
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.isInitialized = true;
    this.emit('initialized', this.config);
  }

  public setLogger(logger: ErrorLogger): void {
    this.logger = logger;
  }

  public setReporter(reporter: ErrorReporter): void {
    this.reporter = reporter;
  }

  public setCollector(collector: ErrorCollector): void {
    this.collector = collector;
  }

  public setFilter(filter: ErrorFilter): void {
    this.filter = filter;
  }

  public setTransformer(transformer: ErrorTransformer): void {
    this.transformer = transformer;
  }

  public setFactory(factory: ErrorFactory): void {
    this.factory = factory;
  }

  public registerHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => b.priority - a.priority);
  }

  public unregisterHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  public registerRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.code, strategy);
  }

  public unregisterRecoveryStrategy(code: ErrorCode): void {
    this.recoveryStrategies.delete(code);
  }

  public addThreshold(threshold: ErrorThreshold): void {
    this.thresholds.push(threshold);
  }

  public removeThreshold(threshold: ErrorThreshold): void {
    const index = this.thresholds.indexOf(threshold);
    if (index > -1) {
      this.thresholds.splice(index, 1);
    }
  }

  public async handleError(error: Error | ApplicationError): Promise<ErrorHandlerResult> {
    try {
      let appError: ApplicationError;

      if (this.isApplicationError(error)) {
        appError = error;
      } else {
        if (!this.transformer) {
          throw new Error('ErrorTransformer not set - cannot transform native Error to ApplicationError');
        }
        appError = this.transformer.transform(error);
      }

      this.emit('error:occurred', appError);

      if (this.filter && !this.filter.shouldProcess(appError)) {
        return {
          handled: false,
          recovered: false,
          userNotified: false,
          logged: false,
          reported: false
        };
      }

      this.processingQueue.push(appError);
      return await this.processErrorQueue();

    } catch (processingError) {
      console.error('Critical error in error handling system:', processingError);
      return {
        handled: false,
        recovered: false,
        userNotified: false,
        logged: false,
        reported: false,
        nextAction: ErrorHandlerAction.SHUTDOWN
      };
    }
  }

  private async processErrorQueue(): Promise<ErrorHandlerResult> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return {
        handled: false,
        recovered: false,
        userNotified: false,
        logged: false,
        reported: false
      };
    }

    this.isProcessing = true;
    const error = this.processingQueue.shift()!;
    let result: ErrorHandlerResult;

    try {
      this.updateErrorCounts(error);
      this.checkThresholds(error);

      result = await this.processError(error);

      if (result.handled) {
        this.emit('error:handled', error, result);
      }

      if (result.recovered) {
        this.emit('error:recovered', error);
      }

    } catch (processingError) {
      console.error('Error during error processing:', processingError);
      result = {
        handled: false,
        recovered: false,
        userNotified: false,
        logged: false,
        reported: false,
        nextAction: ErrorHandlerAction.SHUTDOWN
      };
    } finally {
      this.isProcessing = false;
      
      if (this.processingQueue.length > 0) {
        setImmediate(() => this.processErrorQueue());
      }
    }

    return result;
  }

  private async processError(error: ApplicationError): Promise<ErrorHandlerResult> {
    const result: ErrorHandlerResult = {
      handled: false,
      recovered: false,
      userNotified: false,
      logged: false,
      reported: false
    };

    try {
      for (const handler of this.handlers) {
        if (handler.canHandle(error)) {
          const handlerResult = await handler.handle(error);
          
          result.handled = result.handled || handlerResult.handled;
          result.recovered = result.recovered || handlerResult.recovered;
          result.userNotified = result.userNotified || handlerResult.userNotified;
          result.logged = result.logged || handlerResult.logged;
          result.reported = result.reported || handlerResult.reported;

          if (handlerResult.nextAction) {
            result.nextAction = handlerResult.nextAction;
          }

          if (handlerResult.handled) {
            break;
          }
        }
      }

      if (!result.recovered) {
        const recovered = await this.attemptRecovery(error);
        result.recovered = recovered;
      }

      if (!result.logged && this.shouldLog(error)) {
        await this.logError(error);
        result.logged = true;
      }

      if (!result.reported && this.shouldReport(error)) {
        await this.reportError(error);
        result.reported = true;
      }

      if (!result.userNotified && this.shouldNotifyUser(error)) {
        await this.notifyUser(error);
        result.userNotified = true;
      }

      await this.executeNextAction(result.nextAction, error);

    } catch (processingError) {
      console.error('Error during error processing:', processingError);
      result.nextAction = ErrorHandlerAction.SHUTDOWN;
    }

    return result;
  }

  private async attemptRecovery(error: ApplicationError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.code);
    if (!strategy) return false;

    if (strategy.condition && !strategy.condition(error)) {
      return false;
    }

    let attempt = 0;
    while (attempt < strategy.maxAttempts) {
      try {
        const recovered = await strategy.action(error);
        if (recovered) {
          return true;
        }
      } catch (recoveryError) {
        console.warn(`Recovery attempt ${attempt + 1} failed:`, recoveryError);
      }

      attempt++;
      if (attempt < strategy.maxAttempts) {
        await this.delay(strategy.delayMs);
      }
    }

    if (strategy.fallbackAction) {
      try {
        await strategy.fallbackAction(error);
      } catch (fallbackError) {
        console.error('Fallback action failed:', fallbackError);
      }
    }

    return false;
  }

  private async executeNextAction(action: ErrorHandlerAction | undefined, error: ApplicationError): Promise<void> {
    if (!action) return;

    switch (action) {
      case ErrorHandlerAction.CONTINUE:
        break;
      case ErrorHandlerAction.RETRY:
        setTimeout(() => {
          this.handleError(error);
        }, 1000);
        break;
      case ErrorHandlerAction.RESTART:
        this.emit('restart-required', error);
        break;
      case ErrorHandlerAction.SHUTDOWN:
        this.emit('shutdown-required', error);
        break;
      case ErrorHandlerAction.SAFE_MODE:
        this.emit('safe-mode-required', error);
        break;
      case ErrorHandlerAction.USER_INTERVENTION:
        this.emit('user-intervention-required', error);
        break;
    }
  }

  private updateErrorCounts(error: ApplicationError): void {
    const key = `${error.code}-${error.category}`;
    const now = Date.now();
    
    if (this.errorCounts.has(key)) {
      const count = this.errorCounts.get(key)!;
      count.count++;
      count.lastOccurrence = now;
    } else {
      this.errorCounts.set(key, {
        count: 1,
        firstOccurrence: now,
        lastOccurrence: now
      });
    }
  }

  private checkThresholds(error: ApplicationError): void {
    const applicableThresholds = this.thresholds.filter(t => 
      t.category === error.category && t.severity === error.severity
    );

    for (const threshold of applicableThresholds) {
      const key = `${error.code}-${error.category}`;
      const errorCount = this.errorCounts.get(key);
      
      if (errorCount && errorCount.count >= threshold.count) {
        const timeWindow = Date.now() - threshold.timeWindow;
        if (errorCount.firstOccurrence >= timeWindow) {
          this.executeThresholdAction(threshold, error);
        }
      }
    }
  }

  private executeThresholdAction(threshold: ErrorThreshold, error: ApplicationError): void {
    this.emit('error:threshold:exceeded', threshold, [error]);

    switch (threshold.action) {
      case ThresholdAction.LOG_WARNING:
        console.warn(`Error threshold exceeded for ${threshold.category}/${threshold.severity}`);
        break;
      case ThresholdAction.SEND_NOTIFICATION:
        this.emit('notification-required', { threshold, error });
        break;
      case ThresholdAction.ENABLE_SAFE_MODE:
        this.emit('safe-mode-required', error);
        break;
      case ThresholdAction.RESTART_COMPONENT:
        this.emit('restart-component-required', { threshold, error });
        break;
      case ThresholdAction.SHUTDOWN_APPLICATION:
        this.emit('shutdown-required', error);
        break;
    }
  }

  private shouldLog(error: ApplicationError): boolean {
    if (!this.config.logging.enabled) return false;
    if (!this.logger) return false;
    if (this.filter && !this.filter.shouldLog(error)) return false;
    
    const severityLevels = {
      [ErrorSeverity.CRITICAL]: 5,
      [ErrorSeverity.HIGH]: 4,
      [ErrorSeverity.MEDIUM]: 3,
      [ErrorSeverity.LOW]: 2,
      [ErrorSeverity.INFO]: 1
    };

    return severityLevels[error.severity] >= severityLevels[this.config.logging.level];
  }

  private shouldReport(error: ApplicationError): boolean {
    if (!this.config.reporting.enabled) return false;
    if (!this.reporter) return false;
    if (this.filter && !this.filter.shouldReport(error)) return false;
    
    return error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH;
  }

  private shouldNotifyUser(error: ApplicationError): boolean {
    if (!this.config.dialogs.enabled) return false;
    if (this.filter && !this.filter.shouldNotify(error)) return false;
    
    return error.severity === ErrorSeverity.CRITICAL || 
           error.severity === ErrorSeverity.HIGH || 
           error.severity === ErrorSeverity.MEDIUM;
  }

  private async logError(error: ApplicationError): Promise<void> {
    if (this.logger) {
      try {
        await this.logger.log(error);
      } catch (loggingError) {
        console.error('Failed to log error:', loggingError);
      }
    }
  }

  private async reportError(error: ApplicationError): Promise<void> {
    if (this.reporter) {
      try {
        const reportId = await this.reporter.report(error);
        this.emit('error:reported', error, reportId);
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }
  }

  private async notifyUser(error: ApplicationError): Promise<void> {
    const dialog = this.createErrorDialog(error);
    this.emit('error:dialog:shown', error, dialog);
  }

  private createErrorDialog(error: ApplicationError): ErrorDialog {
    return {
      type: this.getDialogType(error.severity),
      title: this.getDialogTitle(error),
      message: error.userMessage,
      details: this.config.dialogs.showTechnicalDetails ? error.technicalDetails : undefined,
      actions: this.getDialogActions(error),
      allowClose: true,
      autoClose: this.config.dialogs.autoClose ? this.config.dialogs.autoCloseDelay : undefined,
      modal: error.severity === ErrorSeverity.CRITICAL,
      persistent: error.severity === ErrorSeverity.CRITICAL
    };
  }

  private getDialogType(severity: ErrorSeverity): ErrorDialogType {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return ErrorDialogType.CRITICAL;
      case ErrorSeverity.HIGH:
        return ErrorDialogType.ERROR;
      case ErrorSeverity.MEDIUM:
        return ErrorDialogType.WARNING;
      default:
        return ErrorDialogType.ERROR;
    }
  }

  private getDialogTitle(error: ApplicationError): string {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 'Critical Error';
      case ErrorSeverity.HIGH:
        return 'Error';
      case ErrorSeverity.MEDIUM:
        return 'Warning';
      default:
        return 'Notice';
    }
  }

  private getDialogActions(error: ApplicationError): any[] {
    const actions = [];

    if (error.recoverable) {
      actions.push({
        id: 'retry',
        label: 'Retry',
        action: () => this.handleError(error),
        style: 'primary'
      });
    }

    if (error.suggestions.length > 0) {
      actions.push({
        id: 'suggestions',
        label: 'Show Suggestions',
        action: () => this.emit('show-suggestions', error.suggestions),
        style: 'secondary'
      });
    }

    if (this.config.dialogs.allowUserReporting) {
      actions.push({
        id: 'report',
        label: 'Report Issue',
        action: () => this.emit('user-report-requested', error),
        style: 'secondary'
      });
    }

    actions.push({
      id: 'close',
      label: 'Close',
      action: () => this.emit('error:dialog:closed', error, 'close'),
      style: 'secondary'
    });

    return actions;
  }

  private setupUncaughtExceptionHandlers(): void {
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      this.handleError(error).then(result => {
        if (result.nextAction === ErrorHandlerAction.SHUTDOWN) {
          process.exit(1);
        }
      });
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      console.error('Unhandled Rejection at:', promise, 'reason:', error);
      this.handleError(error);
    });
  }

  private setupUnhandledRejectionHandlers(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleError(event.error || new Error(event.message));
      });

      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        this.handleError(error);
      });
    }
  }

  private isApplicationError(error: any): error is ApplicationError {
    return error && typeof error === 'object' && 
           'id' in error && 'code' in error && 'severity' in error && 'category' in error;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getDefaultConfiguration(): ErrorConfiguration {
    return {
      logging: {
        enabled: true,
        level: ErrorSeverity.MEDIUM,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        format: 'json',
        includeStackTrace: true,
        includeUserActions: true,
        includeSystemInfo: true
      },
      reporting: {
        enabled: false,
        includePersonalData: false,
        batchSize: 10,
        retryAttempts: 3,
        reportingInterval: 300000 // 5 minutes
      },
      recovery: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        fallbackMode: true,
        safeMode: true
      },
      dialogs: {
        enabled: true,
        showTechnicalDetails: false,
        allowUserReporting: true,
        autoClose: false,
        autoCloseDelay: 5000
      },
      analytics: {
        enabled: true,
        retentionDays: 30,
        aggregationInterval: 3600000 // 1 hour
      }
    };
  }

  public getConfiguration(): ErrorConfiguration {
    return { ...this.config };
  }

  public updateConfiguration(config: Partial<ErrorConfiguration>): void {
    this.config = { ...this.config, ...config };
  }

  public async getAnalytics(): Promise<ErrorAnalytics> {
    const totalErrors = Array.from(this.errorCounts.values())
      .reduce((sum, count) => sum + count.count, 0);

    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};

    for (const [key, count] of this.errorCounts) {
      const [code, category] = key.split('-');
      errorsByCategory[category] = (errorsByCategory[category] || 0) + count.count;
      errorsByCode[code] = (errorsByCode[code] || 0) + count.count;
    }

    const topErrors = Array.from(this.errorCounts.entries())
      .map(([key, count]) => ({
        code: key.split('-')[0] as ErrorCode,
        count: count.count,
        lastOccurrence: new Date(count.lastOccurrence)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors,
      errorsByCategory: errorsByCategory as Record<ErrorCategory, number>,
      errorsBySeverity: errorsBySeverity as Record<ErrorSeverity, number>,
      errorsByCode: errorsByCode as Record<ErrorCode, number>,
      topErrors,
      errorTrends: [],
      meanTimeToResolution: 0,
      recoveryRate: 0,
      crashRate: 0,
      userAffectedCount: 0
    };
  }

  public dispose(): void {
    this.handlers.length = 0;
    this.recoveryStrategies.clear();
    this.thresholds.length = 0;
    this.errorCounts.clear();
    this.processingQueue.length = 0;
    this.removeAllListeners();
  }
}