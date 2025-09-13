import { EventEmitter } from 'events';
import { WordAssociationEngine } from './WordAssociationEngine';
import { ContextTriggerSystem, ContextTrigger } from './ContextTriggerSystem';

export interface ConversationContext {
  themes: Map<string, number>; // theme -> strength
  participants: Map<string, ParticipantProfile>;
  topicHistory: TopicSegment[];
  emotionalState: EmotionalProfile;
  temporalContext: TemporalProfile;
  locationContext: LocationProfile;
}

export interface ParticipantProfile {
  name: string;
  mentionCount: number;
  associatedWords: string[];
  relationship?: 'family' | 'friend' | 'unknown' | 'investigator';
  characteristics: string[];
  lastMention: number;
  contextualWeight: number;
}

export interface TopicSegment {
  id: string;
  startTime: number;
  endTime?: number;
  primaryTheme: string;
  keywords: string[];
  participantFocus?: string;
  emotionalTone: 'neutral' | 'positive' | 'negative' | 'intense';
  wordCount: number;
  significance: number;
}

export interface EmotionalProfile {
  primaryEmotion: string;
  emotionHistory: { emotion: string, timestamp: number, intensity: number }[];
  volatility: number; // how much emotions change
  baseline: string; // default emotional state
}

export interface TemporalProfile {
  timeReferences: string[];
  historicalPeriod?: string;
  ageIndications?: number;
  temporalFocus: 'past' | 'present' | 'future' | 'timeless';
}

export interface LocationProfile {
  mentionedLocations: string[];
  spatialAwareness: 'local' | 'building' | 'area' | 'distant' | 'unknown';
  locationPreferences: Map<string, number>;
}

export interface LearningRule {
  trigger: string; // what triggers this rule
  condition: (context: ConversationContext) => boolean;
  adaptation: {
    categoryWeights: Map<string, number>;
    wordBoosts: Map<string, number>;
    responsePatterns: string[];
  };
  strength: number;
  description: string;
}

export interface SessionMemory {
  sessionId: string;
  startTime: number;
  endTime?: number;
  conversationContext: ConversationContext;
  learningRules: LearningRule[];
  significantEvents: SessionEvent[];
  adaptationHistory: AdaptationEvent[];
}

export interface SessionEvent {
  id: string;
  timestamp: number;
  type: 'theme_shift' | 'participant_focus' | 'emotional_change' | 'learning_trigger';
  description: string;
  context: any;
  significance: number;
}

export interface AdaptationEvent {
  timestamp: number;
  rule: string;
  trigger: string;
  adaptation: any;
  effectiveness: number;
}

export class SessionIntelligenceSystem extends EventEmitter {
  private currentSession: SessionMemory | null = null;
  private wordAssociation: WordAssociationEngine;
  private contextTrigger: ContextTriggerSystem;
  
  // Learning and adaptation
  private baseLearningRules: LearningRule[];
  private dynamicLearningRules: LearningRule[] = [];
  private adaptationThreshold = 3; // minimum mentions to create adaptation
  private maxLearningRules = 20;
  
  // Context tracking
  private contextUpdateInterval: NodeJS.Timeout | null = null;
  private lastContextUpdate = 0;
  private contextUpdateFrequency = 10000; // 10 seconds

  constructor(
    wordAssociation: WordAssociationEngine,
    contextTrigger: ContextTriggerSystem
  ) {
    super();
    
    this.wordAssociation = wordAssociation;
    this.contextTrigger = contextTrigger;
    
    this.initializeBaseLearningRules();
    this.setupEventListeners();
  }

