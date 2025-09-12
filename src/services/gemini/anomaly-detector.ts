/**
 * Anomaly Detection Service
 * Orchestrates media analysis and anomaly detection using Gemini
 */

import { v4 as uuidv4 } from 'uuid';
import { geminiClient } from './client';
import { mediaProcessor } from './media-processor';
import {
  AnalysisType,
  MediaFile,
  ProcessingOptions,
  MediaMetadata,
  AnalysisResult,
  Anomaly,
  AnomalyType,
  ConfidenceLevel,
  AnalysisSession,
  BatchAnalysisRequest
} from './types';
import { logger } from '../../utils/logger';

export class AnomalyDetector {
  private currentSession: AnalysisSession | null = null;
  private analysisHistory: Map<string, AnalysisResult> = new Map();

  /**
   * Start a new analysis session
   */
  startSession(investigationId: string): AnalysisSession {
    this.currentSession = {
      id: uuidv4(),
      investigationId,
      startTime: new Date().toISOString(),
      filesAnalyzed: 0,
      anomaliesDetected: 0,
      totalTokensUsed: 0,
      results: []
    };
    
    logger.info('Analysis session started', { 
      sessionId: this.currentSession.id,
      investigationId 
    });
    
    return this.currentSession;
  }

  /**
   * End current analysis session
   */
  endSession(): AnalysisSession | null {
    if (!this.currentSession) return null;
    
    this.currentSession.endTime = new Date().toISOString();
    const session = { ...this.currentSession };
    
    logger.info('Analysis session ended', {
      sessionId: session.id,
      filesAnalyzed: session.filesAnalyzed,
      anomaliesDetected: session.anomaliesDetected,
      totalTokensUsed: session.totalTokensUsed
    });
    
    this.currentSession = null;
    return session;
  }

