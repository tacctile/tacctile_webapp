import { EventEmitter } from 'events';

export interface EnergyLevel {
  level: number; // 0.0 to 1.0
  label: 'dormant' | 'low' | 'moderate' | 'active' | 'high' | 'intense';
  baseResponseDelay: number; // milliseconds
  variabilityRange: number; // +/- ms variation
  responseProbability: number; // 0.0 to 1.0 chance of responding
  burstProbability: number; // chance of multiple responses
  description: string;
}

export interface TimingPattern {
  name: string;
  description: string;
  baseDelay: number;
  delayVariation: number;
  responseChance: number;
  burstSettings: {
    enabled: boolean;
    maxBurst: number;
    burstDelay: number;
    burstChance: number;
  };
  energyInfluence: number; // how much energy affects this pattern
}

export interface ResponseEvent {
  id: string;
  timestamp: number;
  triggerTime: number;
  actualDelay: number;
  plannedDelay: number;
  energyLevel: number;
  responseType: string;
  isBurst: boolean;
  burstIndex?: number;
  confidence: number;
}

export interface EnergyInfluence {
  questionType: string;
  energyBoost: number;
  duration: number; // milliseconds
  description: string;
}

export class ResponseTimingSystem extends EventEmitter {
  private currentEnergyLevel = 0.3; // Start at low-moderate
  private energyHistory: { timestamp: number, level: number }[] = [];
  private lastResponseTime = 0;
  private recentResponses: ResponseEvent[] = [];
  private maxResponseHistory = 50;
  
  private energyLevels: EnergyLevel[];
  private timingPatterns: TimingPattern[];
  private energyInfluences: EnergyInfluence[];
  
  // Configuration
  private energyDecayRate = 0.95; // per minute
  private energyDecayInterval: NodeJS.Timeout | null = null;
  private questionBoostDuration = 30000; // 30 seconds
  private maxEnergyBoosts = 5;
  
  // Timing state
  private pendingResponses: Map<string, NodeJS.Timeout> = new Map();
  private burstQueue: Array<{ word: string, delay: number }> = [];

  constructor() {
    super();
    this.initializeEnergyLevels();
    this.initializeTimingPatterns();
    this.initializeEnergyInfluences();
    this.startEnergyDecay();
  }

  private initializeEnergyLevels(): void {
    this.energyLevels = [
      {
        level: 0.0,
        label: 'dormant',
        baseResponseDelay: 8000,
        variabilityRange: 4000,
        responseeProbability: 0.1,
        burstProbability: 0.0,
        description: 'No detectable spiritual activity'
      },
      {
        level: 0.2,
        label: 'low',
        baseResponseDelay: 5000,
        variabilityRange: 3000,
        responseeProbability: 0.3,
        burstProbability: 0.05,
        description: 'Minimal spiritual presence detected'
      },
      {
        level: 0.4,
        label: 'moderate',
        baseResponseDelay: 3000,
        variabilityRange: 2000,
        responseeProbability: 0.6,
        burstProbability: 0.15,
        description: 'Moderate spiritual activity'
      },
      {
        level: 0.6,
        label: 'active',
        baseResponseDelay: 2000,
        variabilityRange: 1500,
        responseeProbability: 0.8,
        burstProbability: 0.25,
        description: 'Strong spiritual presence'
      },
      {
        level: 0.8,
        label: 'high',
        baseResponseDelay: 1500,
        variabilityRange: 1000,
        responseeProbability: 0.9,
        burstProbability: 0.4,
        description: 'Very active spiritual communication'
      },
      {
        level: 1.0,
        label: 'intense',
        baseResponseDelay: 800,
        variabilityRange: 600,
        responseeProbability: 0.95,
        burstProbability: 0.6,
        description: 'Intense spiritual manifestation'
      }
    ];
  }