  private initializeBaseLearningRules(): void {
    this.baseLearningRules = [
      {
        trigger: 'child_context',
        condition: (context) => 
          context.participants.has('child') || 
          Array.from(context.themes.keys()).some(theme => 
            ['child', 'young', 'little', 'baby', 'kid'].includes(theme)
          ),
        adaptation: {
          categoryWeights: new Map([
            ['family', 2.0],
            ['objects', 1.8], // toys, games
            ['emotions', 1.6],
            ['actions', 1.4]   // play, run, etc
          ]),
          wordBoosts: new Map([
            ['toy', 2.0],
            ['play', 1.8],
            ['mommy', 2.2],
            ['daddy', 2.2],
            ['school', 1.6],
            ['friend', 1.5],
            ['game', 1.7],
            ['fun', 1.5]
          ]),
          responsePatterns: ['eager', 'immediate', 'conversational']
        },
        strength: 0.8,
        description: 'Adapts responses when child spirit is detected'
      },
      
      {
        trigger: 'family_focus',
        condition: (context) => {
          const familyMentions = Array.from(context.themes.entries())
            .filter(([theme]) => ['family', 'mother', 'father', 'child', 'husband', 'wife'].includes(theme))
            .reduce((sum, [, strength]) => sum + strength, 0);
          return familyMentions > 5;
        },
        adaptation: {
          categoryWeights: new Map([
            ['family', 2.5],
            ['names', 2.0],
            ['emotions', 2.0],
            ['locations', 1.5] // home, house
          ]),
          wordBoosts: new Map([
            ['love', 2.0],
            ['miss', 1.8],
            ['home', 1.6],
            ['together', 1.5],
            ['remember', 1.7]
          ]),
          responsePatterns: ['natural', 'conversational', 'hesitant']
        },
        strength: 0.9,
        description: 'Strengthens family-related responses when family is primary focus'
      },
      
      {
        trigger: 'emotional_distress',
        condition: (context) => 
          context.emotionalState.primaryEmotion === 'sad' ||
          context.emotionalState.primaryEmotion === 'angry' ||
          context.emotionalState.volatility > 0.7,
        adaptation: {
          categoryWeights: new Map([
            ['emotions', 2.0],
            ['responses', 1.8],
            ['death_afterlife', 1.6]
          ]),
          wordBoosts: new Map([
            ['hurt', 1.8],
            ['pain', 1.8],
            ['help', 2.0],
            ['sorry', 1.6],
            ['peace', 1.7],
            ['understand', 1.5]
          ]),
          responsePatterns: ['hesitant', 'natural', 'immediate']
        },
        strength: 0.7,
        description: 'Provides comfort-focused responses during emotional distress'
      },
      
      {
        trigger: 'historical_context',
        condition: (context) => 
          context.temporalContext.historicalPeriod !== undefined ||
          context.temporalContext.ageIndications !== undefined,
        adaptation: {
          categoryWeights: new Map([
            ['time', 2.0],
            ['numbers', 1.6],
            ['objects', 1.4], // period-appropriate items
            ['locations', 1.3]
          ]),
          wordBoosts: new Map([
            ['year', 1.6],
            ['time', 1.5],
            ['remember', 1.8],
            ['before', 1.4],
            ['old', 1.3]
          ]),
          responsePatterns: ['hesitant', 'natural']
        },
        strength: 0.6,
        description: 'Adapts to historical or temporal context'
      },
      
      {
        trigger: 'death_trauma',
        condition: (context) => {
          const deathThemes = Array.from(context.themes.keys())
            .filter(theme => ['death', 'died', 'killed', 'hurt', 'pain', 'accident'].includes(theme));
          return deathThemes.length > 0 && context.emotionalState.volatility > 0.5;
        },
        adaptation: {
          categoryWeights: new Map([
            ['death_afterlife', 2.2],
            ['emotions', 2.0],
            ['medical', 1.8],
            ['responses', 1.6]
          ]),
          wordBoosts: new Map([
            ['peace', 2.0],
            ['rest', 1.8],
            ['forgive', 1.7],
            ['understand', 1.6],
            ['love', 1.8],
            ['remember', 1.5]
          ]),
          responsePatterns: ['hesitant', 'reluctant', 'natural']
        },
        strength: 0.9,
        description: 'Sensitive responses for traumatic death scenarios'
      },
      
      {
        trigger: 'communication_seeking',
        condition: (context) => {
          const commThemes = Array.from(context.themes.keys())
            .filter(theme => ['hello', 'talk', 'speak', 'message', 'communicate'].includes(theme));
          return commThemes.length > 2;
        },
        adaptation: {
          categoryWeights: new Map([
            ['responses', 2.5],
            ['paranormal', 1.8],
            ['emotions', 1.4]
          ]),
          wordBoosts: new Map([
            ['yes', 2.2],
            ['here', 2.0],
            ['hello', 1.8],
            ['listen', 1.6],
            ['understand', 1.7],
            ['talk', 1.5]
          ]),
          responsePatterns: ['immediate', 'eager', 'conversational']
        },
        strength: 0.8,
        description: 'Encourages active communication when spirit seems willing to talk'
      }
    ];
  }

