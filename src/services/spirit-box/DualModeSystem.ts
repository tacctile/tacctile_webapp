import { EventEmitter } from 'events';
import { WordAssociationEngine } from './WordAssociationEngine';
import { ContextTriggerSystem } from './ContextTriggerSystem';
import { ResponseTimingSystem } from './ResponseTimingSystem';
import { RadioScannerCore, RadioMetrics } from './RadioScannerCore';

export interface ModeConfiguration {
  radioSweepPercentage: number; // 0-100% how much of the time to use radio sweep
  wordBankPercentage: number;   // 0-100% how much of the time to inject word bank responses
  blendingEnabled: boolean;     // whether to blend both modes simultaneously
  subtleMode: boolean;          // makes word bank injections very subtle and natural
  contextualAdaptation: boolean; // adapts blend ratio based on conversation context
}

export interface ResponseSource {
  type: 'radio' | 'wordbank' | 'hybrid';
  confidence: number;
  word: string;
  timestamp: number;
  context?: string;
  associationChain?: string[];
  radioFrequency?: number;
  signalStrength?: number;
}

export interface BlendingRules {
  questionBoostDuration: number; // ms to boost word bank after questions
  questionBoostRatio: number;    // boost word bank percentage after questions  
  highEnergyThreshold: number;   // energy level that triggers more word bank responses
  lowSignalThreshold: number;    // radio signal strength that triggers more word bank
  cooldownPeriod: number;        // ms between word bank injections to maintain subtlety
  maxConsecutiveWordBank: number; // prevent obvious patterns
}

export interface DualModeStats {
  radioResponses: number;
  wordBankResponses: number;
  hybridResponses: number;
  totalResponses: number;
  currentBlendRatio: { radio: number, wordBank: number };
  adaptationHistory: { timestamp: number, ratio: number, reason: string }[];
  detectionRisk: number; // 0-1 how obvious the word bank might be
}

export class DualModeSystem extends EventEmitter {
  private configuration: ModeConfiguration;
  private blendingRules: BlendingRules;
  private stats: DualModeStats;
  
  private wordAssociation: WordAssociationEngine;
  private contextTrigger: ContextTriggerSystem;
  private responseTiming: ResponseTimingSystem;
  private radioScanner: RadioScannerCore | null = null;
  
  // State tracking
  private lastWordBankResponse = 0;
  private consecutiveWordBankCount = 0;
  private currentContextBoost = 0;
  private recentResponses: ResponseSource[] = [];
  private maxResponseHistory = 50;
  
  // Adaptation logic
  private adaptationEnabled = true;
  private adaptationInterval: NodeJS.Timeout | null = null;
  private lastAdaptation = 0;

  constructor(
    wordAssociation: WordAssociationEngine,
    contextTrigger: ContextTriggerSystem,
    responseTiming: ResponseTimingSystem,
    radioScanner?: RadioScannerCore
  ) {
    super();
    
    this.wordAssociation = wordAssociation;
    this.contextTrigger = contextTrigger;
    this.responseTiming = responseTiming;
    this.radioScanner = radioScanner || null;
    
    this.configuration = {
      radioSweepPercentage: 70,
      wordBankPercentage: 30,
      blendingEnabled: true,
      subtleMode: true,
      contextualAdaptation: true
    };
    
    this.blendingRules = {
      questionBoostDuration: 45000, // 45 seconds
      questionBoostRatio: 0.6,      // Boost to 60% word bank after questions
      highEnergyThreshold: 0.7,     // Above 70% energy
      lowSignalThreshold: -60,      // Below -60dBm signal strength
      cooldownPeriod: 3000,         // 3 seconds between word bank responses
      maxConsecutiveWordBank: 2     // Max 2 consecutive word bank responses
    };
    
    this.stats = {
      radioResponses: 0,
      wordBankResponses: 0,
      hybridResponses: 0,
      totalResponses: 0,
      currentBlendRatio: { 
        radio: this.configuration.radioSweepPercentage, 
        wordBank: this.configuration.wordBankPercentage 
      },
      adaptationHistory: [],
      detectionRisk: 0
    };
    
    this.setupEventListeners();
    this.startAdaptationLoop();
  }

