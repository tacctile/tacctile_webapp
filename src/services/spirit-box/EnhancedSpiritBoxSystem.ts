import { EventEmitter } from 'events';
import { WordAssociationEngine } from './WordAssociationEngine';
import { ContextTriggerSystem } from './ContextTriggerSystem';
import { ResponseTimingSystem } from './ResponseTimingSystem';
import { DualModeSystem } from './DualModeSystem';
import { SessionIntelligenceSystem } from './SessionIntelligenceSystem';
import { RadioScannerCore } from './RadioScannerCore';
import { SessionRecorder, SessionMetadata } from './SessionRecorder';

export interface EnhancedSpiritBoxConfig {
  // Existing configuration
  enableRadioScanning: boolean;
  enableWordBank: boolean;
  
  // New intelligent features
  enableContextualResponses: boolean;
  enableLearning: boolean;
  enableTimingIntelligence: boolean;
  enableDualMode: boolean;
  
  // Mode settings
  radioPercentage: number;
  wordBankPercentage: number;
  subtleMode: boolean;
  adaptiveBlending: boolean;
  
  // Response settings
  baseEnergyLevel: number;
  responsePersonality: 'eager' | 'hesitant' | 'natural' | 'reluctant' | 'conversational';
  intelligenceLevel: 'basic' | 'standard' | 'advanced' | 'expert';
}

export interface IntelligentResponse {
  word: string;
  source: 'radio' | 'wordbank' | 'hybrid';
  confidence: number;
  delay: number;
  contextRelevance: number;
  associationChain?: string[];
  learningInfluence?: string[];
  energyLevel: number;
  adaptationReason?: string;
}

export interface SystemStatus {
  isActive: boolean;
  currentEnergyLevel: number;
  energyDescription: string;
  activeThemes: string[];
  detectedParticipants: string[];
  conversationMode: string;
  learningActive: boolean;
  adaptationsApplied: number;
  responseRate: number;
  detectionRisk: number;
}

export class EnhancedSpiritBoxSystem extends EventEmitter {
  private config: EnhancedSpiritBoxConfig;
  
  // Core components
  private wordAssociation: WordAssociationEngine;
  private contextTrigger: ContextTriggerSystem;
  private responseTiming: ResponseTimingSystem;
  private dualMode: DualModeSystem;
  private sessionIntelligence: SessionIntelligenceSystem;
  
  // Optional components
  private radioScanner?: RadioScannerCore;
  private sessionRecorder?: SessionRecorder;
  
  // System state
  private isInitialized = false;
  private isActive = false;
  private currentSession: string | null = null;
  private inputQueue: string[] = [];
  private responseQueue: IntelligentResponse[] = [];
  private processingLock = false;

  constructor(config: Partial<EnhancedSpiritBoxConfig> = {}) {
    super();
    
    this.config = {
      enableRadioScanning: true,
      enableWordBank: true,
      enableContextualResponses: true,
      enableLearning: true,
      enableTimingIntelligence: true,
      enableDualMode: true,
      radioPercentage: 70,
      wordBankPercentage: 30,
      subtleMode: true,
      adaptiveBlending: true,
      baseEnergyLevel: 0.3,
      responsePersonality: 'natural',
      intelligenceLevel: 'standard',
      ...config
    };
    
    // Initialize core components
    this.wordAssociation = new WordAssociationEngine();
    this.contextTrigger = new ContextTriggerSystem();
    this.responseTiming = new ResponseTimingSystem();
    this.sessionIntelligence = new SessionIntelligenceSystem(
      this.wordAssociation, 
      this.contextTrigger
    );
    
    this.dualMode = new DualModeSystem(
      this.wordAssociation,
      this.contextTrigger,
      this.responseTiming,
      this.radioScanner
    );
    
    this.setupIntegration();
  }

  private setupIntegration(): void {
    // Context triggers affect energy and word selection
    this.contextTrigger.on('triggerDetected', (trigger) => {
      this.handleContextTrigger(trigger);
    });
    
    // Energy changes affect response timing
    this.responseTiming.on('energyBoosted', (data) => {
      this.emit('energyChanged', data);
    });
    
    // Learning system provides adaptation recommendations
    this.sessionIntelligence.on('learningRuleApplied', (data) => {
      this.applyLearningAdaptation(data);
    });
    
    // Dual mode system manages response blending
    this.dualMode.on('responseGenerated', (response) => {
      this.emit('responseGenerated', response);
    });
    
    // High detection risk warnings
    this.dualMode.on('highDetectionRisk', (risk) => {
      this.emit('warning', `High detection risk: ${(risk * 100).toFixed(1)}%`);
    });
  }

