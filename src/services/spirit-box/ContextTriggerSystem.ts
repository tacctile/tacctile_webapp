import { EventEmitter } from 'events';

export interface QuestionPattern {
  pattern: RegExp;
  keywords: string[];
  targetCategories: string[];
  responseType: 'name' | 'yes_no' | 'emotion' | 'location' | 'action' | 'time' | 'general';
  priority: number;
  examples: string[];
}

export interface ContextTrigger {
  id: string;
  timestamp: number;
  inputText: string;
  detectedPattern: QuestionPattern | null;
  extractedKeywords: string[];
  targetCategories: string[];
  categoryWeights: Map<string, number>;
  responseType: string;
  confidence: number;
}

export interface ConversationContext {
  recentTriggers: ContextTrigger[];
  activeCategories: Set<string>;
  categoryBoosts: Map<string, number>;
  lastQuestionType: string | null;
  conversationTheme: string | null;
  participantMentions: Set<string>;
  timeContext: string | null;
}

export class ContextTriggerSystem extends EventEmitter {
  private questionPatterns: QuestionPattern[];
  private conversationContext: ConversationContext;
  private maxContextHistory = 20;

  constructor() {
    super();
    this.questionPatterns = this.initializeQuestionPatterns();
    this.conversationContext = {
      recentTriggers: [],
      activeCategories: new Set(),
      categoryBoosts: new Map(),
      lastQuestionType: null,
      conversationTheme: null,
      participantMentions: new Set(),
      timeContext: null
    };
  }

