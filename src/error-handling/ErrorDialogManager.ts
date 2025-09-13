import { EventEmitter } from 'events';
import {
  ApplicationError,
  ErrorDialog,
  ErrorDialogType,
  ErrorDialogAction,
  ErrorSeverity
} from './types';

export interface ErrorDialogRenderer {
  showDialog(dialog: ErrorDialog): Promise<string | null>;
  hideDialog(dialogId: string): Promise<void>;
  updateDialog(dialogId: string, updates: Partial<ErrorDialog>): Promise<void>;
}

export class ErrorDialogManager extends EventEmitter {
  private renderer?: ErrorDialogRenderer;
  private activeDialogs: Map<string, { dialog: ErrorDialog; error: ApplicationError }> = new Map();
  private dialogQueue: Array<{ dialog: ErrorDialog; error: ApplicationError }> = [];
  private maxConcurrentDialogs = 3;
  private dialogCounter = 0;

  constructor() {
    super();
  }

  public setRenderer(renderer: ErrorDialogRenderer): void {
    this.renderer = renderer;
  }

  public async showErrorDialog(error: ApplicationError): Promise<void> {
    if (!this.renderer) {
      console.error('ErrorDialogRenderer not set - cannot show error dialog');
      return;
    }

    const dialog = this.createErrorDialog(error);
    
    if (this.activeDialogs.size >= this.maxConcurrentDialogs) {
      this.dialogQueue.push({ dialog, error });
      return;
    }

    await this.displayDialog(dialog, error);
  }

  private async displayDialog(dialog: ErrorDialog, error: ApplicationError): Promise<void> {
    const dialogId = this.generateDialogId();
    dialog.actions = dialog.actions.map(action => ({
      ...action,
      action: this.wrapActionCallback(action, dialogId, error)
    }));

    this.activeDialogs.set(dialogId, { dialog, error });
    this.emit('dialog:shown', error, dialog);

    try {
      const result = await this.renderer!.showDialog(dialog);
      this.handleDialogResult(dialogId, result, error);
    } catch (displayError) {
      console.error('Failed to display error dialog:', displayError);
      this.activeDialogs.delete(dialogId);
      this.processQueue();
    }

    if (dialog.autoClose) {
      setTimeout(() => {
        this.closeDialog(dialogId, 'auto-close');
      }, dialog.autoClose);
    }
  }

  private wrapActionCallback(
    action: ErrorDialogAction, 
    dialogId: string, 
    error: ApplicationError
  ): ErrorDialogAction {
    const originalAction = action.action;
    
    return {
      ...action,
      action: async () => {
        this.emit('dialog:action', error, action.id);
        
        if (originalAction) {
          try {
            await originalAction();
          } catch (actionError) {
            console.error('Error dialog action failed:', actionError);
          }
        }
        
        if (action.id !== 'close' && action.id !== 'dismiss') {
          this.closeDialog(dialogId, action.id);
        }
      }
    };
  }

  private handleDialogResult(dialogId: string, result: string | null, error: ApplicationError): void {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    this.emit('dialog:closed', error, result);
    this.activeDialogs.delete(dialogId);
    this.processQueue();
  }

  private async closeDialog(dialogId: string, actionId: string): Promise<void> {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    try {
      if (this.renderer) {
        await this.renderer.hideDialog(dialogId);
      }
    } catch (error) {
      console.error('Failed to hide dialog:', error);
    }

    this.handleDialogResult(dialogId, actionId, dialogData.error);
  }

  private processQueue(): void {
    if (this.dialogQueue.length === 0 || this.activeDialogs.size >= this.maxConcurrentDialogs) {
      return;
    }

    const nextDialog = this.dialogQueue.shift();
    if (nextDialog) {
      this.displayDialog(nextDialog.dialog, nextDialog.error);
    }
  }

  private createErrorDialog(error: ApplicationError): ErrorDialog {
    return {
      type: this.getDialogType(error.severity),
      title: this.getDialogTitle(error),
      message: this.formatUserMessage(error),
      details: this.formatTechnicalDetails(error),
      actions: this.createDialogActions(error),
      icon: this.getDialogIcon(error.severity),
      allowClose: !this.isCriticalError(error),
      autoClose: this.shouldAutoClose(error) ? 10000 : undefined,
      modal: this.shouldBeModal(error),
      persistent: this.isCriticalError(error)
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
      case ErrorSeverity.LOW:
        return ErrorDialogType.WARNING;
      case ErrorSeverity.INFO:
        return ErrorDialogType.CONFIRMATION;
      default:
        return ErrorDialogType.ERROR;
    }
  }