  private setupEventListeners(): void {
    // Listen for context triggers to adapt blending
    this.contextTrigger.on('triggerDetected', (trigger) => {
      this.handleContextTrigger(trigger);
    });
    
    // Listen for energy changes to adapt blending
    this.responseTiming.on('energyBoosted', (data) => {
      this.handleEnergyBoost(data);
    });
    
    // Listen for radio metrics to adapt based on signal strength
    if (this.radioScanner) {
      this.radioScanner.on('metrics', (metrics: RadioMetrics) => {
        this.handleRadioMetrics(metrics);
      });
    }
  }

  private handleContextTrigger(trigger: any): void {
    if (!this.configuration.contextualAdaptation) return;
    
    // Boost word bank percentage after questions
    const isQuestion = trigger.confidence > 0.6;
    if (isQuestion) {
      this.applyTemporaryBoost(
        this.blendingRules.questionBoostRatio,
        this.blendingRules.questionBoostDuration,
        'question_detected'
      );
    }
    
    // Adapt based on response type
    const responseTypeAdaptations: { [key: string]: number } = {
      'name': 0.8,     // Names work better from word bank
      'yes_no': 0.6,   // Yes/no responses are good from word bank  
      'emotion': 0.7,  // Emotional responses benefit from word bank
      'family': 0.9,   // Family terms are much better from word bank
      'death': 0.8,    // Death-related terms work well from word bank
      'general': 0.3   // General conversation can stay mostly radio
    };
    
    const adaptation = responseTypeAdaptations[trigger.responseType];
    if (adaptation) {
      this.applyTemporaryBoost(adaptation, 30000, `response_type_${trigger.responseType}`);
    }
  }

  private handleEnergyBoost(data: any): void {
    // High energy periods favor more word bank responses for better communication
    if (data.newLevel > this.blendingRules.highEnergyThreshold) {
      this.applyTemporaryBoost(0.5, 60000, 'high_energy');
    }
  }

  private handleRadioMetrics(metrics: RadioMetrics): void {
    // Poor radio signal quality favors more word bank responses
    if (metrics.signalStrength < this.blendingRules.lowSignalThreshold) {
      this.applyTemporaryBoost(0.4, 20000, 'poor_radio_signal');
    }
    
    // Very strong signals can reduce word bank to let radio shine
    if (metrics.signalStrength > -20) {
      this.applyTemporaryBoost(-0.2, 15000, 'strong_radio_signal');
    }
  }

  private applyTemporaryBoost(boostAmount: number, duration: number, reason: string): void {
    const oldRatio = this.stats.currentBlendRatio.wordBank;
    const newRatio = Math.max(0.1, Math.min(0.9, oldRatio / 100 + boostAmount));
    
    this.stats.currentBlendRatio.wordBank = newRatio * 100;
    this.stats.currentBlendRatio.radio = 100 - this.stats.currentBlendRatio.wordBank;
    
    this.stats.adaptationHistory.push({
      timestamp: Date.now(),
      ratio: newRatio,
      reason
    });
    
    this.emit('blendRatioAdapted', {
      oldRatio: oldRatio,
      newRatio: newRatio * 100,
      reason,
      duration
    });
    
    // Reset after duration
    setTimeout(() => {
      this.stats.currentBlendRatio.radio = this.configuration.radioSweepPercentage;
      this.stats.currentBlendRatio.wordBank = this.configuration.wordBankPercentage;
      this.emit('blendRatioReset', this.stats.currentBlendRatio);
    }, duration);
  }