  /**
   * Analyze single media file
   */
  async analyzeFile(
    filePath: string,
    analysisTypes: AnalysisType[],
    options?: {
      processingOptions?: ProcessingOptions;
      metadata?: MediaMetadata;
      customPrompt?: string;
    }
  ): Promise<AnalysisResult> {
    try {
      // Process the media file
      const mediaFile = await mediaProcessor.processFile(
        filePath,
        options?.processingOptions,
        options?.metadata
      );
      
      // Run multiple analysis types
      const results = await Promise.all(
        analysisTypes.map(type => 
          geminiClient.analyzeMedia(mediaFile, type, options?.customPrompt)
        )
      );
      
      // Parse and combine results
      const anomalies = this.parseAnomalies(results.map(r => r.text).join('\n'));
      const confidence = this.calculateOverallConfidence(anomalies);
      const recommendations = this.extractRecommendations(results.map(r => r.text).join('\n'));
      
      const analysisResult: AnalysisResult = {
        id: uuidv4(),
        mediaFile: {
          filename: mediaFile.filename,
          type: mediaFile.mimeType,
          size: mediaFile.size
        },
        analysis: results[0], // Primary analysis
        anomalies,
        confidence,
        recommendations,
        createdAt: new Date().toISOString()
      };
      
      // Update session if active
      if (this.currentSession) {
        this.currentSession.filesAnalyzed++;
        this.currentSession.anomaliesDetected += anomalies.length;
        this.currentSession.totalTokensUsed += results.reduce(
          (sum, r) => sum + (r.metadata.totalTokens || 0), 0
        );
        this.currentSession.results.push(analysisResult);
      }
      
      // Store in history
      this.analysisHistory.set(analysisResult.id, analysisResult);
      
      logger.info('File analysis completed', {
        resultId: analysisResult.id,
        filename: mediaFile.filename,
        anomaliesFound: anomalies.length,
        confidence
      });
      
      return analysisResult;
    } catch (error) {
      logger.error('File analysis failed', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple files
   */
  async batchAnalyze(request: BatchAnalysisRequest): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    for (const file of request.files) {
      try {
        // Process each file
        const mediaFile = await mediaProcessor.processBuffer(
          file.buffer,
          file.mimeType,
          file.filename,
          request.options,
          file.metadata
        );
        
        // Run analysis for each type
        const analysisResults = await Promise.all(
          request.analysisTypes.map(type =>
            geminiClient.analyzeMedia(mediaFile, type, request.customPrompt)
          )
        );
        
        // Parse results
        const anomalies = this.parseAnomalies(
          analysisResults.map(r => r.text).join('\n')
        );
        const confidence = this.calculateOverallConfidence(anomalies);
        const recommendations = this.extractRecommendations(
          analysisResults.map(r => r.text).join('\n')
        );
        
        const result: AnalysisResult = {
          id: uuidv4(),
          mediaFile: {
            filename: file.filename,
            type: file.mimeType,
            size: file.size
          },
          analysis: analysisResults[0],
          anomalies,
          confidence,
          recommendations,
          createdAt: new Date().toISOString()
        };
        
        results.push(result);
        
        // Update session
        if (this.currentSession) {
          this.currentSession.filesAnalyzed++;
          this.currentSession.anomaliesDetected += anomalies.length;
          this.currentSession.totalTokensUsed += analysisResults.reduce(
            (sum, r) => sum + (r.metadata.totalTokens || 0), 0
          );
          this.currentSession.results.push(result);
        }
        
        this.analysisHistory.set(result.id, result);
      } catch (error) {
        logger.error(`Failed to analyze file ${file.filename}`, error);
      }
    }
    
    return results;
  }

  /**
   * Parse anomalies from Gemini response
   */
  private parseAnomalies(text: string): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Parse structured anomaly mentions
    const anomalyPatterns = [
      /anomaly:?\s*([^.]+)/gi,
      /detected:?\s*([^.]+)/gi,
      /found:?\s*([^.]+)/gi,
      /identified:?\s*([^.]+)/gi,
      /unusual:?\s*([^.]+)/gi,
      /unexplained:?\s*([^.]+)/gi
    ];
    
    for (const pattern of anomalyPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const description = match[1].trim();
        const type = this.classifyAnomaly(description);
        const confidence = this.extractConfidence(description);
        
        anomalies.push({
          type,
          description,
          confidence,
          evidence: this.extractEvidence(text, description),
          scientificExplanation: this.extractScientificExplanation(text, description),
          paranormalInterpretation: this.extractParanormalInterpretation(text, description)
        });
      }
    }
    
    // Remove duplicates
    const uniqueAnomalies = Array.from(
      new Map(anomalies.map(a => [a.description, a])).values()
    );
    
    return uniqueAnomalies;
  }

  /**
   * Classify anomaly type based on description
   */
  private classifyAnomaly(description: string): AnomalyType {
    const lower = description.toLowerCase();
    
    if (lower.includes('orb')) return AnomalyType.ORB;
    if (lower.includes('apparition') || lower.includes('figure')) return AnomalyType.APPARITION;
    if (lower.includes('shadow')) return AnomalyType.SHADOW_FIGURE;
    if (lower.includes('mist') || lower.includes('fog')) return AnomalyType.MIST;
    if (lower.includes('voice')) return AnomalyType.EVP_VOICE;
    if (lower.includes('whisper')) return AnomalyType.EVP_WHISPER;
    if (lower.includes('light')) return AnomalyType.LIGHT_ANOMALY;
    if (lower.includes('temperature') || lower.includes('cold') || lower.includes('hot')) 
      return AnomalyType.TEMPERATURE_ANOMALY;
    if (lower.includes('emf') || lower.includes('electromagnetic')) return AnomalyType.EMF_SPIKE;
    if (lower.includes('motion') || lower.includes('movement')) return AnomalyType.MOTION_ANOMALY;
    if (lower.includes('pattern')) return AnomalyType.PATTERN;
    
    return AnomalyType.UNKNOWN;
  }

