/**
 * Gemini Service Module
 * Main export point for all Gemini AI integration
 */

// Export main services
export { geminiClient } from './client';
export { anomalyDetector } from './anomaly-detector';
export { mediaProcessor } from './media-processor';
export { errorHandler, GeminiError, ErrorCode } from './error-handler';

// Export types
export * from './types';

// Export utilities
export { RateLimiter } from './rate-limiter';
export { ResponseCache } from './cache';

// Re-export commonly used functions
import { geminiClient } from './client';
import { anomalyDetector } from './anomaly-detector';
import { mediaProcessor } from './media-processor';
import { errorHandler } from './error-handler';
import { AnalysisType, ProcessingOptions, MediaMetadata } from './types';

/**
 * Quick analysis function for simple use cases
 */
export async function analyzeEvidence(
  filePath: string,
  options?: {
    analysisType?: AnalysisType;
    enhance?: boolean;
    metadata?: MediaMetadata;
  }
) {
  try {
    const result = await anomalyDetector.analyzeFile(
      filePath,
      [options?.analysisType || AnalysisType.GENERAL_ANOMALY],
      {
        processingOptions: {
          enhanceImage: options?.enhance,
          denoise: options?.enhance
        },
        metadata: options?.metadata
      }
    );
    
    return {
      success: true,
      result
    };
  } catch (error) {
    const geminiError = errorHandler.handleApiError(error);
    errorHandler.logError(geminiError);
    
    return {
      success: false,
      error: errorHandler.getUserMessage(geminiError)
    };
  }
}

/**
 * Initialize Gemini service
 */
export async function initializeGemini(apiKey?: string): Promise<boolean> {
  try {
    if (apiKey) {
      geminiClient.updateConfig({ apiKey });
    }
    
    await geminiClient.initialize();
    return true;
  } catch (error) {
    const geminiError = errorHandler.handleApiError(error);
    errorHandler.logError(geminiError, { action: 'initialization' });
    return false;
  }
}

/**
 * Get service status
 */
export function getServiceStatus() {
  const stats = geminiClient.getUsageStats();
  const session = anomalyDetector.getCurrentSession();
  
  return {
    initialized: true, // Will be updated based on actual initialization
    rateLimits: stats.rateLimits,
    cache: stats.cacheStats,
    activeSession: session,
    supportedFormats: mediaProcessor.getSupportedFormats()
  };
}

/**
 * Default export with all services
 */
export default {
  client: geminiClient,
  detector: anomalyDetector,
  processor: mediaProcessor,
  errorHandler,
  analyzeEvidence,
  initializeGemini,
  getServiceStatus
};