  public async generateResponse(contextWords: string[] = []): Promise<ResponseSource | null> {
    const now = Date.now();
    
    // Check cooldown period for word bank responses
    const timeSinceLastWordBank = now - this.lastWordBankResponse;
    const inCooldown = timeSinceLastWordBank < this.blendingRules.cooldownPeriod;
    
    // Check consecutive word bank limit
    const recentWordBankCount = this.getRecentWordBankCount(3); // Last 3 responses
    const atConsecutiveLimit = recentWordBankCount >= this.blendingRules.maxConsecutiveWordBank;
    
    // Determine response source
    const responseSource = this.determineResponseSource(inCooldown, atConsecutiveLimit);
    
    let response: ResponseSource | null = null;
    
    switch (responseSource) {
      case 'radio':
        response = await this.generateRadioResponse();
        break;
      case 'wordbank':
        response = await this.generateWordBankResponse(contextWords);
        break;
      case 'hybrid':
        response = await this.generateHybridResponse(contextWords);
        break;
    }
    
    if (response) {
      this.recordResponse(response);
      this.updateDetectionRisk(response);
    }
    
    return response;
  }

  private determineResponseSource(inCooldown: boolean, atConsecutiveLimit: boolean): 'radio' | 'wordbank' | 'hybrid' {
    // Force radio if word bank is in cooldown or at consecutive limit
    if ((inCooldown || atConsecutiveLimit) && this.configuration.subtleMode) {
      return 'radio';
    }
    
    // Use current blend ratio to determine source
    const wordBankChance = this.stats.currentBlendRatio.wordBank / 100;
    const random = Math.random();
    
    if (this.configuration.blendingEnabled) {
      if (random < wordBankChance * 0.3) {
        return 'hybrid'; // Small chance for hybrid responses
      } else if (random < wordBankChance) {
        return 'wordbank';
      } else {
        return 'radio';
      }
    } else {
      return random < wordBankChance ? 'wordbank' : 'radio';
    }
  }

  private async generateRadioResponse(): Promise<ResponseSource | null> {
    // Simulate radio sweep response
    // In real implementation, this would get actual radio data
    const frequency = 88.1 + Math.random() * 20; // FM band
    const signalStrength = -80 + Math.random() * 40;
    
    // Very low chance of actual radio producing intelligible words
    if (Math.random() < 0.05) {
      const radioWords = ['static', 'noise', 'frequency', 'signal', 'transmission'];
      const word = radioWords[Math.floor(Math.random() * radioWords.length)];
      
      return {
        type: 'radio',
        confidence: 0.2 + Math.random() * 0.3,
        word,
        timestamp: Date.now(),
        radioFrequency: frequency,
        signalStrength
      };
    }
    
    return null; // Most radio sweeps produce no intelligible response
  }

  private async generateWordBankResponse(contextWords: string[]): Promise<ResponseSource | null> {
    let selectedWord = '';
    let associationChain: string[] = [];
    let confidence = 0.6;
    
    if (contextWords.length > 0) {
      // Use context-aware word selection
      const contextualWords = this.wordAssociation.findWordsWithContext(contextWords, 10);
      if (contextualWords.length > 0) {
        selectedWord = contextualWords[Math.floor(Math.random() * Math.min(3, contextualWords.length))];
        associationChain = contextWords;
        confidence = 0.7 + Math.random() * 0.2;
      }
    }
    
    if (!selectedWord) {
      // Get recent context from triggers
      const recentTriggers = this.contextTrigger.getRecentTriggers(3);
      const activeCategories = this.contextTrigger.getActiveCategories();
      
      if (activeCategories.length > 0) {
        const randomCategory = activeCategories[Math.floor(Math.random() * activeCategories.length)];
        selectedWord = this.wordAssociation.getRandomWordFromCategory(randomCategory) || '';
        confidence = 0.5 + Math.random() * 0.3;
      } else {
        // Fallback to high-frequency paranormal words
        const fallbackWords = ['yes', 'no', 'here', 'help', 'love', 'peace', 'hello', 'goodbye'];
        selectedWord = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
        confidence = 0.4 + Math.random() * 0.2;
      }
    }
    
    if (selectedWord) {
      this.lastWordBankResponse = Date.now();
      this.consecutiveWordBankCount++;
      
      return {
        type: 'wordbank',
        confidence,
        word: selectedWord,
        timestamp: Date.now(),
        context: contextWords.join(', '),
        associationChain
      };
    }
    
    return null;
  }