  private setupEventListeners(): void {
    this.contextTrigger.on('triggerDetected', (trigger: ContextTrigger) => {
      this.processContextTrigger(trigger);
    });
    
    this.wordAssociation.on('contextUpdated', (context: string[]) => {
      this.updateConversationContext(context);
    });
  }

  public startSession(sessionId: string): void {
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      conversationContext: this.initializeConversationContext(),
      learningRules: [...this.baseLearningRules],
      significantEvents: [],
      adaptationHistory: []
    };
    
    this.startContextTracking();
    this.emit('sessionStarted', this.currentSession);
  }

  public endSession(): SessionMemory | null {
    if (!this.currentSession) return null;
    
    this.currentSession.endTime = Date.now();
    this.stopContextTracking();
    
    const completedSession = { ...this.currentSession };
    this.emit('sessionEnded', completedSession);
    
    this.currentSession = null;
    return completedSession;
  }

  private initializeConversationContext(): ConversationContext {
    return {
      themes: new Map(),
      participants: new Map(),
      topicHistory: [],
      emotionalState: {
        primaryEmotion: 'neutral',
        emotionHistory: [],
        volatility: 0,
        baseline: 'neutral'
      },
      temporalContext: {
        timeReferences: [],
        temporalFocus: 'present'
      },
      locationContext: {
        mentionedLocations: [],
        spatialAwareness: 'unknown',
        locationPreferences: new Map()
      }
    };
  }

  private processContextTrigger(trigger: ContextTrigger): void {
    if (!this.currentSession) return;
    
    const context = this.currentSession.conversationContext;
    
    // Update themes
    trigger.targetCategories.forEach(category => {
      const currentStrength = context.themes.get(category) || 0;
      context.themes.set(category, currentStrength + trigger.confidence);
    });
    
    // Extract participant information
    this.extractParticipants(trigger.inputText, context);
    
    // Update emotional state
    this.updateEmotionalState(trigger, context);
    
    // Update temporal context
    this.updateTemporalContext(trigger.extractedKeywords, context);
    
    // Update location context
    this.updateLocationContext(trigger.extractedKeywords, context);
    
    // Check for learning opportunities
    this.checkLearningTriggers(context);
    
    // Update topic segmentation
    this.updateTopicSegmentation(trigger, context);
    
    this.emit('contextUpdated', context);
  }

  private extractParticipants(inputText: string, context: ConversationContext): void {
    const text = inputText.toLowerCase();
    
    // Check for explicit names (simplified - would be more sophisticated)
    const namePatterns = [
      /(?:my name is|i am|call me|i'm) (\w+)/i,
      /(?:are you|is your name|were you) (\w+)/i
    ];
    
    namePatterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].toLowerCase();
        if (name.length > 2 && name.length < 15) {
          this.addParticipant(name, 'unknown', context);
        }
      }
    });
    
    // Check for relationship indicators
    const relationshipIndicators = [
      { pattern: /\b(?:child|kid|baby|little)\b/i, type: 'child' },
      { pattern: /\b(?:mother|mom|mama)\b/i, type: 'mother' },
      { pattern: /\b(?:father|dad|daddy)\b/i, type: 'father' },
      { pattern: /\b(?:husband|wife)\b/i, type: 'spouse' },
      { pattern: /\b(?:brother|sister)\b/i, type: 'sibling' }
    ];
    
    relationshipIndicators.forEach(({ pattern, type }) => {
      if (pattern.test(text)) {
        this.addParticipant(type, 'family', context);
      }
    });
  }

  private addParticipant(name: string, relationship: ParticipantProfile['relationship'], context: ConversationContext): void {
    const existing = context.participants.get(name);
    
    if (existing) {
      existing.mentionCount++;
      existing.lastMention = Date.now();
      existing.contextualWeight = Math.min(2.0, existing.contextualWeight + 0.2);
    } else {
      context.participants.set(name, {
        name,
        mentionCount: 1,
        associatedWords: [],
        relationship,
        characteristics: [],
        lastMention: Date.now(),
        contextualWeight: 0.5
      });
    }
  }

  private updateEmotionalState(trigger: ContextTrigger, context: ConversationContext): void {
    const emotionKeywords = {
      'sad': ['sad', 'cry', 'hurt', 'pain', 'miss', 'lost', 'alone'],
      'angry': ['angry', 'mad', 'hate', 'furious', 'upset'],
      'happy': ['happy', 'joy', 'glad', 'smile', 'laugh', 'good'],
      'scared': ['scared', 'afraid', 'fear', 'terrified', 'worried'],
      'peaceful': ['peace', 'calm', 'rest', 'serene', 'quiet'],
      'confused': ['confused', 'lost', 'don\'t understand', 'where', 'what']
    };
    
    let detectedEmotion = 'neutral';
    let maxScore = 0;
    
    Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
      const score = keywords.filter(keyword => 
        trigger.extractedKeywords.includes(keyword) || trigger.inputText.includes(keyword)
      ).length;
      
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    });
    
    if (maxScore > 0) {
      const intensity = Math.min(1.0, maxScore * 0.3 + trigger.confidence * 0.4);
      
      context.emotionalState.emotionHistory.push({
        emotion: detectedEmotion,
        timestamp: Date.now(),
        intensity
      });
      
      // Update primary emotion if this is strong enough
      if (intensity > 0.6 || context.emotionalState.primaryEmotion === 'neutral') {
        context.emotionalState.primaryEmotion = detectedEmotion;
      }
      
      // Update volatility based on emotion changes
      this.updateEmotionalVolatility(context);
    }
  }

  private updateEmotionalVolatility(context: ConversationContext): void {
    const recentEmotions = context.emotionalState.emotionHistory.slice(-5);
    
    if (recentEmotions.length < 2) {
      context.emotionalState.volatility = 0;
      return;
    }
    
    let changes = 0;
    for (let i = 1; i < recentEmotions.length; i++) {
      if (recentEmotions[i].emotion !== recentEmotions[i - 1].emotion) {
        changes++;
      }
    }
    
    context.emotionalState.volatility = changes / (recentEmotions.length - 1);
  }

  private updateTemporalContext(keywords: string[], context: ConversationContext): void {
    const timeWords = keywords.filter(word => 
      ['when', 'time', 'year', 'day', 'night', 'before', 'after', 'now', 'then', 'old', 'young'].includes(word)
    );
    
    timeWords.forEach(word => {
      if (!context.temporalContext.timeReferences.includes(word)) {
        context.temporalContext.timeReferences.push(word);
      }
    });
    
    // Detect age indicators
    const agePattern = /\b(\d+)\s*years?\s*old\b/i;
    const ageMatch = keywords.join(' ').match(agePattern);
    if (ageMatch) {
      context.temporalContext.ageIndications = parseInt(ageMatch[1]);
    }
    
    // Determine temporal focus
    const pastIndicators = ['before', 'was', 'were', 'then', 'remember'];
    const presentIndicators = ['now', 'here', 'today', 'current'];
    const futureIndicators = ['will', 'going', 'future', 'tomorrow'];
    
    const pastScore = pastIndicators.filter(word => keywords.includes(word)).length;
    const presentScore = presentIndicators.filter(word => keywords.includes(word)).length;
    const futureScore = futureIndicators.filter(word => keywords.includes(word)).length;
    
    if (pastScore > presentScore && pastScore > futureScore) {
      context.temporalContext.temporalFocus = 'past';
    } else if (futureScore > presentScore && futureScore > pastScore) {
      context.temporalContext.temporalFocus = 'future';
    } else if (presentScore > 0) {
      context.temporalContext.temporalFocus = 'present';
    }
  }

  private updateLocationContext(keywords: string[], context: ConversationContext): void {
    const locationWords = [
      'here', 'there', 'home', 'house', 'room', 'kitchen', 'bedroom', 'attic', 'basement',
      'upstairs', 'downstairs', 'outside', 'inside', 'garden', 'yard', 'school', 'work'
    ];
    
    const mentionedLocations = keywords.filter(word => locationWords.includes(word));
    
    mentionedLocations.forEach(location => {
      if (!context.locationContext.mentionedLocations.includes(location)) {
        context.locationContext.mentionedLocations.push(location);
      }
      
      const currentPref = context.locationContext.locationPreferences.get(location) || 0;
      context.locationContext.locationPreferences.set(location, currentPref + 1);
    });
    
    // Determine spatial awareness
    const localWords = ['here', 'room', 'upstairs', 'downstairs'];
    const buildingWords = ['home', 'house', 'kitchen', 'bedroom', 'attic', 'basement'];
    const areaWords = ['outside', 'yard', 'garden', 'neighborhood'];
    const distantWords = ['school', 'work', 'city', 'town'];
    
    if (keywords.some(word => localWords.includes(word))) {
      context.locationContext.spatialAwareness = 'local';
    } else if (keywords.some(word => buildingWords.includes(word))) {
      context.locationContext.spatialAwareness = 'building';
    } else if (keywords.some(word => areaWords.includes(word))) {
      context.locationContext.spatialAwareness = 'area';
    } else if (keywords.some(word => distantWords.includes(word))) {
      context.locationContext.spatialAwareness = 'distant';
    }
  }

  private checkLearningTriggers(context: ConversationContext): void {
    if (!this.currentSession) return;
    
    const allRules = [...this.baseLearningRules, ...this.dynamicLearningRules];
    
    allRules.forEach(rule => {
      if (rule.condition(context)) {
        this.applyLearningRule(rule, context);
      }
    });
    
    // Create new dynamic rules based on patterns
    this.createDynamicLearningRules(context);
  }

  private applyLearningRule(rule: LearningRule, context: ConversationContext): void {
    if (!this.currentSession) return;
    
    // Apply category weight adaptations
    rule.adaptation.categoryWeights.forEach((weight, category) => {
      // Update word association engine weights
      this.wordAssociation.updateContext([category]);
    });
    
    // Apply word boosts
    rule.adaptation.wordBoosts.forEach((boost, word) => {
      this.wordAssociation.addRecentWord(word);
    });
    
    // Record the adaptation
    this.currentSession.adaptationHistory.push({
      timestamp: Date.now(),
      rule: rule.trigger,
      trigger: rule.description,
      adaptation: rule.adaptation,
      effectiveness: rule.strength
    });
    
    this.emit('learningRuleApplied', {
      rule: rule.trigger,
      adaptations: rule.adaptation,
      context: context
    });
  }

  private createDynamicLearningRules(context: ConversationContext): void {
    // Create rules for frequently mentioned participants
    context.participants.forEach((participant, name) => {
      if (participant.mentionCount >= this.adaptationThreshold && 
          !this.dynamicLearningRules.find(r => r.trigger === `participant_${name}`)) {
        
        const rule: LearningRule = {
          trigger: `participant_${name}`,
          condition: (ctx) => ctx.participants.has(name) && ctx.participants.get(name)!.mentionCount > 2,
          adaptation: {
            categoryWeights: new Map([
              ['names', 1.8],
              ['family', participant.relationship === 'family' ? 2.0 : 1.2],
              ['emotions', 1.5]
            ]),
            wordBoosts: new Map([
              [name, 2.0],
              ...participant.associatedWords.map(word => [word, 1.4] as [string, number])
            ]),
            responsePatterns: ['natural', 'conversational']
          },
          strength: Math.min(0.9, participant.mentionCount * 0.2),
          description: `Adaptation for frequently mentioned participant: ${name}`
        };
        
        this.dynamicLearningRules.push(rule);
        this.emit('dynamicRuleCreated', rule);
        
        // Limit number of dynamic rules
        if (this.dynamicLearningRules.length > this.maxLearningRules) {
          this.dynamicLearningRules.shift();
        }
      }
    });
    
    // Create rules for dominant themes
    const sortedThemes = Array.from(context.themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    sortedThemes.forEach(([theme, strength]) => {
      if (strength > 5 && !this.dynamicLearningRules.find(r => r.trigger === `theme_${theme}`)) {
        const rule: LearningRule = {
          trigger: `theme_${theme}`,
          condition: (ctx) => (ctx.themes.get(theme) || 0) > 3,
          adaptation: {
            categoryWeights: new Map([[theme, 2.0]]),
            wordBoosts: new Map(),
            responsePatterns: ['natural']
          },
          strength: Math.min(0.8, strength * 0.1),
          description: `Adaptation for dominant theme: ${theme}`
        };
        
        this.dynamicLearningRules.push(rule);
      }
    });
  }

  private updateTopicSegmentation(trigger: ContextTrigger, context: ConversationContext): void {
    const currentTopic = context.topicHistory[context.topicHistory.length - 1];
    const now = Date.now();
    
    // Determine if we should start a new topic segment
    const shouldStartNewTopic = !currentTopic || 
      (now - currentTopic.startTime > 120000) || // 2 minutes
      this.isTopicShift(trigger, currentTopic);
    
    if (shouldStartNewTopic) {
      // End current topic if exists
      if (currentTopic && !currentTopic.endTime) {
        currentTopic.endTime = now;
      }
      
      // Start new topic
      const newTopic: TopicSegment = {
        id: `topic_${now}_${Math.random().toString(36).substr(2, 9)}`,
        startTime: now,
        primaryTheme: trigger.responseType,
        keywords: trigger.extractedKeywords,
        emotionalTone: this.determineEmotionalTone(trigger),
        wordCount: 1,
        significance: trigger.confidence
      };
      
      context.topicHistory.push(newTopic);
      
      this.currentSession?.significantEvents.push({
        id: `event_${now}`,
        timestamp: now,
        type: 'theme_shift',
        description: `New topic: ${trigger.responseType}`,
        context: newTopic,
        significance: trigger.confidence
      });
    } else {
      // Update current topic
      currentTopic.keywords = [...new Set([...currentTopic.keywords, ...trigger.extractedKeywords])];
      currentTopic.wordCount++;
      currentTopic.significance = Math.max(currentTopic.significance, trigger.confidence);
    }
  }

  private isTopicShift(trigger: ContextTrigger, currentTopic: TopicSegment): boolean {
    // Simple topic shift detection
    const keywordOverlap = trigger.extractedKeywords.filter(keyword => 
      currentTopic.keywords.includes(keyword)
    ).length;
    
    const overlapRatio = keywordOverlap / Math.max(1, trigger.extractedKeywords.length);
    return overlapRatio < 0.3; // Less than 30% keyword overlap suggests topic shift
  }

  private determineEmotionalTone(trigger: ContextTrigger): TopicSegment['emotionalTone'] {
    const emotionalKeywords = {
      positive: ['happy', 'joy', 'love', 'good', 'peace', 'glad'],
      negative: ['sad', 'hurt', 'pain', 'angry', 'hate', 'bad'],
      intense: ['very', 'extremely', 'terribly', 'deeply', 'intensely']
    };
    
    const text = trigger.inputText.toLowerCase();
    
    const positiveScore = emotionalKeywords.positive.filter(word => text.includes(word)).length;
    const negativeScore = emotionalKeywords.negative.filter(word => text.includes(word)).length;
    const intensityScore = emotionalKeywords.intense.filter(word => text.includes(word)).length;
    
    if (intensityScore > 0 && (positiveScore > 0 || negativeScore > 0)) {
      return 'intense';
    } else if (positiveScore > negativeScore) {
      return 'positive';
    } else if (negativeScore > positiveScore) {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  private startContextTracking(): void {
    this.contextUpdateInterval = setInterval(() => {
      this.performPeriodicContextUpdate();
    }, this.contextUpdateFrequency);
  }

  private stopContextTracking(): void {
    if (this.contextUpdateInterval) {
      clearInterval(this.contextUpdateInterval);
      this.contextUpdateInterval = null;
    }
  }

  private performPeriodicContextUpdate(): void {
    if (!this.currentSession) return;
    
    const context = this.currentSession.conversationContext;
    const now = Date.now();
    
    // Decay theme strengths over time
    context.themes.forEach((strength, theme) => {
      const decayedStrength = strength * 0.95; // 5% decay per update
      if (decayedStrength < 0.1) {
        context.themes.delete(theme);
      } else {
        context.themes.set(theme, decayedStrength);
      }
    });
    
    // Decay participant weights for inactive participants
    context.participants.forEach((participant, name) => {
      const timeSinceLastMention = now - participant.lastMention;
      if (timeSinceLastMention > 300000) { // 5 minutes
        participant.contextualWeight *= 0.9;
        if (participant.contextualWeight < 0.1) {
          context.participants.delete(name);
        }
      }
    });
    
    // Clean up old emotional history
    context.emotionalState.emotionHistory = context.emotionalState.emotionHistory.filter(
      emotion => now - emotion.timestamp < 600000 // Keep last 10 minutes
    );
    
    this.lastContextUpdate = now;
    this.emit('periodicContextUpdate', context);
  }

  private updateConversationContext(contextWords: string[]): void {
    if (!this.currentSession) return;
    
    const context = this.currentSession.conversationContext;
    
    // Add words to relevant theme tracking
    contextWords.forEach(word => {
      const currentStrength = context.themes.get(word) || 0;
      context.themes.set(word, currentStrength + 0.5);
    });
  }

  // Public API methods

  public getCurrentContext(): ConversationContext | null {
    return this.currentSession?.conversationContext || null;
  }

  public getSessionSummary(): {
    duration: number;
    topThemes: [string, number][];
    primaryParticipants: string[];
    emotionalProgression: string[];
    significantEvents: number;
    adaptationsApplied: number;
  } | null {
    if (!this.currentSession) return null;
    
    const duration = Date.now() - this.currentSession.startTime;
    const context = this.currentSession.conversationContext;
    
    const topThemes = Array.from(context.themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const primaryParticipants = Array.from(context.participants.values())
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 3)
      .map(p => p.name);
    
    const emotionalProgression = context.emotionalState.emotionHistory
      .slice(-5)
      .map(e => e.emotion);
    
    return {
      duration,
      topThemes,
      primaryParticipants,
      emotionalProgression,
      significantEvents: this.currentSession.significantEvents.length,
      adaptationsApplied: this.currentSession.adaptationHistory.length
    };
  }

  public getAdaptationRecommendations(): {
    categoryBoosts: Map<string, number>;
    wordBoosts: Map<string, number>;
    responsePatterns: string[];
    confidence: number;
  } {
    if (!this.currentSession) {
      return {
        categoryBoosts: new Map(),
        wordBoosts: new Map(),
        responsePatterns: ['natural'],
        confidence: 0
      };
    }
    
    const context = this.currentSession.conversationContext;
    const activeRules = [...this.baseLearningRules, ...this.dynamicLearningRules]
      .filter(rule => rule.condition(context));
    
    const categoryBoosts = new Map<string, number>();
    const wordBoosts = new Map<string, number>();
    const responsePatterns = new Set<string>();
    
    activeRules.forEach(rule => {
      // Merge category weights
      rule.adaptation.categoryWeights.forEach((weight, category) => {
        const currentWeight = categoryBoosts.get(category) || 0;
        categoryBoosts.set(category, currentWeight + weight * rule.strength);
      });
      
      // Merge word boosts  
      rule.adaptation.wordBoosts.forEach((boost, word) => {
        const currentBoost = wordBoosts.get(word) || 0;
        wordBoosts.set(word, currentBoost + boost * rule.strength);
      });
      
      // Collect response patterns
      rule.adaptation.responsePatterns.forEach(pattern => {
        responsePatterns.add(pattern);
      });
    });
    
    const confidence = activeRules.length > 0 
      ? activeRules.reduce((sum, rule) => sum + rule.strength, 0) / activeRules.length
      : 0;
    
    return {
      categoryBoosts,
      wordBoosts,
      responsePatterns: Array.from(responsePatterns),
      confidence
    };
  }

  public addCustomLearningRule(rule: LearningRule): void {
    this.dynamicLearningRules.push(rule);
    
    if (this.dynamicLearningRules.length > this.maxLearningRules) {
      this.dynamicLearningRules.shift();
    }
    
    this.emit('customRuleAdded', rule);
  }

  public removeCustomLearningRule(trigger: string): boolean {
    const index = this.dynamicLearningRules.findIndex(r => r.trigger === trigger);
    if (index !== -1) {
      this.dynamicLearningRules.splice(index, 1);
      this.emit('customRuleRemoved', trigger);
      return true;
    }
    return false;
  }

  public getActiveLearningRules(): LearningRule[] {
    if (!this.currentSession) return [];
    
    const context = this.currentSession.conversationContext;
    return [...this.baseLearningRules, ...this.dynamicLearningRules]
      .filter(rule => rule.condition(context));
  }

  public resetDynamicLearning(): void {
    this.dynamicLearningRules = [];
    this.emit('dynamicLearningReset');
  }

  public cleanup(): void {
    this.stopContextTracking();
    this.emit('cleanup');
  }
}