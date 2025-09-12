/**
 * Google Gemini API Client
 * Handles all interactions with the Gemini Flash model
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerativeModel, Part } from '@google/generative-ai';
import { GeminiConfig, GeminiResponse, MediaFile, AnalysisType, SafetySettings } from './types';
import { logger } from '../../utils/logger';
import { RateLimiter } from './rate-limiter';
import { ResponseCache } from './cache';

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private config: GeminiConfig;
  private rateLimiter: RateLimiter;
  private cache: ResponseCache;
  private initialized: boolean = false;

  constructor(config?: Partial<GeminiConfig>) {
    this.config = this.loadConfig(config);
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: this.config.requestsPerMinute,
      requestsPerDay: this.config.requestsPerDay
    });
    this.cache = new ResponseCache(this.config.cacheTTL);
  }

  /**
   * Load configuration from environment variables and defaults
   */
  private loadConfig(overrides?: Partial<GeminiConfig>): GeminiConfig {
    const defaultConfig: GeminiConfig = {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '8192'),
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
      topP: parseFloat(process.env.GEMINI_TOP_P || '0.95'),
      topK: parseInt(process.env.GEMINI_TOP_K || '40'),
      safetySettings: this.loadSafetySettings(),
      requestsPerMinute: parseInt(process.env.GEMINI_REQUESTS_PER_MINUTE || '60'),
      requestsPerDay: parseInt(process.env.GEMINI_REQUESTS_PER_DAY || '1500'),
      enableCache: process.env.ENABLE_RESPONSE_CACHE === 'true',
      cacheTTL: parseInt(process.env.CACHE_TTL_SECONDS || '3600')
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Load safety settings from environment
   */
  private loadSafetySettings(): SafetySettings[] {
    return [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: this.parseSafetyThreshold(process.env.GEMINI_SAFETY_HARASSMENT)
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: this.parseSafetyThreshold(process.env.GEMINI_SAFETY_HATE_SPEECH)
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: this.parseSafetyThreshold(process.env.GEMINI_SAFETY_SEXUALLY_EXPLICIT)
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: this.parseSafetyThreshold(process.env.GEMINI_SAFETY_DANGEROUS_CONTENT)
      }
    ];
  }

  /**
   * Parse safety threshold from string
   */
  private parseSafetyThreshold(value?: string): HarmBlockThreshold {
    const thresholdMap: Record<string, HarmBlockThreshold> = {
      'BLOCK_NONE': HarmBlockThreshold.BLOCK_NONE,
      'BLOCK_LOW_AND_ABOVE': HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      'BLOCK_MEDIUM_AND_ABOVE': HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      'BLOCK_HIGH_AND_ABOVE': HarmBlockThreshold.BLOCK_ONLY_HIGH
    };
    
    return thresholdMap[value || ''] || HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
  }

  /**
   * Initialize the Gemini client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.apiKey) {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY environment variable.');
    }

    try {
      this.genAI = new GoogleGenerativeAI(this.config.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          maxOutputTokens: this.config.maxOutputTokens,
          temperature: this.config.temperature,
          topP: this.config.topP,
          topK: this.config.topK
        },
        safetySettings: this.config.safetySettings
      });

      this.initialized = true;
      logger.info('Gemini client initialized successfully', { model: this.config.model });
    } catch (error) {
      logger.error('Failed to initialize Gemini client', error);
      throw new Error(`Gemini initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze media file for paranormal anomalies
   */
  async analyzeMedia(
    file: MediaFile,
    analysisType: AnalysisType,
    customPrompt?: string
  ): Promise<GeminiResponse> {
    await this.initialize();

    // Check cache first
    const cacheKey = this.getCacheKey(file, analysisType, customPrompt);
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached response', { cacheKey });
        return cached;
      }
    }

    // Rate limiting
    await this.rateLimiter.waitForSlot();

    try {
      const prompt = this.buildPrompt(analysisType, customPrompt);
      const parts = await this.prepareMediaParts(file);
      
      logger.info('Sending media to Gemini for analysis', {
        type: analysisType,
        mimeType: file.mimeType,
        size: file.size
      });

      const result = await this.model.generateContent([prompt, ...parts]);
      const response = await result.response;
      
      const geminiResponse: GeminiResponse = {
        text: response.text(),
        analysisType,
        timestamp: new Date().toISOString(),
        metadata: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
          finishReason: response.candidates?.[0]?.finishReason
        },
        safety: response.candidates?.[0]?.safetyRatings
      };

      // Cache the response
      if (this.config.enableCache) {
        this.cache.set(cacheKey, geminiResponse);
      }

      logger.info('Media analysis completed', { 
        analysisType,
        tokensUsed: geminiResponse.metadata.totalTokens 
      });

      return geminiResponse;
    } catch (error) {
      logger.error('Media analysis failed', error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  /**
   * Build analysis prompt based on type
   */
  private buildPrompt(analysisType: AnalysisType, customPrompt?: string): string {
    const basePrompts: Record<AnalysisType, string> = {
      [AnalysisType.GENERAL_ANOMALY]: `
        Analyze this media file for potential paranormal anomalies. Look for:
        1. Unexplained objects, shapes, or figures
        2. Unusual light phenomena (orbs, mists, apparitions)
        3. Shadow figures or dark masses
        4. Face or figure pareidolia patterns
        5. Motion blur or camera artifacts that could be misinterpreted
        6. Environmental anomalies (temperature variations visible as condensation, etc.)
        
        Provide a detailed analysis with:
        - Identified anomalies and their locations
        - Confidence level for each finding (low/medium/high)
        - Scientific explanations for observed phenomena
        - Paranormal interpretation possibilities
        - Recommendations for further investigation
      `,
      
      [AnalysisType.EVP_ANALYSIS]: `
        Analyze this audio recording for potential Electronic Voice Phenomena (EVP). Focus on:
        1. Unexplained voices or whispers
        2. Words or phrases that appear in silence
        3. Frequency anomalies or unusual patterns
        4. Background sounds that could be interpreted as communication
        5. Audio artifacts vs genuine anomalies
        
        Provide:
        - Timestamp markers for interesting segments
        - Transcription of any detected voices or words
        - Classification (Class A/B/C EVP)
        - Audio quality assessment
        - Alternative explanations (interference, pareidolia, etc.)
      `,
      
      [AnalysisType.VISUAL_SPECTRUM]: `
        Analyze this image for visual spectrum anomalies:
        1. Infrared or ultraviolet spectrum indicators
        2. Heat signatures or cold spots
        3. Energy fields or auras
        4. Electromagnetic interference patterns
        5. Light spectrum anomalies
        
        Detail:
        - Spectrum analysis findings
        - Energy pattern identification
        - Temperature variation indicators
        - Recommendations for spectrum-specific equipment
      `,
      
      [AnalysisType.PATTERN_RECOGNITION]: `
        Perform pattern recognition analysis on this media:
        1. Recurring shapes or symbols
        2. Mathematical or geometric patterns
        3. Face or figure detection
        4. Movement patterns in video
        5. Temporal patterns or repetitions
        
        Include:
        - Identified patterns with coordinates/timestamps
        - Pattern significance analysis
        - Statistical probability of natural occurrence
        - Historical or symbolic pattern matches
      `,
      
      [AnalysisType.ENVIRONMENTAL_CONTEXT]: `
        Analyze environmental context and conditions:
        1. Environmental factors affecting the recording
        2. Weather or atmospheric conditions visible
        3. Structural or architectural elements
        4. Natural vs artificial light sources
        5. Background elements that provide context
        
        Assess:
        - Environmental impact on potential phenomena
        - Baseline vs anomalous conditions
        - External factors that could cause false positives
        - Optimal conditions for paranormal activity
      `,
      
      [AnalysisType.COMPARATIVE_ANALYSIS]: `
        Perform comparative analysis:
        1. Compare with known paranormal evidence patterns
        2. Identify similarities with documented cases
        3. Assess uniqueness of captured phenomena
        4. Cross-reference with historical data
        
        Provide:
        - Similarity scores with known phenomena
        - Unique characteristics identified
        - Classification within paranormal taxonomy
        - Evidence strength assessment
      `
    };

    const basePrompt = basePrompts[analysisType];
    
    if (customPrompt) {
      return `${basePrompt}\n\nAdditional Analysis Request:\n${customPrompt}`;
    }
    
    return basePrompt;
  }

  /**
   * Prepare media parts for Gemini API
   */
  private async prepareMediaParts(file: MediaFile): Promise<Part[]> {
    const parts: Part[] = [];

    // Convert buffer to base64
    const base64Data = file.buffer.toString('base64');
    
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: base64Data
      }
    });

    // Add metadata as text if available
    if (file.metadata) {
      parts.push({
        text: `File metadata: ${JSON.stringify(file.metadata)}`
      });
    }

    return parts;
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(file: MediaFile, analysisType: AnalysisType, customPrompt?: string): string {
    const fileHash = require('crypto')
      .createHash('md5')
      .update(file.buffer)
      .digest('hex');
    
    return `${fileHash}_${analysisType}_${customPrompt ? require('crypto').createHash('md5').update(customPrompt).digest('hex') : 'default'}`;
  }

  /**
   * Batch analyze multiple media files
   */
  async batchAnalyze(
    files: MediaFile[],
    analysisType: AnalysisType,
    options?: {
      parallel?: boolean;
      maxConcurrent?: number;
      customPrompt?: string;
    }
  ): Promise<GeminiResponse[]> {
    const { parallel = false, maxConcurrent = 3, customPrompt } = options || {};

    if (parallel) {
      // Process in parallel with concurrency limit
      const results: GeminiResponse[] = [];
      const chunks = this.chunkArray(files, maxConcurrent);
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(file => this.analyzeMedia(file, analysisType, customPrompt))
        );
        results.push(...chunkResults);
      }
      
      return results;
    } else {
      // Process sequentially
      const results: GeminiResponse[] = [];
      for (const file of files) {
        const result = await this.analyzeMedia(file, analysisType, customPrompt);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * Helper to chunk array for batch processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get current usage statistics
   */
  getUsageStats() {
    return {
      rateLimits: this.rateLimiter.getStats(),
      cacheStats: this.cache.getStats(),
      config: {
        model: this.config.model,
        maxTokens: this.config.maxOutputTokens
      }
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Gemini response cache cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GeminiConfig>): void {
    this.config = { ...this.config, ...config };
    this.initialized = false; // Force re-initialization
    logger.info('Gemini configuration updated', config);
  }
}

// Export singleton instance
export const geminiClient = new GeminiClient();