  private initializeTimingPatterns(): void {
    this.timingPatterns = [
      {
        name: 'immediate',
        description: 'Quick response to direct questions',
        baseDelay: 500,
        delayVariation: 300,
        responseChance: 0.9,
        burstSettings: {
          enabled: false,
          maxBurst: 1,
          burstDelay: 0,
          burstChance: 0
        },
        energyInfluence: 0.3
      },
      {
        name: 'natural',
        description: 'Natural human-like response timing',
        baseDelay: 2000,
        delayVariation: 1000,
        responseChance: 0.7,
        burstSettings: {
          enabled: true,
          maxBurst: 2,
          burstDelay: 1500,
          burstChance: 0.2
        },
        energyInfluence: 0.8
      },
      {
        name: 'hesitant',
        description: 'Delayed response showing uncertainty',
        baseDelay: 4000,
        delayVariation: 2000,
        responseChance: 0.5,
        burstSettings: {
          enabled: false,
          maxBurst: 1,
          burstDelay: 0,
          burstChance: 0
        },
        energyInfluence: 0.6
      },
      {
        name: 'eager',
        description: 'Quick, enthusiastic responses',
        baseDelay: 800,
        delayVariation: 400,
        responseChance: 0.95,
        burstSettings: {
          enabled: true,
          maxBurst: 3,
          burstDelay: 800,
          burstChance: 0.4
        },
        energyInfluence: 1.0
      },
      {
        name: 'reluctant',
        description: 'Slow, unwilling responses',
        baseDelay: 6000,
        delayVariation: 3000,
        responseChance: 0.3,
        burstSettings: {
          enabled: false,
          maxBurst: 1,
          burstDelay: 0,
          burstChance: 0
        },
        energyInfluence: 0.4
      },
      {
        name: 'conversational',
        description: 'Back-and-forth dialogue timing',
        baseDelay: 1800,
        delayVariation: 800,
        responseChance: 0.8,
        burstSettings: {
          enabled: true,
          maxBurst: 4,
          burstDelay: 2000,
          burstChance: 0.3
        },
        energyInfluence: 0.9
      }
    ];
  }

  private initializeEnergyInfluences(): void {
    this.energyInfluences = [
      {
        questionType: 'name',
        energyBoost: 0.3,
        duration: 45000,
        description: 'Identity questions create strong connection'
      },
      {
        questionType: 'yes_no',
        energyBoost: 0.2,
        duration: 20000,
        description: 'Simple questions allow easy responses'
      },
      {
        questionType: 'emotion',
        energyBoost: 0.4,
        duration: 60000,
        description: 'Emotional questions evoke strong reactions'
      },
      {
        questionType: 'family',
        energyBoost: 0.5,
        duration: 90000,
        description: 'Family connections provide powerful energy'
      },
      {
        questionType: 'death',
        energyBoost: 0.6,
        duration: 120000,
        description: 'Death-related questions trigger intense responses'
      },
      {
        questionType: 'help',
        energyBoost: 0.35,
        duration: 75000,
        description: 'Requests for help motivate communication'
      },
      {
        questionType: 'location',
        energyBoost: 0.25,
        duration: 30000,
        description: 'Location questions ground spiritual presence'
      },
      {
        questionType: 'general',
        energyBoost: 0.15,
        duration: 15000,
        description: 'General conversation maintains baseline energy'
      }
    ];
  }

  private startEnergyDecay(): void {
    this.energyDecayInterval = setInterval(() => {
      this.decayEnergy();
    }, 60000); // Every minute
  }

  private decayEnergy(): void {
    if (this.currentEnergyLevel > 0.1) {
      this.currentEnergyLevel *= this.energyDecayRate;
      this.recordEnergyLevel();
      this.emit('energyDecayed', this.currentEnergyLevel);
    }
  }

  private recordEnergyLevel(): void {
    this.energyHistory.push({
      timestamp: Date.now(),
      level: this.currentEnergyLevel
    });

    // Keep last 100 readings
    if (this.energyHistory.length > 100) {
      this.energyHistory.shift();
    }
  }

