import { EventEmitter } from 'events';
import {
  ApplicationError,
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  RecoveryType,
  ErrorHandlerResult,
  ErrorHandlerAction
} from './types';

export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  execute: (error: ApplicationError) => Promise<boolean>;
  canExecute: (error: ApplicationError) => boolean;
  priority: number;
  maxAttempts: number;
  delayMs: number;
  timeout?: number;
}

export interface RecoveryContext {
  error: ApplicationError;
  attemptNumber: number;
  totalAttempts: number;
  previousResults: boolean[];
  startTime: number;
  lastAttemptTime: number;
}

export class RecoveryManager extends EventEmitter {
  private strategies: Map<ErrorCode, ErrorRecoveryStrategy> = new Map();
  private recoveryActions: Map<RecoveryType, RecoveryAction[]> = new Map();
  private activeRecoveries: Map<string, RecoveryContext> = new Map();
  private recoveryHistory: Map<string, RecoveryContext[]> = new Map();
  private maxConcurrentRecoveries = 5;
  private globalTimeout = 30000; // 30 seconds

  constructor() {
    super();
    this.initializeDefaultActions();
  }

  public registerStrategy(strategy: ErrorRecoveryStrategy): void {
    this.strategies.set(strategy.code, strategy);
    this.emit('strategy:registered', strategy);
  }

  public unregisterStrategy(code: ErrorCode): void {
    this.strategies.delete(code);
    this.emit('strategy:unregistered', code);
  }

  public registerAction(type: RecoveryType, action: RecoveryAction): void {
    if (!this.recoveryActions.has(type)) {
      this.recoveryActions.set(type, []);
    }
    
    this.recoveryActions.get(type)!.push(action);
    this.recoveryActions.get(type)!.sort((a, b) => b.priority - a.priority);
    this.emit('action:registered', type, action);
  }

  public unregisterAction(type: RecoveryType, actionId: string): void {
    const actions = this.recoveryActions.get(type);
    if (actions) {
      const index = actions.findIndex(a => a.id === actionId);
      if (index > -1) {
        actions.splice(index, 1);
        this.emit('action:unregistered', type, actionId);
      }
    }
  }

  public async attemptRecovery(error: ApplicationError): Promise<boolean> {
    const strategy = this.strategies.get(error.code);
    if (!strategy) {
      this.emit('recovery:no-strategy', error);
      return false;
    }

    if (strategy.condition && !strategy.condition(error)) {
      this.emit('recovery:condition-failed', error, strategy);
      return false;
    }

    const recoveryId = this.generateRecoveryId(error);
    
    if (this.activeRecoveries.size >= this.maxConcurrentRecoveries) {
      this.emit('recovery:queue-full', error);
      return false;
    }

    const context: RecoveryContext = {
      error,
      attemptNumber: 0,
      totalAttempts: strategy.maxAttempts,
      previousResults: [],
      startTime: Date.now(),
      lastAttemptTime: 0
    };

    this.activeRecoveries.set(recoveryId, context);
    this.emit('recovery:started', error, context);

    try {
      const recovered = await this.executeRecoveryStrategy(strategy, context);
      
      this.recordRecoveryHistory(recoveryId, context);
      this.activeRecoveries.delete(recoveryId);
      
      if (recovered) {
        this.emit('recovery:successful', error, context);
      } else {
        this.emit('recovery:failed', error, context);
        await this.executeFallbackAction(strategy, error);
      }

      return recovered;

    } catch (recoveryError) {
      console.error('Recovery process error:', recoveryError);
      this.activeRecoveries.delete(recoveryId);
      this.emit('recovery:error', error, recoveryError);
      return false;
    }
  }

  private async executeRecoveryStrategy(
    strategy: ErrorRecoveryStrategy, 
    context: RecoveryContext
  ): Promise<boolean> {
    while (context.attemptNumber < context.totalAttempts) {
      context.attemptNumber++;
      context.lastAttemptTime = Date.now();

      this.emit('recovery:attempt', context.error, context.attemptNumber, context.totalAttempts);

      try {
        // Check global timeout
        if (Date.now() - context.startTime > this.globalTimeout) {
          this.emit('recovery:timeout', context.error, context);
          break;
        }

        const recovered = await this.executeWithTimeout(
          () => strategy.action(context.error),
          this.globalTimeout - (Date.now() - context.startTime)
        );

        context.previousResults.push(recovered);

        if (recovered) {
          this.emit('recovery:attempt-success', context.error, context.attemptNumber);
          return true;
        }

        this.emit('recovery:attempt-failed', context.error, context.attemptNumber);

        // Wait before next attempt (if not the last attempt)
        if (context.attemptNumber < context.totalAttempts) {
          await this.delay(strategy.delayMs);
        }

      } catch (attemptError) {
        console.error(`Recovery attempt ${context.attemptNumber} error:`, attemptError);
        context.previousResults.push(false);
        this.emit('recovery:attempt-error', context.error, context.attemptNumber, attemptError);
      }
    }

    return false;
  }