  private async generateHybridResponse(contextWords: string[]): Promise<ResponseSource | null> {
    // Hybrid responses blend word bank intelligence with radio authenticity
    const wordBankResponse = await this.generateWordBankResponse(contextWords);
    const radioMetrics = await this.generateRadioResponse();
    
    if (wordBankResponse) {
      // Add radio characteristics to word bank response for authenticity
      return {
        ...wordBankResponse,
        type: 'hybrid',
        confidence: wordBankResponse.confidence * 0.8, // Slightly lower confidence
        radioFrequency: 88.1 + Math.random() * 20,
        signalStrength: -70 + Math.random() * 30
      };
    }
    
    return null;
  }

  private recordResponse(response: ResponseSource): void {
    this.recentResponses.unshift(response);
    
    if (this.recentResponses.length > this.maxResponseHistory) {
      this.recentResponses.pop();
    }
    
    // Update stats
    this.stats.totalResponses++;
    switch (response.type) {
      case 'radio':
        this.stats.radioResponses++;
        this.consecutiveWordBankCount = 0;
        break;
      case 'wordbank':
        this.stats.wordBankResponses++;
        break;
      case 'hybrid':
        this.stats.hybridResponses++;
        break;
    }
    
    this.emit('responseGenerated', response);
  }

  private updateDetectionRisk(response: ResponseSource): void {
    let risk = this.stats.detectionRisk;
    
    if (response.type === 'wordbank' || response.type === 'hybrid') {
      // Higher confidence word bank responses increase detection risk
      risk += response.confidence * 0.1;
      
      // Consecutive word bank responses increase risk
      if (this.consecutiveWordBankCount > 1) {
        risk += 0.15 * this.consecutiveWordBankCount;
      }
      
      // Perfect contextual matches increase risk
      if (response.associationChain && response.associationChain.length > 0) {
        risk += 0.05;
      }
    } else {
      // Radio responses gradually decrease detection risk
      risk = Math.max(0, risk - 0.02);
    }
    
    this.stats.detectionRisk = Math.min(1.0, risk);
    
    // Emit warning if detection risk gets too high
    if (this.stats.detectionRisk > 0.7) {
      this.emit('highDetectionRisk', this.stats.detectionRisk);
    }
  }

  private getRecentWordBankCount(lookBack: number): number {
    return this.recentResponses
      .slice(0, lookBack)
      .filter(r => r.type === 'wordbank' || r.type === 'hybrid')
      .length;
  }

  private startAdaptationLoop(): void {
    this.adaptationInterval = setInterval(() => {
      if (this.adaptationEnabled) {
        this.performPeriodicAdaptation();
      }
    }, 30000); // Every 30 seconds
  }

  private performPeriodicAdaptation(): void {
    const now = Date.now();
    
    // Don't adapt too frequently
    if (now - this.lastAdaptation < 60000) return; // Wait at least 1 minute
    
    const recentResponses = this.recentResponses.filter(r => 
      now - r.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentResponses.length < 3) return; // Not enough data
    
    // Analyze recent response effectiveness
    const wordBankSuccesses = recentResponses.filter(r => 
      (r.type === 'wordbank' || r.type === 'hybrid') && r.confidence > 0.6
    ).length;
    
    const radioSuccesses = recentResponses.filter(r => 
      r.type === 'radio' && r.confidence > 0.3
    ).length;
    
    // Adapt based on success rates
    const totalResponses = recentResponses.length;
    const wordBankEffectiveness = wordBankSuccesses / totalResponses;
    const radioEffectiveness = radioSuccesses / totalResponses;
    
    if (wordBankEffectiveness > radioEffectiveness * 1.5) {
      // Word bank is significantly more effective
      this.applyTemporaryBoost(0.1, 120000, 'effectiveness_adaptation_wordbank');
    } else if (radioEffectiveness > wordBankEffectiveness * 1.5) {
      // Radio is significantly more effective
      this.applyTemporaryBoost(-0.1, 120000, 'effectiveness_adaptation_radio');
    }
    
    this.lastAdaptation = now;
  }