  public scheduleResponse(
    word: string, 
    responseType: string, 
    questionType?: string,
    patternName = 'natural'
  ): Promise<{ word: string, delay: number }> {
    return new Promise((resolve) => {
      // Apply energy boost from question
      if (questionType) {
        this.applyEnergyBoost(questionType);
      }

      // Get current energy characteristics
      const energyLevel = this.getCurrentEnergyLevel();
      const pattern = this.getTimingPattern(patternName);

      // Calculate if response should happen
      const shouldRespond = this.shouldRespond(energyLevel, pattern, responseType);
      
      if (!shouldRespond) {
        resolve({ word: '', delay: 0 });
        return;
      }

      // Calculate response delay
      const delay = this.calculateResponseDelay(energyLevel, pattern, responseType);
      
      // Check for burst response
      const shouldBurst = this.shouldTriggerBurst(energyLevel, pattern);
      
      // Create response event
      const responseEvent: ResponseEvent = {
        id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        triggerTime: Date.now(),
        actualDelay: delay,
        plannedDelay: delay,
        energyLevel: this.currentEnergyLevel,
        responseType,
        isBurst: shouldBurst,
        confidence: this.calculateResponseConfidence(energyLevel, pattern)
      };

      // Schedule the response
      const timeoutId = setTimeout(() => {
        this.executeResponse(responseEvent, word, resolve);
        this.pendingResponses.delete(responseEvent.id);
      }, delay);

      this.pendingResponses.set(responseEvent.id, timeoutId);
      
      // Schedule burst responses if applicable
      if (shouldBurst && pattern.burstSettings.enabled) {
        this.scheduleBurstResponses(responseEvent, word, pattern);
      }

      this.emit('responseScheduled', responseEvent);
    });
  }

  private applyEnergyBoost(questionType: string): void {
    const influence = this.energyInfluences.find(inf => 
      questionType.includes(inf.questionType) || inf.questionType === 'general'
    ) || this.energyInfluences.find(inf => inf.questionType === 'general')!;

    const boost = influence.energyBoost * (1.0 - this.currentEnergyLevel * 0.5); // Diminishing returns
    this.currentEnergyLevel = Math.min(1.0, this.currentEnergyLevel + boost);
    
    this.recordEnergyLevel();
    this.emit('energyBoosted', { 
      questionType, 
      boost, 
      newLevel: this.currentEnergyLevel,
      duration: influence.duration 
    });

    // Schedule energy decay for this specific boost
    setTimeout(() => {
      this.currentEnergyLevel = Math.max(0.1, this.currentEnergyLevel - boost * 0.7);
      this.recordEnergyLevel();
      this.emit('energyBoostDecayed', this.currentEnergyLevel);
    }, influence.duration);
  }

  private getCurrentEnergyLevel(): EnergyLevel {
    // Find the closest energy level
    let closestLevel = this.energyLevels[0];
    let minDiff = Math.abs(this.currentEnergyLevel - closestLevel.level);

    this.energyLevels.forEach(level => {
      const diff = Math.abs(this.currentEnergyLevel - level.level);
      if (diff < minDiff) {
        minDiff = diff;
        closestLevel = level;
      }
    });

    return closestLevel;
  }

  private getTimingPattern(patternName: string): TimingPattern {
    return this.timingPatterns.find(p => p.name === patternName) || this.timingPatterns[1]; // Default to 'natural'
  }

  private shouldRespond(energyLevel: EnergyLevel, pattern: TimingPattern, responseType: string): boolean {
    let baseChance = energyLevel.responseeProbability * pattern.responseChance;

    // Boost chance based on response type
    const responseTypeBoosts: { [key: string]: number } = {
      'yes_no': 1.3,
      'name': 1.2,
      'emotion': 1.1,
      'family': 1.4,
      'death': 1.5,
      'help': 1.3,
      'location': 1.0,
      'general': 1.0
    };

    const boost = responseTypeBoosts[responseType] || 1.0;
    baseChance *= boost;

    // Reduce chance if too many recent responses
    const recentCount = this.recentResponses.filter(r => 
      Date.now() - r.timestamp < 10000 // Last 10 seconds
    ).length;

    if (recentCount > 3) {
      baseChance *= 0.5;
    }

    // Random factor
    return Math.random() < Math.min(baseChance, 0.95);
  }