  private async executeFallbackAction(
    strategy: ErrorRecoveryStrategy, 
    error: ApplicationError
  ): Promise<void> {
    if (!strategy.fallbackAction) return;

    this.emit('recovery:fallback-started', error);

    try {
      await strategy.fallbackAction(error);
      this.emit('recovery:fallback-completed', error);
    } catch (fallbackError) {
      console.error('Fallback action failed:', fallbackError);
      this.emit('recovery:fallback-failed', error, fallbackError);
    }
  }

  private initializeDefaultActions(): void {
    // Retry actions
    this.registerAction(RecoveryType.RETRY, {
      id: 'simple-retry',
      name: 'Simple Retry',
      description: 'Retry the failed operation',
      execute: async (error: ApplicationError) => {
        // This would need to be implemented based on the specific error context
        // For now, return false to indicate retry should be handled by the original caller
        return false;
      },
      canExecute: (error: ApplicationError) => error.recoverable,
      priority: 1,
      maxAttempts: 3,
      delayMs: 1000
    });

    // Component restart actions
    this.registerAction(RecoveryType.RESTART_COMPONENT, {
      id: 'restart-database-connection',
      name: 'Restart Database Connection',
      description: 'Restart the database connection',
      execute: async (error: ApplicationError) => {
        if (error.category === ErrorCategory.DATABASE) {
          try {
            this.emit('restart:database-requested', error);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      },
      canExecute: (error: ApplicationError) => error.category === ErrorCategory.DATABASE,
      priority: 5,
      maxAttempts: 1,
      delayMs: 2000,
      timeout: 10000
    });

    this.registerAction(RecoveryType.RESTART_COMPONENT, {
      id: 'restart-network-service',
      name: 'Restart Network Service',
      description: 'Restart network connections',
      execute: async (error: ApplicationError) => {
        if (error.category === ErrorCategory.NETWORK) {
          try {
            this.emit('restart:network-requested', error);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      },
      canExecute: (error: ApplicationError) => error.category === ErrorCategory.NETWORK,
      priority: 5,
      maxAttempts: 1,
      delayMs: 1000,
      timeout: 5000
    });

    // Application restart actions
    this.registerAction(RecoveryType.RESTART_APPLICATION, {
      id: 'graceful-restart',
      name: 'Graceful Application Restart',
      description: 'Perform a graceful application restart',
      execute: async (error: ApplicationError) => {
        this.emit('restart:application-requested', error, 'graceful');
        return true;
      },
      canExecute: (error: ApplicationError) => 
        error.severity === ErrorSeverity.CRITICAL ||
        error.category === ErrorCategory.SYSTEM,
      priority: 10,
      maxAttempts: 1,
      delayMs: 0,
      timeout: 30000
    });

    // Safe mode actions
    this.registerAction(RecoveryType.SAFE_MODE, {
      id: 'enable-safe-mode',
      name: 'Enable Safe Mode',
      description: 'Start application in safe mode with limited functionality',
      execute: async (error: ApplicationError) => {
        this.emit('safe-mode:enable-requested', error);
        return true;
      },
      canExecute: (error: ApplicationError) => 
        error.severity === ErrorSeverity.CRITICAL ||
        error.category === ErrorCategory.SYSTEM,
      priority: 8,
      maxAttempts: 1,
      delayMs: 0
    });

    // Fallback mode actions
    this.registerAction(RecoveryType.FALLBACK_MODE, {
      id: 'enable-offline-mode',
      name: 'Enable Offline Mode',
      description: 'Switch to offline mode when network issues occur',
      execute: async (error: ApplicationError) => {
        if (error.category === ErrorCategory.NETWORK) {
          this.emit('fallback:offline-mode-requested', error);
          return true;
        }
        return false;
      },
      canExecute: (error: ApplicationError) => error.category === ErrorCategory.NETWORK,
      priority: 6,
      maxAttempts: 1,
      delayMs: 0
    });

    this.registerAction(RecoveryType.FALLBACK_MODE, {
      id: 'readonly-mode',
      name: 'Enable Read-Only Mode',
      description: 'Switch to read-only mode when database issues occur',
      execute: async (error: ApplicationError) => {
        if (error.category === ErrorCategory.DATABASE) {
          this.emit('fallback:readonly-mode-requested', error);
          return true;
        }
        return false;
      },
      canExecute: (error: ApplicationError) => error.category === ErrorCategory.DATABASE,
      priority: 6,
      maxAttempts: 1,
      delayMs: 0
    });

    // Data recovery actions
    this.registerAction(RecoveryType.DATA_RECOVERY, {
      id: 'restore-from-backup',
      name: 'Restore from Backup',
      description: 'Restore data from the most recent backup',
      execute: async (error: ApplicationError) => {
        if (error.category === ErrorCategory.DATABASE || 
            error.category === ErrorCategory.FILE_SYSTEM) {
          this.emit('data-recovery:restore-backup-requested', error);
          return true;
        }
        return false;
      },
      canExecute: (error: ApplicationError) => 
        error.category === ErrorCategory.DATABASE ||
        error.category === ErrorCategory.FILE_SYSTEM,
      priority: 7,
      maxAttempts: 1,
      delayMs: 0,
      timeout: 60000
    });

    // User intervention actions
    this.registerAction(RecoveryType.USER_INTERVENTION, {
      id: 'request-user-action',
      name: 'Request User Action',
      description: 'Ask user to manually resolve the issue',
      execute: async (error: ApplicationError) => {
        this.emit('user-intervention:requested', error);
        return true;
      },
      canExecute: () => true,
      priority: 1,
      maxAttempts: 1,
      delayMs: 0
    });
  }

  private generateRecoveryId(error: ApplicationError): string {
    return `recovery_${error.id}_${Date.now()}`;
  }

  private recordRecoveryHistory(recoveryId: string, context: RecoveryContext): void {
    const errorKey = `${context.error.code}_${context.error.category}`;
    
    if (!this.recoveryHistory.has(errorKey)) {
      this.recoveryHistory.set(errorKey, []);
    }

    const history = this.recoveryHistory.get(errorKey)!;
    history.push({ ...context });

    // Keep only last 10 recovery attempts per error type
    if (history.length > 10) {
      history.shift();
    }
  }

  private async executeWithTimeout<T>(
    action: () => Promise<T>, 
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Recovery action timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      action()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getRecoveryStatistics(): {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    activeRecoveries: number;
    averageRecoveryTime: number;
    recoveriesByType: Record<ErrorCategory, number>;
    successRateByType: Record<ErrorCategory, number>;
  } {
    let totalRecoveries = 0;
    let successfulRecoveries = 0;
    let totalRecoveryTime = 0;
    const recoveriesByType: Record<string, number> = {};
    const successByType: Record<string, number> = {};

    for (const [errorType, history] of this.recoveryHistory) {
      const [, category] = errorType.split('_');
      
      recoveriesByType[category] = (recoveriesByType[category] || 0) + history.length;
      
      for (const context of history) {
        totalRecoveries++;
        totalRecoveryTime += Date.now() - context.startTime;
        
        const wasSuccessful = context.previousResults.some(result => result === true);
        if (wasSuccessful) {
          successfulRecoveries++;
          successByType[category] = (successByType[category] || 0) + 1;
        }
      }
    }

    const successRateByType: Record<ErrorCategory, number> = {};
    for (const category of Object.keys(recoveriesByType)) {
      const total = recoveriesByType[category];
      const successful = successByType[category] || 0;
      successRateByType[category as ErrorCategory] = total > 0 ? successful / total : 0;
    }

    return {
      totalRecoveries,
      successfulRecoveries,
      failedRecoveries: totalRecoveries - successfulRecoveries,
      activeRecoveries: this.activeRecoveries.size,
      averageRecoveryTime: totalRecoveries > 0 ? totalRecoveryTime / totalRecoveries : 0,
      recoveriesByType: recoveriesByType as Record<ErrorCategory, number>,
      successRateByType
    };
  }

  public getActiveRecoveries(): RecoveryContext[] {
    return Array.from(this.activeRecoveries.values());
  }

  public cancelRecovery(recoveryId: string): boolean {
    if (this.activeRecoveries.has(recoveryId)) {
      const context = this.activeRecoveries.get(recoveryId)!;
      this.activeRecoveries.delete(recoveryId);
      this.emit('recovery:cancelled', context.error, context);
      return true;
    }
    return false;
  }

  public cancelAllRecoveries(): void {
    const activeRecoveries = Array.from(this.activeRecoveries.keys());
    for (const recoveryId of activeRecoveries) {
      this.cancelRecovery(recoveryId);
    }
  }

  public setMaxConcurrentRecoveries(max: number): void {
    this.maxConcurrentRecoveries = Math.max(1, max);
  }

  public setGlobalTimeout(timeoutMs: number): void {
    this.globalTimeout = Math.max(1000, timeoutMs);
  }

  public dispose(): void {
    this.cancelAllRecoveries();
    this.strategies.clear();
    this.recoveryActions.clear();
    this.recoveryHistory.clear();
    this.removeAllListeners();
  }
}