  public async initialize(radioScanner?: RadioScannerCore, sessionRecorder?: SessionRecorder): Promise<void> {
    this.radioScanner = radioScanner;
    this.sessionRecorder = sessionRecorder;
    
    // Configure dual mode system with radio scanner if available
    if (this.radioScanner && this.config.enableRadioScanning) {
      this.dualMode = new DualModeSystem(
        this.wordAssociation,
        this.contextTrigger,
        this.responseTiming,
        this.radioScanner
      );
    }
    
    // Set initial energy level
    this.responseTiming.setEnergyLevel(this.config.baseEnergyLevel);
    
    // Configure dual mode
    this.dualMode.updateConfiguration({
      radioSweepPercentage: this.config.radioPercentage,
      wordBankPercentage: this.config.wordBankPercentage,
      subtleMode: this.config.subtleMode,
      contextualAdaptation: this.config.adaptiveBlending
    });
    
    this.isInitialized = true;
    this.emit('initialized');
  }

  public async startSession(sessionMetadata?: Partial<SessionMetadata>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('System must be initialized before starting session');
    }
    
    const sessionId = `enhanced_session_${Date.now()}`;
    this.currentSession = sessionId;
    this.isActive = true;
    
    // Start session intelligence tracking
    if (this.config.enableLearning) {
      this.sessionIntelligence.startSession(sessionId);
    }
    
    // Start session recording if available
    if (this.sessionRecorder && sessionMetadata) {
      await this.sessionRecorder.startSession(sessionMetadata);
    }
    
    // Start radio scanning if enabled
    if (this.radioScanner && this.config.enableRadioScanning) {
      await this.radioScanner.startScanning();
    }
    