  private calculateResponseDelay(energyLevel: EnergyLevel, pattern: TimingPattern, responseType: string): number {
    // Start with base delay from energy level
    let delay = energyLevel.baseResponseDelay;

    // Modify with pattern
    const patternInfluence = pattern.energyInfluence;
    const patternDelay = pattern.baseDelay + (Math.random() - 0.5) * pattern.delayVariation * 2;
    
    delay = (delay * (1 - patternInfluence)) + (patternDelay * patternInfluence);

    // Add random variation from energy level
    const variation = (Math.random() - 0.5) * energyLevel.variabilityRange * 2;
    delay += variation;

    // Response type modifiers
    const responseTypeModifiers: { [key: string]: number } = {
      'yes_no': 0.7,        // Quick yes/no responses
      'name': 1.2,          // Names take longer to formulate
      'emotion': 0.9,       // Emotions are immediate
      'family': 1.1,        // Family requires thought
      'death': 1.3,         // Death topics are heavy
      'help': 0.8,          // Help requests are urgent
      'location': 1.0,      // Location is neutral
      'general': 1.0        // General is baseline
    };

    const modifier = responseTypeModifiers[responseType] || 1.0;
    delay *= modifier;

    // Ensure minimum and maximum bounds
    delay = Math.max(200, Math.min(delay, 15000));

    // Account for time since last response (prevent rapid-fire)
    const timeSinceLastResponse = Date.now() - this.lastResponseTime;
    if (timeSinceLastResponse < 3000) { // Less than 3 seconds
      delay += 1000; // Add 1 second delay
    }

    return Math.round(delay);
  }

  private shouldTriggerBurst(energyLevel: EnergyLevel, pattern: TimingPattern): boolean {
    if (!pattern.burstSettings.enabled) return false;
    
    const burstChance = energyLevel.burstProbability * pattern.burstSettings.burstChance;
    return Math.random() < burstChance;
  }

  private scheduleBurstResponses(initialResponse: ResponseEvent, word: string, pattern: TimingPattern): void {
    const burstCount = Math.floor(Math.random() * pattern.burstSettings.maxBurst) + 1;
    
    for (let i = 1; i <= burstCount; i++) {
      const burstDelay = initialResponse.actualDelay + (pattern.burstSettings.burstDelay * i) + 
                        (Math.random() - 0.5) * 500; // Add some variation
      
      const burstEvent: ResponseEvent = {
        ...initialResponse,
        id: `burst_${initialResponse.id}_${i}`,
        actualDelay: burstDelay,
        plannedDelay: burstDelay,
        isBurst: true,
        burstIndex: i,
        confidence: initialResponse.confidence * (1 - i * 0.1) // Decrease confidence with each burst
      };

      const timeoutId = setTimeout(() => {
        this.executeBurstResponse(burstEvent, word);
        this.pendingResponses.delete(burstEvent.id);
      }, burstDelay);

      this.pendingResponses.set(burstEvent.id, timeoutId);
    }
  }

  private executeResponse(
    responseEvent: ResponseEvent, 
    word: string, 
    resolve: (value: { word: string, delay: number }) => void
  ): void {
    responseEvent.timestamp = Date.now();
    responseEvent.actualDelay = responseEvent.timestamp - responseEvent.triggerTime;
    
    this.lastResponseTime = responseEvent.timestamp;
    this.recentResponses.unshift(responseEvent);
    
    if (this.recentResponses.length > this.maxResponseHistory) {
      this.recentResponses.pop();
    }

    // Slight energy boost from successful response
    this.currentEnergyLevel = Math.min(1.0, this.currentEnergyLevel + 0.02);
    
    this.emit('responseExecuted', responseEvent);
    resolve({ word, delay: responseEvent.actualDelay });
  }

  private executeBurstResponse(responseEvent: ResponseEvent, word: string): void {
    this.executeResponse(responseEvent, word, () => {
      this.emit('burstResponseExecuted', responseEvent);
    });
  }