  private getDialogTitle(error: ApplicationError): string {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 'Critical System Error';
      case ErrorSeverity.HIGH:
        return 'Error Occurred';
      case ErrorSeverity.MEDIUM:
        return 'Warning';
      case ErrorSeverity.LOW:
        return 'Notice';
      case ErrorSeverity.INFO:
        return 'Information';
      default:
        return 'Error';
    }
  }

  private formatUserMessage(error: ApplicationError): string {
    let message = error.userMessage;

    // Add context if it helps user understanding
    if (error.context.component && error.context.function) {
      message += `\n\nLocation: ${error.context.component} (${error.context.function})`;
    }

    // Add correlation ID for support
    if (error.correlationId) {
      message += `\n\nReference ID: ${error.correlationId}`;
    }

    return message;
  }

  private formatTechnicalDetails(error: ApplicationError): string {
    const details: string[] = [];

    details.push(`Error Code: ${error.code}`);
    details.push(`Category: ${error.category}`);
    details.push(`Severity: ${error.severity}`);
    details.push(`Timestamp: ${new Date(error.timestamp).toLocaleString()}`);

    if (error.context.file && error.context.line) {
      details.push(`File: ${error.context.file}:${error.context.line}`);
    }

    if (error.causedBy) {
      details.push(`Caused by: ${error.causedBy.message}`);
    }

    if (error.technicalDetails) {
      details.push(`Details: ${error.technicalDetails}`);
    }

    if (error.metadata.stackTrace) {
      details.push(`\nStack Trace:\n${error.metadata.stackTrace}`);
    }

    return details.join('\n');
  }

  private createDialogActions(error: ApplicationError): ErrorDialogAction[] {
    const actions: ErrorDialogAction[] = [];

    // Primary actions based on error properties
    if (error.recoverable) {
      actions.push({
        id: 'retry',
        label: 'Try Again',
        action: () => this.emit('action:retry', error),
        style: 'primary'
      });
    }

    // Show suggestions if available
    if (error.suggestions.length > 0) {
      actions.push({
        id: 'suggestions',
        label: 'Show Help',
        action: () => this.showSuggestions(error),
        style: 'secondary'
      });
    }

    // Restart action for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      actions.push({
        id: 'restart',
        label: 'Restart Application',
        action: () => this.emit('action:restart', error),
        style: 'warning'
      });
    }

    // Report issue action
    actions.push({
      id: 'report',
      label: 'Report Issue',
      action: () => this.showReportDialog(error),
      style: 'secondary'
    });

    // Details toggle
    actions.push({
      id: 'details',
      label: 'Show Details',
      action: () => this.toggleDetails(error),
      style: 'secondary'
    });

    // Close/dismiss action
    if (!this.isCriticalError(error)) {
      actions.push({
        id: 'close',
        label: 'Close',
        action: () => this.emit('action:close', error),
        style: 'secondary'
      });
    } else {
      actions.push({
        id: 'acknowledge',
        label: 'I Understand',
        action: () => this.emit('action:acknowledge', error),
        style: 'danger'
      });
    }

    return actions;
  }

  private getDialogIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'critical-error';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.INFO:
        return 'info';
      default:
        return 'error';
    }
  }

  private isCriticalError(error: ApplicationError): boolean {
    return error.severity === ErrorSeverity.CRITICAL;
  }

  private shouldAutoClose(error: ApplicationError): boolean {
    return error.severity === ErrorSeverity.LOW || error.severity === ErrorSeverity.INFO;
  }

  private shouldBeModal(error: ApplicationError): boolean {
    return error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH;
  }

  private async showSuggestions(error: ApplicationError): Promise<void> {
    const suggestionsDialog: ErrorDialog = {
      type: ErrorDialogType.CONFIRMATION,
      title: 'Suggested Solutions',
      message: 'Here are some ways to resolve this issue:',
      details: error.suggestions.map((suggestion, index) => 
        `${index + 1}. ${suggestion}`
      ).join('\n'),
      actions: [
        {
          id: 'try-suggestion',
          label: 'Try Suggestion',
          action: () => this.emit('action:try-suggestion', error),
          style: 'primary'
        },
        {
          id: 'close',
          label: 'Close',
          action: () => {
            // Close action - handled by dialog system
            console.debug('Warning dialog closed');
          },
          style: 'secondary'
        }
      ],
      allowClose: true,
      modal: false,
      persistent: false
    };

    if (this.renderer) {
      await this.renderer.showDialog(suggestionsDialog);
    }
  }

  private async showReportDialog(error: ApplicationError): Promise<void> {
    const reportDialog: ErrorDialog = {
      type: ErrorDialogType.CONFIRMATION,
      title: 'Report Issue',
      message: 'Help us improve by reporting this issue. No personal information will be sent.',
      details: `Error: ${error.code}\nComponent: ${error.context.component}\nTimestamp: ${new Date(error.timestamp).toLocaleString()}`,
      actions: [
        {
          id: 'send-report',
          label: 'Send Report',
          action: () => this.sendErrorReport(error),
          style: 'primary'
        },
        {
          id: 'copy-details',
          label: 'Copy Details',
          action: () => this.copyErrorDetails(error),
          style: 'secondary'
        },
        {
          id: 'cancel',
          label: 'Cancel',
          action: () => {
            // Cancel action - handled by dialog system
            console.debug('Error dialog canceled');
          },
          style: 'secondary'
        }
      ],
      allowClose: true,
      modal: true,
      persistent: false
    };

    if (this.renderer) {
      await this.renderer.showDialog(reportDialog);
    }
  }

  private async sendErrorReport(error: ApplicationError): Promise<void> {
    try {
      this.emit('action:send-report', error);
      
      // Show success message
      const successDialog: ErrorDialog = {
        type: ErrorDialogType.CONFIRMATION,
        title: 'Report Sent',
        message: 'Thank you for reporting this issue. We will investigate and work on a fix.',
        actions: [
          {
            id: 'ok',
            label: 'OK',
            action: () => {
              // OK action - close confirmation
              console.debug('Report confirmation acknowledged');
            },
            style: 'primary'
          }
        ],
        allowClose: true,
        autoClose: 3000,
        modal: false,
        persistent: false
      };

      if (this.renderer) {
        await this.renderer.showDialog(successDialog);
      }
      
    } catch (reportError) {
      console.error('Failed to send error report:', reportError);
      
      // Show error message
      const errorDialog: ErrorDialog = {
        type: ErrorDialogType.ERROR,
        title: 'Report Failed',
        message: 'Failed to send the error report. Please try again later.',
        actions: [
          {
            id: 'ok',
            label: 'OK',
            action: () => {
              // OK action - close error dialog
              console.debug('Report error acknowledged');
            },
            style: 'primary'
          }
        ],
        allowClose: true,
        modal: false,
        persistent: false
      };

      if (this.renderer) {
        await this.renderer.showDialog(errorDialog);
      }
    }
  }

  private async copyErrorDetails(error: ApplicationError): Promise<void> {
    const details = this.formatTechnicalDetails(error);
    
    try {
      // Try to copy to clipboard
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(details);
      } else if (typeof window !== 'undefined') {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = details;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      this.emit('action:copy-details', error);
      
    } catch (copyError) {
      console.error('Failed to copy error details:', copyError);
    }
  }

  private async toggleDetails(error: ApplicationError): Promise<void> {
    this.emit('action:toggle-details', error);
  }

  private generateDialogId(): string {
    return `dialog_${Date.now()}_${++this.dialogCounter}`;
  }

  public closeAllDialogs(): Promise<void[]> {
    const closePromises: Promise<void>[] = [];

    for (const [dialogId] of this.activeDialogs) {
      closePromises.push(this.closeDialog(dialogId, 'forced-close'));
    }

    this.dialogQueue.length = 0;
    return Promise.all(closePromises);
  }

  public getActiveDialogCount(): number {
    return this.activeDialogs.size;
  }

  public getQueuedDialogCount(): number {
    return this.dialogQueue.length;
  }

  public setMaxConcurrentDialogs(max: number): void {
    this.maxConcurrentDialogs = Math.max(1, max);
    this.processQueue();
  }

  public dispose(): void {
    this.closeAllDialogs();
    this.removeAllListeners();
  }
}