    this.emit('sessionStarted', { sessionId, metadata: sessionMetadata });
  }

  public async processInput(inputText: string): Promise<IntelligentResponse | null> {
    if (!this.isActive || this.processingLock) {
      this.inputQueue.push(inputText);
      return null;
    }
    
    this.processingLock = true;
    
    try {
      // Process context triggers
      const trigger = this.config.enableContextualResponses 
        ? this.contextTrigger.processInput(inputText)
        : null;
      
      // Generate contextual words for response
      const contextWords = trigger ? trigger.extractedKeywords : [];
      
      // Get learning recommendations
      const recommendations = this.config.enableLearning
        ? this.sessionIntelligence.getAdaptationRecommendations()
        : null;
      
      // Apply learning to word selection
      if (recommendations) {
        this.applyRecommendations(recommendations);
      }
      
      // Generate response with appropriate timing
      let response: IntelligentResponse | null = null;
      
      if (this.config.enableDualMode) {
        // Use dual mode system for intelligent blending
        const dualResponse = await this.dualMode.generateResponse(contextWords);
        
        if (dualResponse) {
          const timing = this.config.enableTimingIntelligence
            ? await this.responseTiming.scheduleResponse(
                dualResponse.word,
                trigger?.responseType || 'general',
                trigger?.responseType,
                this.config.responsePersonality
              )
            : { word: dualResponse.word, delay: 1000 };
          
          response = {
            word: timing.word,
            source: dualResponse.type,
            confidence: dualResponse.confidence,
            delay: timing.delay,
            contextRelevance: this.calculateContextRelevance(dualResponse.word, contextWords),
            associationChain: dualResponse.associationChain,
            learningInfluence: recommendations ? Array.from(recommendations.categoryBoosts.keys()) : undefined,
            energyLevel: this.responseTiming.getCurrentEnergy(),
            adaptationReason: dualResponse.type === 'wordbank' ? 'intelligent_selection' : 'radio_sweep'
          };
        }
      } else {
        // Fallback to basic word bank selection
        response = await this.generateBasicResponse(contextWords, trigger);
      }
      
      if (response) {
        this.responseQueue.push(response);
        this.emit('intelligentResponse', response);
      }
      
      return response;
      
    } finally {
      this.processingLock = false;
      
      // Process queued inputs
      if (this.inputQueue.length > 0) {
        const nextInput = this.inputQueue.shift()!;
        setImmediate(() => this.processInput(nextInput));
      }
    }
  }

  private handleContextTrigger(trigger: any): void {
    // Boost energy based on trigger type and confidence
    const energyBoosts: { [key: string]: number } = {
      'name': 0.3,
      'yes_no': 0.2,
      'emotion': 0.4,
      'family': 0.5,
      'death': 0.6,
      'help': 0.35,
      'location': 0.25,
      'general': 0.15
    };
    
    const boost = energyBoosts[trigger.responseType] || 0.1;
    const adjustedBoost = boost * trigger.confidence;
    
    this.responseTiming.modifyEnergyLevel(adjustedBoost);
    
    this.emit('contextDetected', {
      type: trigger.responseType,
      keywords: trigger.extractedKeywords,
      confidence: trigger.confidence,
      energyBoost: adjustedBoost
    });
  }

  private applyLearningAdaptation(data: any): void {
    // Apply category weight adaptations to word association engine
    if (data.adaptations.categoryWeights) {
      data.adaptations.categoryWeights.forEach((weight: number, category: string) => {
        // Temporarily boost category in word association
        this.wordAssociation.updateContext([category]);
      });
    }
    
    // Apply word boosts
    if (data.adaptations.wordBoosts) {
      data.adaptations.wordBoosts.forEach((boost: number, word: string) => {
        this.wordAssociation.addRecentWord(word);
      });
    }
    
    this.emit('learningApplied', data);
  }

  private applyRecommendations(recommendations: any): void {
    // Apply category boosts to word association
    recommendations.categoryBoosts.forEach((boost: number, category: string) => {
      if (boost > 1.0) {
        this.wordAssociation.updateContext([category]);
      }
    });
    
    // Apply word boosts
    recommendations.wordBoosts.forEach((boost: number, word: string) => {
      if (boost > 1.0) {
        this.wordAssociation.addRecentWord(word);
      }
    });
    
    // Adjust response timing pattern if recommended
    if (recommendations.responsePatterns.length > 0) {
      // Use the first recommended pattern
      // This would be applied in the next response timing call
    }
  }

  private calculateContextRelevance(word: string, contextWords: string[]): number {
    if (contextWords.length === 0) return 0.5;
    
    // Check if word is directly in context
    if (contextWords.includes(word)) return 1.0;
    
    // Check association strength
    const associations = this.wordAssociation.getAssociatedWords(word, 20);
    const relevantAssociations = associations.filter(assoc => contextWords.includes(assoc));
    
    return relevantAssociations.length / Math.max(1, contextWords.length);
  }

  private async generateBasicResponse(contextWords: string[], trigger: any): Promise<IntelligentResponse | null> {
    let selectedWord = '';
    
    if (contextWords.length > 0) {
      const contextualWords = this.wordAssociation.findWordsWithContext(contextWords, 5);
      if (contextualWords.length > 0) {
        selectedWord = contextualWords[Math.floor(Math.random() * contextualWords.length)];
      }
    }
    
    if (!selectedWord) {
      // Fallback to category-based selection
      const categories = this.contextTrigger.getActiveCategories();
      if (categories.length > 0) {
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        selectedWord = this.wordAssociation.getRandomWordFromCategory(randomCategory) || '';
      } else {
        selectedWord = this.wordAssociation.getRandomWordFromCategory('responses') || 'hello';
      }
    }
    
    if (selectedWord) {
      const timing = this.config.enableTimingIntelligence
        ? await this.responseTiming.scheduleResponse(
            selectedWord,
            trigger?.responseType || 'general',
            trigger?.responseType,
            this.config.responsePersonality
          )
        : { word: selectedWord, delay: 1000 };
      
      return {
        word: timing.word,
        source: 'wordbank',
        confidence: 0.6,
        delay: timing.delay,
        contextRelevance: this.calculateContextRelevance(selectedWord, contextWords),
        energyLevel: this.responseTiming.getCurrentEnergy(),
        adaptationReason: 'basic_selection'
      };
    }
    
    return null;
  }

  public getSystemStatus(): SystemStatus {
    const context = this.sessionIntelligence.getCurrentContext();
    const dualStats = this.dualMode.getStats();
    const responseStats = this.responseTiming.getResponseStats();
    
    return {
      isActive: this.isActive,
      currentEnergyLevel: this.responseTiming.getCurrentEnergy(),
      energyDescription: this.responseTiming.getEnergyDescription(),
      activeThemes: context ? Array.from(context.themes.keys()).slice(0, 5) : [],
      detectedParticipants: context ? Array.from(context.participants.keys()) : [],
      conversationMode: this.config.enableDualMode ? 'intelligent_blend' : 'basic',
      learningActive: this.config.enableLearning,
      adaptationsApplied: this.sessionIntelligence.getCurrentContext() ? 
        this.sessionIntelligence.getSessionSummary()?.adaptationsApplied || 0 : 0,
      responseRate: responseStats.responseRate,
      detectionRisk: dualStats.detectionRisk
    };
  }

  public getSessionSummary(): any {
    if (!this.config.enableLearning) {
      return { message: 'Learning disabled - no session summary available' };
    }
    
    const summary = this.sessionIntelligence.getSessionSummary();
    const dualStats = this.dualMode.getStats();
    const responseStats = this.responseTiming.getResponseStats();
    
    return {
      intelligence: summary,
      responseDistribution: {
        radio: dualStats.radioResponses,
        wordBank: dualStats.wordBankResponses,
        hybrid: dualStats.hybridResponses,
        total: dualStats.totalResponses
      },
      timing: {
        averageDelay: responseStats.averageDelay,
        energyLevel: responseStats.currentEnergyLevel,
        burstResponses: responseStats.burstResponses
      },
      effectiveness: this.dualMode.getEffectivenessAnalysis()
    };
  }

  public updateConfiguration(config: Partial<EnhancedSpiritBoxConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Apply configuration changes to subsystems
    if (config.radioPercentage !== undefined || config.wordBankPercentage !== undefined) {
      this.dualMode.updateConfiguration({
        radioSweepPercentage: this.config.radioPercentage,
        wordBankPercentage: this.config.wordBankPercentage,
        subtleMode: this.config.subtleMode,
        contextualAdaptation: this.config.adaptiveBlending
      });
    }
    
    if (config.baseEnergyLevel !== undefined) {
      this.responseTiming.setEnergyLevel(config.baseEnergyLevel);
    }
    
    this.emit('configurationUpdated', this.config);
  }

  public simulateEnergySpike(intensity = 0.5): void {
    this.responseTiming.simulateEnergySpike(intensity);
    this.emit('energySpike', { intensity, currentLevel: this.responseTiming.getCurrentEnergy() });
  }

  public resetLearning(): void {
    if (this.config.enableLearning) {
      this.sessionIntelligence.resetDynamicLearning();
      this.wordAssociation.resetWeights();
      this.emit('learningReset');
    }
  }

  public getRecentResponses(count = 10): IntelligentResponse[] {
    return this.responseQueue.slice(-count);
  }

  public getWordDatabaseStats(): any {
    return this.wordAssociation.getDatabaseStats();
  }

  public async endSession(): Promise<any> {
    if (!this.isActive) return null;
    
    this.isActive = false;
    
    // Stop radio scanning
    if (this.radioScanner) {
      this.radioScanner.stopScanning();
    }
    
    // End session recording
    if (this.sessionRecorder) {
      await this.sessionRecorder.endSession();
    }
    
    // End intelligence session
    let intelligenceSession = null;
    if (this.config.enableLearning) {
      intelligenceSession = this.sessionIntelligence.endSession();
    }
    
    const sessionSummary = this.getSessionSummary();
    
    this.currentSession = null;
    this.inputQueue = [];
    this.responseQueue = [];
    
    this.emit('sessionEnded', { 
      sessionSummary, 
      intelligenceSession 
    });
    
    return { sessionSummary, intelligenceSession };
  }

  public async cleanup(): Promise<void> {
    if (this.isActive) {
      await this.endSession();
    }
    
    await this.responseTiming.cleanup();
    this.dualMode.cleanup();
    this.sessionIntelligence.cleanup();
    
    this.emit('cleanup');
  }

  // Convenience methods for testing and development
  
  public testWordAssociation(word: string, count = 10): string[] {
    return this.wordAssociation.getAssociatedWords(word, count);
  }

  public testContextTrigger(input: string): any {
    return this.contextTrigger.testPattern(input);
  }

  public testResponseTiming(word: string, type = 'general'): Promise<any> {
    return this.responseTiming.scheduleResponse(word, type, type, this.config.responsePersonality);
  }

  public getEffectivenessAnalysis(): any {
    return this.dualMode.getEffectivenessAnalysis();
  }
}