  // Public API methods
  
  public updateConfiguration(config: Partial<ModeConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };
    
    // Update current ratios if not in temporary boost
    this.stats.currentBlendRatio.radio = this.configuration.radioSweepPercentage;
    this.stats.currentBlendRatio.wordBank = this.configuration.wordBankPercentage;
    
    this.emit('configurationUpdated', this.configuration);
  }

  public updateBlendingRules(rules: Partial<BlendingRules>): void {
    this.blendingRules = { ...this.blendingRules, ...rules };
    this.emit('blendingRulesUpdated', this.blendingRules);
  }

  public getConfiguration(): ModeConfiguration {
    return { ...this.configuration };
  }

  public getBlendingRules(): BlendingRules {
    return { ...this.blendingRules };
  }

  public getStats(): DualModeStats {
    return { ...this.stats };
  }

  public getRecentResponses(count = 10): ResponseSource[] {
    return this.recentResponses.slice(0, count);
  }

  public resetStats(): void {
    this.stats = {
      radioResponses: 0,
      wordBankResponses: 0,
      hybridResponses: 0,
      totalResponses: 0,
      currentBlendRatio: { 
        radio: this.configuration.radioSweepPercentage, 
        wordBank: this.configuration.wordBankPercentage 
      },
      adaptationHistory: [],
      detectionRisk: 0
    };
    
    this.recentResponses = [];
    this.consecutiveWordBankCount = 0;
    this.lastWordBankResponse = 0;
    
    this.emit('statsReset');
  }

  public setAdaptationEnabled(enabled: boolean): void {
    this.adaptationEnabled = enabled;
    this.emit('adaptationToggled', enabled);
  }

  public manuallyTriggerAdaptation(reason: string, boostAmount: number, duration: number): void {
    this.applyTemporaryBoost(boostAmount, duration, `manual_${reason}`);
  }

  public getEffectivenessAnalysis(): {
    wordBankEffectiveness: number;
    radioEffectiveness: number;
    hybridEffectiveness: number;
    recommendation: string;
  } {
    const recentResponses = this.recentResponses.slice(0, 20);
    
    if (recentResponses.length === 0) {
      return {
        wordBankEffectiveness: 0,
        radioEffectiveness: 0,
        hybridEffectiveness: 0,
        recommendation: 'Not enough data for analysis'
      };
    }
    
    const analyzeType = (type: ResponseSource['type']) => {
      const typeResponses = recentResponses.filter(r => r.type === type);
      if (typeResponses.length === 0) return 0;
      
      const avgConfidence = typeResponses.reduce((sum, r) => sum + r.confidence, 0) / typeResponses.length;
      return avgConfidence;
    };
    
    const wordBankEffectiveness = analyzeType('wordbank');
    const radioEffectiveness = analyzeType('radio');
    const hybridEffectiveness = analyzeType('hybrid');
    
    let recommendation = 'Current balance seems appropriate';
    
    if (wordBankEffectiveness > radioEffectiveness * 1.5) {
      recommendation = 'Consider increasing word bank percentage for better communication';
    } else if (radioEffectiveness > wordBankEffectiveness * 1.5) {
      recommendation = 'Consider increasing radio sweep percentage for more authenticity';
    } else if (hybridEffectiveness > Math.max(wordBankEffectiveness, radioEffectiveness) * 1.2) {
      recommendation = 'Hybrid responses are most effective - consider enabling more blending';
    }
    
    return {
      wordBankEffectiveness,
      radioEffectiveness,
      hybridEffectiveness,
      recommendation
    };
  }

  public cleanup(): void {
    if (this.adaptationInterval) {
      clearInterval(this.adaptationInterval);
      this.adaptationInterval = null;
    }
    
    this.emit('cleanup');
  }
}