  private initializeQuestionPatterns(): QuestionPattern[] {
    return [
      // Name questions
      {
        pattern: /\b(?:what(?:'s|\s+is)?\s+(?:your|the)\s+name|who\s+are\s+you|what\s+(?:are\s+you|should\s+(?:i|we)\s+call\s+you)|tell\s+(?:me\s+|us\s+)?your\s+name)\b/i,
        keywords: ['name', 'who', 'call', 'called'],
        targetCategories: ['names', 'responses', 'family'],
        responseType: 'name',
        priority: 9,
        examples: ["What's your name?", "Who are you?", "What should I call you?", "Tell me your name"]
      },
      {
        pattern: /\b(?:are\s+you|is\s+(?:your\s+name|this)|were\s+you)\s+(?:called\s+)?(\w+)\b/i,
        keywords: ['are you', 'called', 'name is'],
        targetCategories: ['names', 'responses'],
        responseType: 'yes_no',
        priority: 8,
        examples: ["Are you John?", "Is your name Mary?", "Were you called Michael?"]
      },

      // Yes/No questions
      {
        pattern: /\b(?:are\s+you|do\s+you|did\s+you|can\s+you|will\s+you|have\s+you|is\s+(?:this|that|it)|was\s+(?:this|that|it))\b/i,
        keywords: ['are you', 'do you', 'did you', 'can you', 'is this', 'was that'],
        targetCategories: ['responses', 'emotions', 'actions'],
        responseType: 'yes_no',
        priority: 7,
        examples: ["Are you here?", "Do you want to talk?", "Can you hear me?", "Were you hurt?"]
      },
      {
        pattern: /\b(?:is\s+(?:anyone|someone|somebody)|are\s+(?:there|you)\s+(?:any|more)|should\s+(?:i|we))\b/i,
        keywords: ['is anyone', 'are there', 'should we'],
        targetCategories: ['responses', 'locations', 'actions'],
        responseType: 'yes_no',
        priority: 6,
        examples: ["Is anyone here?", "Are there others?", "Should we leave?"]
      },

      // Location questions
      {
        pattern: /\b(?:where\s+(?:are\s+you|did\s+you|do\s+you|were\s+you)|what\s+(?:room|place|location))\b/i,
        keywords: ['where', 'room', 'place', 'location'],
        targetCategories: ['locations', 'responses'],
        responseType: 'location',
        priority: 8,
        examples: ["Where are you?", "What room are you in?", "Where did you live?"]
      },
      {
        pattern: /\b(?:upstairs|downstairs|kitchen|bedroom|bathroom|attic|basement|outside|inside)\b/i,
        keywords: ['upstairs', 'downstairs', 'room', 'outside'],
        targetCategories: ['locations', 'responses'],
        responseType: 'location',
        priority: 6,
        examples: ["Are you upstairs?", "Did you die in the kitchen?"]
      },

      // Emotional questions
      {
        pattern: /\b(?:how\s+(?:do\s+you\s+feel|are\s+you\s+feeling)|are\s+you\s+(?:happy|sad|angry|scared|hurt|okay|alright))\b/i,
        keywords: ['feel', 'feeling', 'happy', 'sad', 'angry', 'scared', 'hurt', 'okay'],
        targetCategories: ['emotions', 'responses', 'medical'],
        responseType: 'emotion',
        priority: 7,
        examples: ["How do you feel?", "Are you sad?", "Are you hurt?", "Are you okay?"]
      },
      {
        pattern: /\b(?:what\s+(?:happened\s+to\s+you|made\s+you|do\s+you\s+want)|why\s+(?:are\s+you|did\s+you))\b/i,
        keywords: ['happened', 'what made', 'what do you want', 'why'],
        targetCategories: ['emotions', 'death_afterlife', 'responses', 'actions'],
        responseType: 'emotion',
        priority: 7,
        examples: ["What happened to you?", "What do you want?", "Why are you here?"]
      },

      // Time questions
      {
        pattern: /\b(?:when\s+(?:did\s+you|were\s+you)|what\s+(?:year|time|day))\b/i,
        keywords: ['when', 'year', 'time', 'day'],
        targetCategories: ['time', 'numbers', 'responses'],
        responseType: 'time',
        priority: 6,
        examples: ["When did you die?", "What year is it?", "What time did it happen?"]
      },
      {
        pattern: /\b(?:how\s+long|how\s+old|age|years?\s+old)\b/i,
        keywords: ['how long', 'how old', 'age', 'years old'],
        targetCategories: ['numbers', 'time', 'responses'],
        responseType: 'time',
        priority: 6,
        examples: ["How old are you?", "How long ago?", "What was your age?"]
      },

      // Family/Relationship questions
      {
        pattern: /\b(?:(?:do\s+you\s+have|where\s+(?:is\s+|are\s+)?(?:your|the)|who\s+(?:is\s+|was\s+)?(?:your|the))\s+(?:mother|father|mom|dad|child|children|son|daughter|wife|husband|family|brother|sister))\b/i,
        keywords: ['mother', 'father', 'mom', 'dad', 'family', 'child', 'children', 'wife', 'husband', 'brother', 'sister'],
        targetCategories: ['family', 'names', 'emotions', 'responses'],
        responseType: 'general',
        priority: 8,
        examples: ["Where is your mother?", "Do you have children?", "Who was your husband?"]
      },
      {
        pattern: /\b(?:loved\s+ones?|relatives?|parents?|siblings?)\b/i,
        keywords: ['loved ones', 'relatives', 'parents', 'siblings'],
        targetCategories: ['family', 'emotions', 'names'],
        responseType: 'general',
        priority: 7,
        examples: ["Are your loved ones here?", "Where are your parents?"]
      },

      // Action questions
      {
        pattern: /\b(?:what\s+(?:are\s+you\s+doing|did\s+you\s+do|do\s+you\s+do)|how\s+did\s+you)\b/i,
        keywords: ['what are you doing', 'what did you do', 'how did you'],
        targetCategories: ['actions', 'responses', 'emotions'],
        responseType: 'action',
        priority: 6,
        examples: ["What are you doing?", "What did you do?", "How did you get here?"]
      },
      {
        pattern: /\b(?:can\s+you\s+(?:move|touch|show|help|talk|speak|hear|see))\b/i,
        keywords: ['can you', 'move', 'touch', 'show', 'help', 'talk', 'speak', 'hear', 'see'],
        targetCategories: ['actions', 'responses', 'paranormal'],
        responseType: 'yes_no',
        priority: 7,
        examples: ["Can you move something?", "Can you touch me?", "Can you help us?"]
      },

      // Death/Afterlife questions
      {
        pattern: /\b(?:how\s+did\s+you\s+(?:die|pass)|what\s+killed\s+you|are\s+you\s+(?:dead|deceased|a\s+ghost|a\s+spirit))\b/i,
        keywords: ['how did you die', 'what killed', 'dead', 'ghost', 'spirit', 'pass away'],
        targetCategories: ['death_afterlife', 'emotions', 'medical', 'responses'],
        responseType: 'general',
        priority: 9,
        examples: ["How did you die?", "Are you dead?", "Are you a spirit?"]
      },
      {
        pattern: /\b(?:afterlife|heaven|hell|other\s+side|crossed\s+over|at\s+peace)\b/i,
        keywords: ['afterlife', 'heaven', 'hell', 'other side', 'crossed over', 'peace'],
        targetCategories: ['death_afterlife', 'emotions', 'paranormal'],
        responseType: 'general',
        priority: 8,
        examples: ["Are you at peace?", "Have you crossed over?", "Is there an afterlife?"]
      },

      // General communication
      {
        pattern: /\b(?:can\s+you\s+(?:understand|hear)|are\s+you\s+(?:listening|there|here|present))\b/i,
        keywords: ['understand', 'hear', 'listening', 'there', 'here', 'present'],
        targetCategories: ['responses', 'locations', 'paranormal'],
        responseType: 'yes_no',
        priority: 7,
        examples: ["Can you understand me?", "Are you here?", "Are you listening?"]
      },
      {
        pattern: /\b(?:hello|hi|hey|greetings|is\s+(?:anyone|someone|somebody)\s+(?:here|there))\b/i,
        keywords: ['hello', 'hi', 'hey', 'greetings', 'anyone here'],
        targetCategories: ['responses', 'locations', 'paranormal'],
        responseType: 'general',
        priority: 5,
        examples: ["Hello, is anyone here?", "Hi there", "Greetings"]
      },

      // Help/Message questions
      {
        pattern: /\b(?:(?:do\s+you\s+)?(?:need|want)\s+(?:help|assistance)|what\s+do\s+you\s+(?:need|want)|(?:is\s+there\s+)?(?:something|anything)\s+(?:you\s+)?(?:need|want))\b/i,
        keywords: ['need help', 'want help', 'need assistance', 'what do you need', 'what do you want'],
        targetCategories: ['responses', 'emotions', 'actions', 'family'],
        responseType: 'general',
        priority: 8,
        examples: ["Do you need help?", "What do you want?", "Is there something you need?"]
      },
      {
        pattern: /\b(?:(?:do\s+you\s+have\s+a\s+)?message|(?:what\s+do\s+you\s+want\s+to\s+)?(?:say|tell)|communicate)\b/i,
        keywords: ['message', 'say', 'tell', 'communicate'],
        targetCategories: ['responses', 'family', 'emotions', 'paranormal'],
        responseType: 'general',
        priority: 8,
        examples: ["Do you have a message?", "What do you want to say?", "Can you communicate?"]
      },

      // Specific entity questions
      {
        pattern: /\b(?:child|kid|baby|little\s+(?:one|boy|girl)|young)\b/i,
        keywords: ['child', 'kid', 'baby', 'little', 'young'],
        targetCategories: ['family', 'names', 'emotions', 'objects'],
        responseType: 'general',
        priority: 7,
        examples: ["Are you a child?", "Little one, are you here?", "Is there a young spirit?"]
      },
      {
        pattern: /\b(?:man|woman|lady|gentleman|adult|grown\s+up)\b/i,
        keywords: ['man', 'woman', 'lady', 'gentleman', 'adult'],
        targetCategories: ['family', 'names', 'responses'],
        responseType: 'general',
        priority: 6,
        examples: ["Are you a man?", "Is there a woman here?", "Are you an adult?"]
      }
    ];
  }

  public processInput(inputText: string): ContextTrigger {
    const trigger: ContextTrigger = {
      id: `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      inputText: inputText.toLowerCase().trim(),
      detectedPattern: null,
      extractedKeywords: [],
      targetCategories: [],
      categoryWeights: new Map(),
      responseType: 'general',
      confidence: 0
    };

    // Find matching patterns
    const matchedPatterns = this.findMatchingPatterns(trigger.inputText);
    
    if (matchedPatterns.length > 0) {
      // Use the highest priority pattern
      trigger.detectedPattern = matchedPatterns[0];
      trigger.responseType = trigger.detectedPattern.responseType;
      trigger.targetCategories = [...trigger.detectedPattern.targetCategories];
      trigger.confidence = this.calculatePatternConfidence(trigger.inputText, trigger.detectedPattern);
    }

    // Extract keywords from the input
    trigger.extractedKeywords = this.extractKeywords(trigger.inputText);

    // Add keywords-based categories
    const keywordCategories = this.getCategoriesFromKeywords(trigger.extractedKeywords);
    trigger.targetCategories.push(...keywordCategories);

    // Remove duplicates
    trigger.targetCategories = [...new Set(trigger.targetCategories)];

    // Calculate category weights
    trigger.categoryWeights = this.calculateCategoryWeights(trigger);

    // Update conversation context
    this.updateConversationContext(trigger);

    // Add to recent triggers
    this.conversationContext.recentTriggers.unshift(trigger);
    if (this.conversationContext.recentTriggers.length > this.maxContextHistory) {
      this.conversationContext.recentTriggers.pop();
    }

    this.emit('triggerDetected', trigger);
    return trigger;
  }

  private findMatchingPatterns(inputText: string): QuestionPattern[] {
    const matches: { pattern: QuestionPattern, matchStrength: number }[] = [];

    this.questionPatterns.forEach(pattern => {
      const regexMatch = pattern.pattern.test(inputText);
      let keywordMatches = 0;
      const totalKeywords = pattern.keywords.length;

      // Count keyword matches
      pattern.keywords.forEach(keyword => {
        if (inputText.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      });

      if (regexMatch || keywordMatches > 0) {
        const matchStrength = regexMatch ? 1.0 : (keywordMatches / totalKeywords);
        matches.push({ pattern, matchStrength });
      }
    });

    // Sort by priority and match strength
    return matches
      .sort((a, b) => {
        if (a.pattern.priority !== b.pattern.priority) {
          return b.pattern.priority - a.pattern.priority;
        }
        return b.matchStrength - a.matchStrength;
      })
      .map(match => match.pattern);
  }

  private calculatePatternConfidence(inputText: string, pattern: QuestionPattern): number {
    let confidence = 0.5;

    // Boost for regex match
    if (pattern.pattern.test(inputText)) {
      confidence += 0.3;
    }

    // Boost for keyword matches
    let keywordMatches = 0;
    pattern.keywords.forEach(keyword => {
      if (inputText.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    });
    
    const keywordRatio = keywordMatches / pattern.keywords.length;
    confidence += keywordRatio * 0.2;

    // Boost for question marks
    if (inputText.includes('?')) {
      confidence += 0.1;
    }

    // Boost for priority
    confidence += (pattern.priority / 10) * 0.1;

    return Math.min(confidence, 1.0);
  }

  private extractKeywords(inputText: string): string[] {
    const keywords: string[] = [];
    
    // Common question words
    const questionWords = ['what', 'who', 'where', 'when', 'why', 'how', 'which', 'can', 'are', 'is', 'do', 'did', 'will', 'would', 'should'];
    
    // Important nouns and concepts
    const importantWords = [
      'name', 'family', 'mother', 'father', 'child', 'children', 'son', 'daughter', 'brother', 'sister',
      'husband', 'wife', 'friend', 'love', 'help', 'hurt', 'pain', 'death', 'died', 'dead', 'spirit',
      'ghost', 'message', 'communicate', 'here', 'there', 'home', 'room', 'house', 'time', 'year',
      'feel', 'feeling', 'happy', 'sad', 'angry', 'scared', 'peace', 'hello', 'goodbye', 'yes', 'no'
    ];

    const words = inputText.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (questionWords.includes(cleanWord) || importantWords.includes(cleanWord)) {
        keywords.push(cleanWord);
      }
    });

    return [...new Set(keywords)];
  }

  private getCategoriesFromKeywords(keywords: string[]): string[] {
    const categories: string[] = [];
    
    const keywordMappings: { [key: string]: string[] } = {
      'name': ['names', 'responses'],
      'family': ['family', 'names', 'emotions'],
      'mother': ['family', 'names', 'emotions'],
      'father': ['family', 'names', 'emotions'],
      'child': ['family', 'names', 'emotions', 'objects'],
      'children': ['family', 'names', 'emotions'],
      'love': ['emotions', 'family'],
      'help': ['responses', 'emotions', 'actions'],
      'hurt': ['emotions', 'medical'],
      'pain': ['emotions', 'medical'],
      'death': ['death_afterlife', 'emotions'],
      'died': ['death_afterlife', 'emotions'],
      'dead': ['death_afterlife', 'emotions'],
      'spirit': ['paranormal', 'death_afterlife'],
      'ghost': ['paranormal', 'death_afterlife'],
      'here': ['locations', 'responses'],
      'there': ['locations', 'responses'],
      'home': ['locations', 'family', 'emotions'],
      'room': ['locations'],
      'house': ['locations', 'family'],
      'time': ['time', 'numbers'],
      'year': ['time', 'numbers'],
      'feel': ['emotions'],
      'feeling': ['emotions'],
      'happy': ['emotions'],
      'sad': ['emotions'],
      'angry': ['emotions'],
      'scared': ['emotions'],
      'peace': ['emotions', 'death_afterlife'],
      'hello': ['responses'],
      'goodbye': ['responses'],
      'yes': ['responses'],
      'no': ['responses'],
      'can': ['actions', 'responses'],
      'what': ['responses', 'general'],
      'who': ['names', 'family'],
      'where': ['locations'],
      'when': ['time'],
      'why': ['emotions', 'responses'],
      'how': ['actions', 'emotions', 'responses']
    };

    keywords.forEach(keyword => {
      const mappedCategories = keywordMappings[keyword];
      if (mappedCategories) {
        categories.push(...mappedCategories);
      }
    });

    return [...new Set(categories)];
  }

  private calculateCategoryWeights(trigger: ContextTrigger): Map<string, number> {
    const weights = new Map<string, number>();
    
    // Base weights for target categories
    trigger.targetCategories.forEach(category => {
      const baseWeight = this.getCategoryBaseWeight(category, trigger.responseType);
      weights.set(category, baseWeight);
    });

    // Boost based on confidence
    weights.forEach((weight, category) => {
      weights.set(category, weight * (0.5 + trigger.confidence * 0.5));
    });

    // Apply conversation context boosts
    this.conversationContext.categoryBoosts.forEach((boost, category) => {
      const currentWeight = weights.get(category) || 0;
      weights.set(category, currentWeight + boost * 0.3);
    });

    return weights;
  }

  private getCategoryBaseWeight(category: string, responseType: string): number {
    const baseWeights: { [key: string]: number } = {
      names: 1.5,
      responses: 2.0,
      emotions: 1.8,
      locations: 1.3,
      actions: 1.6,
      family: 1.7,
      time: 1.2,
      numbers: 1.1,
      death_afterlife: 2.0,
      paranormal: 2.2,
      medical: 1.4,
      objects: 1.0
    };

    let weight = baseWeights[category] || 1.0;

    // Boost based on response type
    const responseTypeBoosts: { [key: string]: { [key: string]: number } } = {
      name: { names: 2.0, family: 1.5, responses: 1.3 },
      yes_no: { responses: 2.5, emotions: 1.2 },
      emotion: { emotions: 2.0, medical: 1.5, death_afterlife: 1.3 },
      location: { locations: 2.0, family: 1.2 },
      action: { actions: 2.0, responses: 1.3 },
      time: { time: 2.0, numbers: 1.8, death_afterlife: 1.2 },
      general: { responses: 1.5, emotions: 1.2 }
    };

    const boosts = responseTypeBoosts[responseType];
    if (boosts && boosts[category]) {
      weight *= boosts[category];
    }

    return weight;
  }

  private updateConversationContext(trigger: ContextTrigger): void {
    // Update active categories
    trigger.targetCategories.forEach(category => {
      this.conversationContext.activeCategories.add(category);
    });

    // Update category boosts
    trigger.categoryWeights.forEach((weight, category) => {
      const currentBoost = this.conversationContext.categoryBoosts.get(category) || 0;
      this.conversationContext.categoryBoosts.set(category, currentBoost + weight * 0.1);
    });

    // Update last question type
    this.conversationContext.lastQuestionType = trigger.responseType;

    // Extract conversation theme
    this.updateConversationTheme(trigger);

    // Extract participant mentions
    this.extractParticipantMentions(trigger.inputText);

    // Update time context
    this.updateTimeContext(trigger.extractedKeywords);

    // Decay old boosts
    this.decayContextBoosts();
  }

  private updateConversationTheme(trigger: ContextTrigger): void {
    const themeKeywords = {
      'family': ['mother', 'father', 'child', 'family', 'son', 'daughter', 'husband', 'wife'],
      'death': ['died', 'death', 'dead', 'killed', 'hurt', 'pain', 'passed'],
      'identity': ['name', 'who', 'called', 'are you'],
      'location': ['where', 'room', 'house', 'here', 'there'],
      'communication': ['hello', 'talk', 'speak', 'hear', 'listen', 'message'],
      'help': ['help', 'need', 'want', 'assistance']
    };

    let strongestTheme = '';
    let maxMatches = 0;

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      const matches = keywords.filter(keyword => 
        trigger.extractedKeywords.includes(keyword) || 
        trigger.inputText.includes(keyword)
      ).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        strongestTheme = theme;
      }
    });

    if (maxMatches > 0) {
      this.conversationContext.conversationTheme = strongestTheme;
    }
  }

  private extractParticipantMentions(inputText: string): void {
    // Look for names or titles mentioned
    const participants = [
      'john', 'mary', 'james', 'sarah', 'michael', 'david', 'lisa', 'robert',
      'child', 'baby', 'man', 'woman', 'lady', 'gentleman', 'spirit', 'ghost'
    ];

    participants.forEach(participant => {
      if (inputText.includes(participant)) {
        this.conversationContext.participantMentions.add(participant);
      }
    });
  }

  private updateTimeContext(keywords: string[]): void {
    const timeIndicators = ['now', 'today', 'yesterday', 'year', 'time', 'when', 'day', 'night'];
    
    const hasTimeReference = keywords.some(keyword => timeIndicators.includes(keyword));
    if (hasTimeReference) {
      this.conversationContext.timeContext = 'temporal_focus';
    }
  }

  private decayContextBoosts(): void {
    const decayFactor = 0.95;
    
    this.conversationContext.categoryBoosts.forEach((boost, category) => {
      const newBoost = boost * decayFactor;
      if (newBoost < 0.1) {
        this.conversationContext.categoryBoosts.delete(category);
      } else {
        this.conversationContext.categoryBoosts.set(category, newBoost);
      }
    });
  }

  public getContextualCategoryWeights(): Map<string, number> {
    return new Map(this.conversationContext.categoryBoosts);
  }

  public getActiveCategories(): string[] {
    return Array.from(this.conversationContext.activeCategories);
  }

  public getConversationSummary(): {
    theme: string | null;
    lastQuestionType: string | null;
    participantCount: number;
    activeCategories: number;
    recentTriggers: number;
  } {
    return {
      theme: this.conversationContext.conversationTheme,
      lastQuestionType: this.conversationContext.lastQuestionType,
      participantCount: this.conversationContext.participantMentions.size,
      activeCategories: this.conversationContext.activeCategories.size,
      recentTriggers: this.conversationContext.recentTriggers.length
    };
  }

  public getRecentTriggers(limit = 5): ContextTrigger[] {
    return this.conversationContext.recentTriggers.slice(0, limit);
  }

  public resetContext(): void {
    this.conversationContext = {
      recentTriggers: [],
      activeCategories: new Set(),
      categoryBoosts: new Map(),
      lastQuestionType: null,
      conversationTheme: null,
      participantMentions: new Set(),
      timeContext: null
    };
    
    this.emit('contextReset');
  }

  public getPatternExamples(): { [responseType: string]: string[] } {
    const examples: { [responseType: string]: string[] } = {};
    
    this.questionPatterns.forEach(pattern => {
      if (!examples[pattern.responseType]) {
        examples[pattern.responseType] = [];
      }
      examples[pattern.responseType].push(...pattern.examples);
    });

    return examples;
  }

  public testPattern(inputText: string): {
    matchedPatterns: string[];
    extractedKeywords: string[];
    targetCategories: string[];
    confidence: number;
  } {
    const trigger = this.processInput(inputText);
    
    return {
      matchedPatterns: trigger.detectedPattern ? [trigger.detectedPattern.responseType] : [],
      extractedKeywords: trigger.extractedKeywords,
      targetCategories: trigger.targetCategories,
      confidence: trigger.confidence
    };
  }
}