  private calculateResponseConfidence(energyLevel: EnergyLevel, pattern: TimingPattern): number {
    let confidence = energyLevel.responseeProbability * 0.5 + pattern.responseChance * 0.3;
    
    // Add random factor
    confidence += (Math.random() - 0.5) * 0.4;
    
    // Boost confidence during high energy
    if (this.currentEnergyLevel > 0.7) {
      confidence += 0.2;
    }
    
    return Math.max(0.1, Math.min(confidence, 1.0));
  }

  public setEnergyLevel(level: number): void {
    this.currentEnergyLevel = Math.max(0.0, Math.min(1.0, level));
    this.recordEnergyLevel();
    this.emit('energyLevelSet', this.currentEnergyLevel);
  }

  public modifyEnergyLevel(delta: number): void {
    this.setEnergyLevel(this.currentEnergyLevel + delta);
  }

  public getCurrentEnergy(): number {
    return this.currentEnergyLevel;
  }

  public getEnergyDescription(): string {
    const level = this.getCurrentEnergyLevel();
    return level.description;
  }

  public getEnergyLabel(): string {
    const level = this.getCurrentEnergyLevel();
    return level.label;
  }

  public getEnergyHistory(minutes = 10): { timestamp: number, level: number }[] {
    const cutoff = Date.now() - (minutes * 60000);
    return this.energyHistory.filter(entry => entry.timestamp > cutoff);
  }

  public getResponseHistory(count = 10): ResponseEvent[] {
    return this.recentResponses.slice(0, count);
  }

  public getResponseStats(): {
    totalResponses: number;
    averageDelay: number;
    burstResponses: number;
    currentEnergyLevel: number;
    energyLabel: string;
    responseRate: number; // responses per minute
  } {
    const recentResponses = this.recentResponses.filter(r => 
      Date.now() - r.timestamp < 600000 // Last 10 minutes
    );

    const totalResponses = recentResponses.length;
    const averageDelay = totalResponses > 0 
      ? recentResponses.reduce((sum, r) => sum + r.actualDelay, 0) / totalResponses 
      : 0;
    
    const burstResponses = recentResponses.filter(r => r.isBurst).length;
    const responseRate = totalResponses / 10; // per minute over 10 minutes

    return {
      totalResponses,
      averageDelay,
      burstResponses,
      currentEnergyLevel: this.currentEnergyLevel,
      energyLabel: this.getEnergyLabel(),
      responseRate
    };
  }

  public cancelPendingResponses(): void {
    this.pendingResponses.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.pendingResponses.clear();
    this.emit('responsesCancelled');
  }

  public getAvailablePatterns(): string[] {
    return this.timingPatterns.map(p => p.name);
  }

  public getPatternInfo(patternName: string): TimingPattern | null {
    return this.timingPatterns.find(p => p.name === patternName) || null;
  }

  public simulateEnergySpike(intensity = 0.5, duration = 30000): void {
    const oldLevel = this.currentEnergyLevel;
    this.currentEnergyLevel = Math.min(1.0, this.currentEnergyLevel + intensity);
    
    this.recordEnergyLevel();
    this.emit('energySpike', { oldLevel, newLevel: this.currentEnergyLevel, intensity });

    // Gradually decay back to baseline
    setTimeout(() => {
      const decaySteps = 10;
      const decayAmount = intensity / decaySteps;
      const decayInterval = duration / decaySteps;

      let step = 0;
      const decayTimer = setInterval(() => {
        this.currentEnergyLevel = Math.max(0.1, this.currentEnergyLevel - decayAmount);
        this.recordEnergyLevel();
        
        step++;
        if (step >= decaySteps) {
          clearInterval(decayTimer);
          this.emit('energySpikeDecayed', this.currentEnergyLevel);
        }
      }, decayInterval);
    }, 2000); // Wait 2 seconds before starting decay
  }

  public cleanup(): void {
    if (this.energyDecayInterval) {
      clearInterval(this.energyDecayInterval);
      this.energyDecayInterval = null;
    }
    
    this.cancelPendingResponses();
    this.emit('cleanup');
  }
}