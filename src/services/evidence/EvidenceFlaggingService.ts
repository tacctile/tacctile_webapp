/**
 * Evidence Flagging Service
 * Handles markers with timestamps, comments, user attribution, filtering, and AI summarization
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { aiConfig } from '@/config';
import { supabaseService } from '@/services/supabase/SupabaseService';
import type {
  EvidenceFlag,
  FlagComment,
  FlagType,
  AIFlagAnalysis,
  AISummarizationRequest,
  AISummarizationResponse,
  EvidenceFlagFilter,
  Evidence,
  User,
} from '@/types';

// ============================================================================
// FLAG TYPE METADATA
// ============================================================================

export interface FlagTypeMetadata {
  type: FlagType;
  label: string;
  description: string;
  icon: string; // MUI icon name
  color: string; // Hex color
  category: 'paranormal' | 'technical' | 'review';
}

export const FLAG_TYPES: FlagTypeMetadata[] = [
  {
    type: 'anomaly',
    label: 'Anomaly',
    description: 'Unusual occurrence or unexplained phenomenon',
    icon: 'Help',
    color: '#9C27B0',
    category: 'paranormal',
  },
  {
    type: 'evp',
    label: 'EVP',
    description: 'Electronic Voice Phenomenon - unexplained audio',
    icon: 'RecordVoiceOver',
    color: '#2196F3',
    category: 'paranormal',
  },
  {
    type: 'apparition',
    label: 'Apparition',
    description: 'Visual anomaly or ghostly figure',
    icon: 'Visibility',
    color: '#E91E63',
    category: 'paranormal',
  },
  {
    type: 'emf_spike',
    label: 'EMF Spike',
    description: 'Electromagnetic field reading spike',
    icon: 'BoltOutlined',
    color: '#FF9800',
    category: 'paranormal',
  },
  {
    type: 'temperature_change',
    label: 'Temperature Change',
    description: 'Unusual temperature fluctuation',
    icon: 'Thermostat',
    color: '#00BCD4',
    category: 'paranormal',
  },
  {
    type: 'motion_detected',
    label: 'Motion Detected',
    description: 'Unexplained movement captured',
    icon: 'DirectionsRun',
    color: '#4CAF50',
    category: 'paranormal',
  },
  {
    type: 'audio_artifact',
    label: 'Audio Artifact',
    description: 'Unusual sound or audio anomaly',
    icon: 'GraphicEq',
    color: '#673AB7',
    category: 'paranormal',
  },
  {
    type: 'light_anomaly',
    label: 'Light Anomaly',
    description: 'Unexplained light, orb, or illumination',
    icon: 'LightMode',
    color: '#FFEB3B',
    category: 'paranormal',
  },
  {
    type: 'shadow_figure',
    label: 'Shadow Figure',
    description: 'Shadow person or dark mass',
    icon: 'PersonOutline',
    color: '#37474F',
    category: 'paranormal',
  },
  {
    type: 'equipment_malfunction',
    label: 'Equipment Issue',
    description: 'Camera, audio, or other equipment malfunction',
    icon: 'ReportProblem',
    color: '#FF5722',
    category: 'technical',
  },
  {
    type: 'debunked',
    label: 'Debunked',
    description: 'Explained occurrence with natural cause',
    icon: 'Cancel',
    color: '#9E9E9E',
    category: 'review',
  },
  {
    type: 'review_needed',
    label: 'Review Needed',
    description: 'Requires further analysis or verification',
    icon: 'RateReview',
    color: '#FFC107',
    category: 'review',
  },
  {
    type: 'highlight',
    label: 'Highlight',
    description: 'Important or noteworthy moment',
    icon: 'Star',
    color: '#19ABB5',
    category: 'review',
  },
  {
    type: 'custom',
    label: 'Custom',
    description: 'User-defined flag type',
    icon: 'Label',
    color: '#607D8B',
    category: 'review',
  },
];

// ============================================================================
// EVIDENCE FLAGGING SERVICE
// ============================================================================

class EvidenceFlaggingService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private initialized = false;

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      if (aiConfig.geminiApiKey) {
        this.genAI = new GoogleGenerativeAI(aiConfig.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({
          model: aiConfig.geminiModel,
          generationConfig: {
            maxOutputTokens: aiConfig.maxOutputTokens,
            temperature: aiConfig.temperature,
          },
        });
        console.log('[EvidenceFlagging] AI summarization enabled');
      } else {
        console.warn('[EvidenceFlagging] No Gemini API key, AI features disabled');
      }

      this.initialized = true;
      console.log('[EvidenceFlagging] Initialized');
    } catch (error) {
      console.error('[EvidenceFlagging] Initialization failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // FLAG TYPE HELPERS
  // ============================================================================

  /**
   * Get all flag types
   */
  getFlagTypes(): FlagTypeMetadata[] {
    return FLAG_TYPES;
  }

  /**
   * Get flag type metadata
   */
  getFlagTypeMetadata(type: FlagType): FlagTypeMetadata | undefined {
    return FLAG_TYPES.find((ft) => ft.type === type);
  }

  /**
   * Get flag types by category
   */
  getFlagTypesByCategory(category: 'paranormal' | 'technical' | 'review'): FlagTypeMetadata[] {
    return FLAG_TYPES.filter((ft) => ft.category === category);
  }

  // ============================================================================
  // FLAG CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new flag/marker on evidence
   */
  async createFlag(params: {
    evidenceId: string;
    user: User;
    type: FlagType;
    customType?: string;
    timestamp: number;
    endTimestamp?: number;
    title: string;
    description?: string;
    confidence: 'low' | 'medium' | 'high';
    tags?: string[];
    generateAISummary?: boolean;
  }): Promise<EvidenceFlag> {
    const flag = await supabaseService.createFlag({
      evidenceId: params.evidenceId,
      userId: params.user.id,
      userDisplayName: params.user.displayName || params.user.email,
      userPhotoURL: params.user.photoURL || undefined,
      type: params.type,
      customType: params.customType,
      timestamp: params.timestamp,
      endTimestamp: params.endTimestamp,
      title: params.title,
      description: params.description,
      confidence: params.confidence,
      tags: params.tags || [],
    });

    // Optionally generate AI summary
    if (params.generateAISummary && this.model) {
      try {
        const aiAnalysis = await this.analyzeFlag(flag, params.description);
        if (aiAnalysis) {
          return await supabaseService.updateFlag(flag.id, {
            aiSummary: aiAnalysis.summary,
            aiAnalysis,
          });
        }
      } catch (error) {
        console.error('[EvidenceFlagging] AI analysis failed:', error);
      }
    }

    return flag;
  }

  /**
   * Get flags for evidence with optional filtering
   */
  async getFlags(evidenceId: string, filter?: EvidenceFlagFilter): Promise<EvidenceFlag[]> {
    return supabaseService.getFlags(evidenceId, filter);
  }

  /**
   * Get flags grouped by type
   */
  async getFlagsGroupedByType(evidenceId: string): Promise<Map<FlagType, EvidenceFlag[]>> {
    const flags = await this.getFlags(evidenceId);
    const grouped = new Map<FlagType, EvidenceFlag[]>();

    for (const flag of flags) {
      const existing = grouped.get(flag.type) || [];
      existing.push(flag);
      grouped.set(flag.type, existing);
    }

    return grouped;
  }

  /**
   * Get flags by user
   */
  async getFlagsByUser(evidenceId: string, userId: string): Promise<EvidenceFlag[]> {
    return this.getFlags(evidenceId, { userIds: [userId] });
  }

  /**
   * Get flags in time range
   */
  async getFlagsInTimeRange(
    evidenceId: string,
    startTime: number,
    endTime: number
  ): Promise<EvidenceFlag[]> {
    return this.getFlags(evidenceId, {
      timestampRange: { start: startTime, end: endTime },
    });
  }

  /**
   * Update a flag
   */
  async updateFlag(
    flagId: string,
    updates: Partial<Pick<EvidenceFlag, 'type' | 'customType' | 'title' | 'description' | 'confidence' | 'tags'>>
  ): Promise<EvidenceFlag> {
    return supabaseService.updateFlag(flagId, updates);
  }

  /**
   * Delete a flag
   */
  async deleteFlag(flagId: string, evidenceId: string): Promise<void> {
    return supabaseService.deleteFlag(flagId, evidenceId);
  }

  // ============================================================================
  // COMMENT OPERATIONS
  // ============================================================================

  /**
   * Add comment to a flag
   */
  async addComment(params: {
    flagId: string;
    user: User;
    content: string;
    mentions?: string[];
  }): Promise<FlagComment> {
    return supabaseService.createComment({
      flagId: params.flagId,
      userId: params.user.id,
      userDisplayName: params.user.displayName || params.user.email,
      userPhotoURL: params.user.photoURL || undefined,
      content: params.content,
      mentions: params.mentions || [],
    });
  }

  /**
   * Get comments for a flag
   */
  async getComments(flagId: string): Promise<FlagComment[]> {
    return supabaseService.getComments(flagId);
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, content: string): Promise<FlagComment> {
    return supabaseService.updateComment(commentId, content);
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, flagId: string): Promise<void> {
    return supabaseService.deleteComment(commentId, flagId);
  }

  // ============================================================================
  // FILTERING & SEARCH
  // ============================================================================

  /**
   * Build filter from user selections
   */
  buildFilter(options: {
    types?: FlagType[];
    users?: string[];
    timeRange?: { start: number; end: number };
    dateRange?: { start: Date; end: Date };
    confidence?: ('low' | 'medium' | 'high')[];
    hasComments?: boolean;
    hasAiSummary?: boolean;
    search?: string;
    tags?: string[];
    sortBy?: EvidenceFlagFilter['sortBy'];
    sortOrder?: 'asc' | 'desc';
  }): EvidenceFlagFilter {
    return {
      types: options.types,
      userIds: options.users,
      timestampRange: options.timeRange,
      dateRange: options.dateRange,
      confidence: options.confidence,
      hasComments: options.hasComments,
      hasAiSummary: options.hasAiSummary,
      searchQuery: options.search,
      tags: options.tags,
      sortBy: options.sortBy || 'timestamp',
      sortOrder: options.sortOrder || 'asc',
    };
  }

  /**
   * Get flag statistics for evidence
   */
  async getFlagStatistics(evidenceId: string): Promise<{
    totalFlags: number;
    byType: Record<FlagType, number>;
    byUser: Record<string, { count: number; displayName: string }>;
    byConfidence: Record<'low' | 'medium' | 'high', number>;
    totalComments: number;
    withAiSummary: number;
  }> {
    const flags = await this.getFlags(evidenceId);

    const byType: Record<string, number> = {};
    const byUser: Record<string, { count: number; displayName: string }> = {};
    const byConfidence: Record<string, number> = { low: 0, medium: 0, high: 0 };
    let totalComments = 0;
    let withAiSummary = 0;

    for (const flag of flags) {
      // By type
      byType[flag.type] = (byType[flag.type] || 0) + 1;

      // By user
      if (!byUser[flag.userId]) {
        byUser[flag.userId] = { count: 0, displayName: flag.userDisplayName };
      }
      byUser[flag.userId].count++;

      // By confidence
      byConfidence[flag.confidence]++;

      // Comments
      totalComments += flag.commentCount;

      // AI summary
      if (flag.aiSummary) {
        withAiSummary++;
      }
    }

    return {
      totalFlags: flags.length,
      byType: byType as Record<FlagType, number>,
      byUser,
      byConfidence: byConfidence as Record<'low' | 'medium' | 'high', number>,
      totalComments,
      withAiSummary,
    };
  }

  // ============================================================================
  // AI SUMMARIZATION
  // ============================================================================

  /**
   * Analyze a single flag with AI
   */
  async analyzeFlag(flag: EvidenceFlag, additionalContext?: string): Promise<AIFlagAnalysis | null> {
    if (!this.model) {
      console.warn('[EvidenceFlagging] AI model not available');
      return null;
    }

    const typeMetadata = this.getFlagTypeMetadata(flag.type);

    const prompt = `You are an expert paranormal investigator and evidence analyst. Analyze this flagged evidence marker:

Type: ${typeMetadata?.label || flag.type}
Title: ${flag.title}
Description: ${flag.description || 'No description provided'}
Timestamp: ${this.formatTimestamp(flag.timestamp)}${flag.endTimestamp ? ` to ${this.formatTimestamp(flag.endTimestamp)}` : ''}
Confidence Level: ${flag.confidence}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Provide analysis in the following JSON format:
{
  "summary": "Brief 1-2 sentence summary of the flagged occurrence",
  "possibleExplanations": ["Natural explanation 1", "Natural explanation 2", "Paranormal explanation if applicable"],
  "similarCases": ["Brief reference to similar documented cases"],
  "confidence": 0.0-1.0 (your confidence in the validity of this flag),
  "suggestedActions": ["Recommended action 1", "Recommended action 2"]
}

Be objective and scientific. Consider both natural and paranormal explanations. Focus on actionable insights.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[EvidenceFlagging] Failed to parse AI response');
        return null;
      }

      const analysis = JSON.parse(jsonMatch[0]) as Omit<AIFlagAnalysis, 'analyzedAt'>;

      return {
        ...analysis,
        analyzedAt: new Date(),
      };
    } catch (error) {
      console.error('[EvidenceFlagging] AI analysis error:', error);
      return null;
    }
  }

  /**
   * Generate AI summary for multiple flags (investigation-level)
   */
  async generateInvestigationSummary(
    request: AISummarizationRequest,
    evidence: Evidence[],
    flags: EvidenceFlag[]
  ): Promise<AISummarizationResponse | null> {
    if (!this.model) {
      console.warn('[EvidenceFlagging] AI model not available');
      return null;
    }

    // Filter to requested evidence/flags
    let relevantFlags = flags;
    if (request.evidenceIds?.length) {
      relevantFlags = flags.filter((f) => request.evidenceIds!.includes(f.evidenceId));
    }
    if (request.flagIds?.length) {
      relevantFlags = relevantFlags.filter((f) => request.flagIds!.includes(f.id));
    }

    // Build context
    const flagSummaries = relevantFlags.map((f) => {
      const evidence = evidence.find((e) => e.id === f.evidenceId);
      return `- [${f.type.toUpperCase()}] ${f.title} at ${this.formatTimestamp(f.timestamp)} (${f.confidence} confidence)${evidence ? ` in "${evidence.title}"` : ''}`;
    }).join('\n');

    const evidenceOverview = evidence.map((e) =>
      `- ${e.title} (${e.type}): ${e.flagCount} flags`
    ).join('\n');

    const prompt = `You are an expert paranormal investigator creating a comprehensive investigation summary.

EVIDENCE COLLECTED:
${evidenceOverview}

FLAGGED OCCURRENCES:
${flagSummaries}

Generate a ${request.options.detailLevel} investigation summary in the following JSON format:
{
  "summary": "Comprehensive narrative summary of all findings (${request.options.detailLevel === 'brief' ? '2-3 sentences' : request.options.detailLevel === 'standard' ? '1-2 paragraphs' : '3-4 paragraphs'})",
  "keyFindings": ["Key finding 1", "Key finding 2", "Key finding 3"],
  "anomalyCounts": {${FLAG_TYPES.filter(t => t.category === 'paranormal').map(t => `"${t.type}": 0`).join(', ')}},
  "timeline": [
    {"timestamp": "ISO date string", "description": "What happened", "evidenceIds": [], "flagIds": []}
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Be thorough but concise. Highlight the most significant findings. Provide actionable recommendations for follow-up.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[EvidenceFlagging] Failed to parse AI summary response');
        return null;
      }

      const summary = JSON.parse(jsonMatch[0]);

      // Count actual anomalies
      const anomalyCounts: Record<FlagType, number> = {} as Record<FlagType, number>;
      for (const flag of relevantFlags) {
        anomalyCounts[flag.type] = (anomalyCounts[flag.type] || 0) + 1;
      }

      return {
        id: crypto.randomUUID(),
        investigationId: request.investigationId,
        summary: summary.summary,
        keyFindings: summary.keyFindings || [],
        anomalyCounts,
        timeline: (summary.timeline || []).map((t: { timestamp: string; description: string; evidenceIds: string[]; flagIds: string[] }) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        })),
        recommendations: summary.recommendations || [],
        generatedAt: new Date(),
        model: aiConfig.geminiModel,
        tokensUsed: 0, // Gemini doesn't easily expose token counts
      };
    } catch (error) {
      console.error('[EvidenceFlagging] AI summary error:', error);
      return null;
    }
  }

  /**
   * Get AI-suggested flag type based on description
   */
  async suggestFlagType(description: string): Promise<{
    suggestedType: FlagType;
    confidence: number;
    reasoning: string;
  } | null> {
    if (!this.model) return null;

    const typeDescriptions = FLAG_TYPES.map(
      (t) => `${t.type}: ${t.description}`
    ).join('\n');

    const prompt = `Based on the following description, suggest the most appropriate flag type.

Description: "${description}"

Available flag types:
${typeDescriptions}

Respond in JSON format:
{
  "suggestedType": "flag_type_id",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('[EvidenceFlagging] Flag type suggestion error:', error);
      return null;
    }
  }

  /**
   * Regenerate AI summary for a flag
   */
  async regenerateAISummary(flagId: string): Promise<EvidenceFlag | null> {
    const flags = await supabaseService.getFlags('', { searchQuery: flagId });
    const flag = flags.find((f) => f.id === flagId);

    if (!flag) return null;

    const aiAnalysis = await this.analyzeFlag(flag);
    if (!aiAnalysis) return null;

    return supabaseService.updateFlag(flagId, {
      aiSummary: aiAnalysis.summary,
      aiAnalysis,
    });
  }

  // ============================================================================
  // EXPORT HELPERS
  // ============================================================================

  /**
   * Export flags to JSON
   */
  async exportFlagsToJSON(evidenceId: string): Promise<string> {
    const flags = await this.getFlags(evidenceId);

    // Load comments for each flag
    const flagsWithComments = await Promise.all(
      flags.map(async (flag) => ({
        ...flag,
        comments: await this.getComments(flag.id),
      }))
    );

    return JSON.stringify(flagsWithComments, null, 2);
  }

  /**
   * Export flags to CSV
   */
  async exportFlagsToCSV(evidenceId: string): Promise<string> {
    const flags = await this.getFlags(evidenceId);

    const headers = [
      'ID',
      'Type',
      'Title',
      'Description',
      'Timestamp',
      'End Timestamp',
      'Confidence',
      'User',
      'Comment Count',
      'AI Summary',
      'Tags',
      'Created At',
    ];

    const rows = flags.map((f) => [
      f.id,
      f.type,
      `"${f.title.replace(/"/g, '""')}"`,
      `"${(f.description || '').replace(/"/g, '""')}"`,
      this.formatTimestamp(f.timestamp),
      f.endTimestamp ? this.formatTimestamp(f.endTimestamp) : '',
      f.confidence,
      f.userDisplayName,
      f.commentCount,
      `"${(f.aiSummary || '').replace(/"/g, '""')}"`,
      f.tags.join(';'),
      f.createdAt.toISOString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}

// Export singleton
export const evidenceFlaggingService = new EvidenceFlaggingService();

// Export class for testing
export { EvidenceFlaggingService };
