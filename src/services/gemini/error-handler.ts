/**
 * Error Handler for Gemini API
 * Centralized error handling and recovery strategies
 */

import { ApiError } from './types';
import { logger } from '../../utils/logger';

export enum ErrorCode {
  // API Errors
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_SERVICE_ERROR = 'API_SERVICE_ERROR',
  
  // Media Errors
  MEDIA_TOO_LARGE = 'MEDIA_TOO_LARGE',
  MEDIA_FORMAT_UNSUPPORTED = 'MEDIA_FORMAT_UNSUPPORTED',
  MEDIA_PROCESSING_FAILED = 'MEDIA_PROCESSING_FAILED',
  MEDIA_CORRUPT = 'MEDIA_CORRUPT',
  
  // Safety Errors
  SAFETY_BLOCK = 'SAFETY_BLOCK',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  
  // Processing Errors
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  PARSING_FAILED = 'PARSING_FAILED',
  TIMEOUT = 'TIMEOUT',
  
  // System Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class GeminiError extends Error {
  code: ErrorCode;
  details?: any;
  timestamp: string;
  recoverable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details?: any,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.recoverable = recoverable;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

export class ErrorHandler {
  private retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  private maxRetries = 3;

  /**
   * Handle API errors
   */
  handleApiError(error: any): GeminiError {
    // Check for specific API error patterns
    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.response?.status || error.status;
    
    // API Key errors
    if (errorMessage.includes('api key') || statusCode === 401) {
      return new GeminiError(
        ErrorCode.API_KEY_INVALID,
        'Invalid or missing API key',
        { originalError: error.message },
        false
      );
    }
    
    // Rate limiting
    if (statusCode === 429 || errorMessage.includes('rate limit')) {
      const retryAfter = error.response?.headers?.['retry-after'];
      return new GeminiError(
        ErrorCode.API_RATE_LIMITED,
        'API rate limit exceeded',
        { retryAfter },
        true
      );
    }
    
    // Quota exceeded
    if (statusCode === 403 || errorMessage.includes('quota')) {
      return new GeminiError(
        ErrorCode.API_QUOTA_EXCEEDED,
        'API quota exceeded',
        { originalError: error.message },
        false
      );
    }
    
    // Service errors
    if (statusCode >= 500) {
      return new GeminiError(
        ErrorCode.API_SERVICE_ERROR,
        'Gemini service temporarily unavailable',
        { statusCode },
        true
      );
    }
    
    // Safety blocks
    if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
      return new GeminiError(
        ErrorCode.SAFETY_BLOCK,
        'Content blocked by safety filters',
        { filters: error.details },
        false
      );
    }
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return new GeminiError(
        ErrorCode.NETWORK_ERROR,
        'Network connection error',
        { originalError: error.message },
        true
      );
    }
    
    // Default
    return new GeminiError(
      ErrorCode.UNKNOWN_ERROR,
      error.message || 'An unknown error occurred',
      { originalError: error },
      false
    );
  }

  /**
   * Handle media processing errors
   */
  handleMediaError(error: any, filename?: string): GeminiError {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('size') || errorMessage.includes('large')) {
      return new GeminiError(
        ErrorCode.MEDIA_TOO_LARGE,
        `Media file too large: ${filename}`,
        { filename, error: error.message },
        false
      );
    }
    
    if (errorMessage.includes('format') || errorMessage.includes('unsupported')) {
      return new GeminiError(
        ErrorCode.MEDIA_FORMAT_UNSUPPORTED,
        `Unsupported media format: ${filename}`,
        { filename, error: error.message },
        false
      );
    }
    
    if (errorMessage.includes('corrupt') || errorMessage.includes('invalid')) {
      return new GeminiError(
        ErrorCode.MEDIA_CORRUPT,
        `Media file appears to be corrupt: ${filename}`,
        { filename, error: error.message },
        false
      );
    }
    
    return new GeminiError(
      ErrorCode.MEDIA_PROCESSING_FAILED,
      `Failed to process media: ${filename}`,
      { filename, error: error.message },
      false
    );
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const geminiError = this.handleApiError(error);
      
      if (!geminiError.recoverable || retryCount >= this.maxRetries) {
        throw geminiError;
      }
      
      const delay = this.retryDelays[Math.min(retryCount, this.retryDelays.length - 1)];
      logger.warn(`Retrying operation after ${delay}ms`, {
        attempt: retryCount + 1,
        maxRetries: this.maxRetries,
        error: geminiError.code
      });
      
      await this.sleep(delay);
      return this.retryWithBackoff(operation, retryCount + 1);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log and format error
   */
  logError(error: GeminiError | Error, context?: any): void {
    if (error instanceof GeminiError) {
      logger.error(`[${error.code}] ${error.message}`, {
        ...error.details,
        ...context,
        recoverable: error.recoverable
      });
    } else {
      logger.error(error.message, {
        stack: error.stack,
        ...context
      });
    }
  }

  /**
   * Create user-friendly error message
   */
  getUserMessage(error: GeminiError): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.API_KEY_MISSING]: 'Please configure your Gemini API key in settings.',
      [ErrorCode.API_KEY_INVALID]: 'Your Gemini API key appears to be invalid. Please check your settings.',
      [ErrorCode.API_QUOTA_EXCEEDED]: 'You have exceeded your Gemini API quota. Please upgrade your plan or wait for the quota to reset.',
      [ErrorCode.API_RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
      [ErrorCode.API_SERVICE_ERROR]: 'The Gemini service is temporarily unavailable. Please try again later.',
      [ErrorCode.MEDIA_TOO_LARGE]: 'The media file is too large. Please reduce the file size and try again.',
      [ErrorCode.MEDIA_FORMAT_UNSUPPORTED]: 'This media format is not supported. Please use a supported format.',
      [ErrorCode.MEDIA_PROCESSING_FAILED]: 'Failed to process the media file. Please ensure the file is not corrupted.',
      [ErrorCode.MEDIA_CORRUPT]: 'The media file appears to be corrupted or invalid.',
      [ErrorCode.SAFETY_BLOCK]: 'The content was blocked by safety filters. Please review the content and try again.',
      [ErrorCode.CONTENT_FILTERED]: 'The content was filtered due to policy violations.',
      [ErrorCode.ANALYSIS_FAILED]: 'Analysis failed. Please try again or contact support if the issue persists.',
      [ErrorCode.PARSING_FAILED]: 'Failed to parse the analysis results. Please try again.',
      [ErrorCode.TIMEOUT]: 'The operation timed out. Please try again with a smaller file or simpler analysis.',
      [ErrorCode.NETWORK_ERROR]: 'Network connection error. Please check your internet connection and try again.',
      [ErrorCode.STORAGE_ERROR]: 'Storage error. Please check available disk space.',
      [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again or contact support.'
    };
    
    return messages[error.code] || error.message;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: Error | GeminiError): boolean {
    if (error instanceof GeminiError) {
      return error.recoverable;
    }
    
    // Check for network-related errors that might be recoverable
    const message = error.message?.toLowerCase() || '';
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('temporary');
  }

  /**
   * Create error report for debugging
   */
  createErrorReport(error: GeminiError | Error, context?: any): string {
    const report = {
      timestamp: new Date().toISOString(),
      error: error instanceof GeminiError ? {
        code: error.code,
        message: error.message,
        details: error.details,
        recoverable: error.recoverable
      } : {
        message: error.message,
        stack: error.stack
      },
      context,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    return JSON.stringify(report, null, 2);
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();