  /**
   * Extract confidence level from text
   */
  private extractConfidence(text: string): ConfidenceLevel {
    const lower = text.toLowerCase();
    
    if (lower.includes('very high') || lower.includes('definite') || lower.includes('certain'))
      return ConfidenceLevel.VERY_HIGH;
    if (lower.includes('high') || lower.includes('probable') || lower.includes('likely'))
      return ConfidenceLevel.HIGH;
    if (lower.includes('medium') || lower.includes('possible') || lower.includes('moderate'))
      return ConfidenceLevel.MEDIUM;
    if (lower.includes('low') || lower.includes('unlikely') || lower.includes('doubtful'))
      return ConfidenceLevel.LOW;
    if (lower.includes('very low') || lower.includes('minimal') || lower.includes('negligible'))
      return ConfidenceLevel.VERY_LOW;
    
    return ConfidenceLevel.MEDIUM;
  }

  /**
   * Extract evidence supporting the anomaly
   */
  private extractEvidence(fullText: string, anomalyDescription: string): string[] {
    const evidence: string[] = [];
    const sentences = fullText.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes('evidence') ||
          sentence.toLowerCase().includes('supports') ||
          sentence.toLowerCase().includes('indicates')) {
        evidence.push(sentence.trim());
      }
    }
    
    return evidence.slice(0, 3); // Limit to 3 pieces of evidence
  }

  /**
   * Extract scientific explanation
   */
  private extractScientificExplanation(fullText: string, anomalyDescription: string): string | undefined {
    const patterns = [
      /scientific(?:ally)?:?\s*([^.]+)/i,
      /explanation:?\s*([^.]+)/i,
      /caused by:?\s*([^.]+)/i,
      /due to:?\s*([^.]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  /**
   * Extract paranormal interpretation
   */
  private extractParanormalInterpretation(fullText: string, anomalyDescription: string): string | undefined {
    const patterns = [
      /paranormal(?:ly)?:?\s*([^.]+)/i,
      /supernatural(?:ly)?:?\s*([^.]+)/i,
      /spirit(?:ual)?:?\s*([^.]+)/i,
      /ghost(?:ly)?:?\s*([^.]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  /**
   * Calculate overall confidence level
   */
  private calculateOverallConfidence(anomalies: Anomaly[]): ConfidenceLevel {
    if (anomalies.length === 0) return ConfidenceLevel.VERY_LOW;
    
    const confidenceValues = {
      [ConfidenceLevel.VERY_LOW]: 1,
      [ConfidenceLevel.LOW]: 2,
      [ConfidenceLevel.MEDIUM]: 3,
      [ConfidenceLevel.HIGH]: 4,
      [ConfidenceLevel.VERY_HIGH]: 5
    };
    
    const sum = anomalies.reduce(
      (acc, a) => acc + confidenceValues[a.confidence], 0
    );
    const average = sum / anomalies.length;
    
    if (average >= 4.5) return ConfidenceLevel.VERY_HIGH;
    if (average >= 3.5) return ConfidenceLevel.HIGH;
    if (average >= 2.5) return ConfidenceLevel.MEDIUM;
    if (average >= 1.5) return ConfidenceLevel.LOW;
    return ConfidenceLevel.VERY_LOW;
  }

  /**
   * Extract recommendations from analysis
   */
  private extractRecommendations(text: string): string[] {
    const recommendations: string[] = [];
    const patterns = [
      /recommend(?:ation)?:?\s*([^.]+)/gi,
      /suggest(?:ion)?:?\s*([^.]+)/gi,
      /should:?\s*([^.]+)/gi,
      /advise:?\s*([^.]+)/gi,
      /further investigation:?\s*([^.]+)/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        recommendations.push(match[1].trim());
      }
    }
    
    // Remove duplicates and limit
    return Array.from(new Set(recommendations)).slice(0, 5);
  }

  /**
   * Get analysis by ID
   */
  getAnalysis(id: string): AnalysisResult | undefined {
    return this.analysisHistory.get(id);
  }

  /**
   * Get all analyses for an investigation
   */
  getInvestigationAnalyses(investigationId: string): AnalysisResult[] {
    return Array.from(this.analysisHistory.values()).filter(
      result => result.mediaFile.filename.includes(investigationId)
    );
  }

  /**
   * Clear analysis history
   */
  clearHistory(): void {
    this.analysisHistory.clear();
    logger.info('Analysis history cleared');
  }

  /**
   * Get current session
   */
  getCurrentSession(): AnalysisSession | null {
    return this.currentSession;
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();