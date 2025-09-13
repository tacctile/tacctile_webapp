import { EventEmitter } from 'events';
import { phonetics, soundex } from 'phonetics';
import { default as soundexCode } from 'soundex-code';
import { AudioFeatures, AudioSegment } from './AudioProcessor';

export interface WordMatch {
  word: string;
  confidence: number;
  phoneticMatch: string;
  soundexCode: string;
  timestamp: number;
  audioSegment: AudioSegment;
  matchType: 'exact' | 'phonetic' | 'fuzzy' | 'pattern';
  similarity: number;
  context?: string;
}

export interface CommunicationEvent {
  id: string;
  timestamp: number;
  words: WordMatch[];
  phrase: string;
  confidence: number;
  duration: number;
  significance: number;
  audioFeatures: AudioFeatures;
  classification: 'potential_evp' | 'ambient_speech' | 'noise' | 'unknown';
}

export interface PhoneticPattern {
  pattern: string;
  words: string[];
  weight: number;
  description: string;
}

export interface DetectionSettings {
  enablePhoneticMatching: boolean;
  enableSoundexMatching: boolean;
  enableFuzzyMatching: boolean;
  enablePatternDetection: boolean;
  confidenceThreshold: number;
  phoneticThreshold: number;
  soundexThreshold: number;
  fuzzyThreshold: number;
  patternThreshold: number;
  minWordLength: number;
  maxWordLength: number;
  enableContextAnalysis: boolean;
  enableSignificanceScoring: boolean;
  realTimeDetection: boolean;
}

export interface WordDatabase {
  commonWords: Set<string>;
  spiritTerms: Set<string>;
  names: Set<string>;
  emotions: Set<string>;
  locations: Set<string>;
  responses: Set<string>;
  commands: Set<string>;
}

export interface PhoneticDictionary {
  [key: string]: {
    phoneticCodes: string[];
    soundexCode: string;
    variations: string[];
    frequency: number;
    category: string;
  };
}

export class WordDetectionEngine extends EventEmitter {
  private settings: DetectionSettings;
  private wordDatabase: WordDatabase;
  private phoneticDictionary: PhoneticDictionary;
  private phoneticPatterns: PhoneticPattern[];
  
  private detectedWords: WordMatch[] = [];
  private communicationEvents: CommunicationEvent[] = [];
  private recentAudioSegments: AudioSegment[] = [];
  private maxSegmentHistory = 100;
  private maxWordHistory = 500;
  
  // Pattern matching state
  private wordSequenceBuffer: WordMatch[] = [];
  private sequenceBufferSize = 10;
  private lastProcessingTime = 0;
  private processingInterval = 100; // ms

  constructor(settings: Partial<DetectionSettings> = {}) {
    super();

    this.settings = {
      enablePhoneticMatching: true,
      enableSoundexMatching: true,
      enableFuzzyMatching: true,
      enablePatternDetection: true,
      confidenceThreshold: 0.3,
      phoneticThreshold: 0.7,
      soundexThreshold: 0.8,
      fuzzyThreshold: 0.6,
      patternThreshold: 0.5,
      minWordLength: 2,
      maxWordLength: 15,
      enableContextAnalysis: true,
      enableSignificanceScoring: true,
      realTimeDetection: true,
      ...settings
    };

    this.initializeWordDatabase();
    this.initializePhoneticDictionary();
    this.initializePhoneticPatterns();
  }

  private initializeWordDatabase(): void {
    this.wordDatabase = {
      commonWords: new Set([
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
        'is', 'am', 'are', 'was', 'were', 'be', 'being', 'been', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
        'go', 'come', 'get', 'see', 'know', 'think', 'say', 'tell', 'ask', 'give', 'take',
        'yes', 'no', 'okay', 'alright', 'maybe', 'please', 'thank', 'sorry', 'excuse'
      ]),

      spiritTerms: new Set([
        'spirit', 'ghost', 'entity', 'presence', 'energy', 'soul', 'departed', 'passed',
        'beyond', 'other', 'side', 'realm', 'dimension', 'plane', 'cross', 'over',
        'message', 'communicate', 'speak', 'talk', 'listen', 'hear', 'see', 'feel',
        'touch', 'move', 'sign', 'signal', 'contact', 'reach', 'connect', 'bridge',
        'heaven', 'hell', 'purgatory', 'limbo', 'afterlife', 'eternal', 'forever',
        'peace', 'rest', 'sleep', 'wake', 'awake', 'alive', 'dead', 'death', 'die',
        'light', 'dark', 'shadow', 'cold', 'warm', 'hot', 'fire', 'water', 'air', 'earth'
      ]),

      names: new Set([
        'john', 'mary', 'james', 'patricia', 'robert', 'jennifer', 'michael', 'linda',
        'william', 'elizabeth', 'david', 'barbara', 'richard', 'susan', 'joseph', 'jessica',
        'thomas', 'sarah', 'charles', 'karen', 'christopher', 'nancy', 'daniel', 'lisa',
        'matthew', 'betty', 'anthony', 'helen', 'mark', 'sandra', 'donald', 'donna',
        'steven', 'carol', 'paul', 'ruth', 'andrew', 'sharon', 'joshua', 'michelle',
        'anna', 'emily', 'marie', 'rose', 'grace', 'hope', 'faith', 'charity', 'joy'
      ]),

      emotions: new Set([
        'love', 'hate', 'happy', 'sad', 'angry', 'mad', 'glad', 'joy', 'fear', 'afraid',
        'scared', 'worried', 'concerned', 'anxious', 'calm', 'peaceful', 'serene',
        'excited', 'thrilled', 'disappointed', 'frustrated', 'annoyed', 'irritated',
        'confused', 'lost', 'found', 'hopeful', 'hopeless', 'grateful', 'thankful',
        'sorry', 'regret', 'guilt', 'shame', 'pride', 'humble', 'confident', 'doubt',
        'trust', 'distrust', 'lonely', 'together', 'alone', 'crowded', 'empty', 'full'
      ]),

      locations: new Set([
        'here', 'there', 'home', 'house', 'room', 'kitchen', 'bedroom', 'bathroom',
        'attic', 'basement', 'garage', 'garden', 'yard', 'porch', 'door', 'window',
        'stairs', 'hall', 'closet', 'office', 'school', 'church', 'hospital', 'store',
        'park', 'forest', 'field', 'river', 'lake', 'ocean', 'mountain', 'valley',
        'city', 'town', 'village', 'country', 'state', 'nation', 'world', 'earth',
        'up', 'down', 'left', 'right', 'north', 'south', 'east', 'west', 'center'
      ]),

      responses: new Set([
        'yes', 'no', 'maybe', 'perhaps', 'possibly', 'definitely', 'certainly',
        'absolutely', 'never', 'always', 'sometimes', 'often', 'rarely', 'seldom',
        'hello', 'hi', 'hey', 'goodbye', 'bye', 'farewell', 'welcome', 'thanks',
        'please', 'excuse', 'pardon', 'sorry', 'forgive', 'understand', 'know',
        'remember', 'forget', 'recall', 'think', 'believe', 'doubt', 'trust',
        'help', 'assist', 'support', 'protect', 'guard', 'watch', 'guide', 'lead'
      ]),

      commands: new Set([
        'come', 'go', 'stay', 'leave', 'stop', 'start', 'begin', 'end', 'finish',
        'wait', 'hurry', 'slow', 'fast', 'quick', 'move', 'still', 'quiet', 'loud',
        'speak', 'talk', 'say', 'tell', 'whisper', 'shout', 'call', 'answer',
        'show', 'hide', 'reveal', 'conceal', 'open', 'close', 'give', 'take',
        'bring', 'carry', 'hold', 'release', 'let', 'allow', 'permit', 'forbid',
        'push', 'pull', 'lift', 'drop', 'throw', 'catch', 'touch', 'feel'
      ])
    };
  }

  private initializePhoneticDictionary(): void {
    this.phoneticDictionary = {};
    
    // Build phonetic dictionary from all word sets
    const allWords = new Set([
      ...this.wordDatabase.commonWords,
      ...this.wordDatabase.spiritTerms,
      ...this.wordDatabase.names,
      ...this.wordDatabase.emotions,
      ...this.wordDatabase.locations,
      ...this.wordDatabase.responses,
      ...this.wordDatabase.commands
    ]);

    allWords.forEach(word => {
      const phoneticCodes = this.generatePhoneticCodes(word);
      const soundex = soundexCode(word);
      
      let category = 'common';
      if (this.wordDatabase.spiritTerms.has(word)) category = 'spirit';
      else if (this.wordDatabase.names.has(word)) category = 'name';
      else if (this.wordDatabase.emotions.has(word)) category = 'emotion';
      else if (this.wordDatabase.locations.has(word)) category = 'location';
      else if (this.wordDatabase.responses.has(word)) category = 'response';
      else if (this.wordDatabase.commands.has(word)) category = 'command';

      this.phoneticDictionary[word] = {
        phoneticCodes,
        soundexCode: soundex,
        variations: this.generateVariations(word),
        frequency: this.getWordFrequency(word, category),
        category
      };
    });
  }

  private generatePhoneticCodes(word: string): string[] {
    const codes: string[] = [];
    
    try {
      // Use multiple phonetic algorithms
      if (typeof phonetics !== 'undefined') {
        codes.push(phonetics.soundex(word));
        codes.push(phonetics.metaphone(word));
        codes.push(phonetics.doubleMetaphone(word)[0]);
      }
    } catch (error) {
      // Fallback to basic soundex
      codes.push(soundexCode(word));
    }
    
    // Remove duplicates and empty codes
    return [...new Set(codes)].filter(code => code && code.length > 0);
  }

  private generateVariations(word: string): string[] {
    const variations: string[] = [word];
    
    // Common phonetic variations
    const substitutions = [
      ['ph', 'f'], ['ck', 'k'], ['c', 'k'], ['s', 'z'], ['i', 'y'],
      ['ou', 'u'], ['oo', 'u'], ['ee', 'e'], ['ea', 'e'], ['ie', 'i'],
      ['th', 't'], ['gh', 'g'], ['kn', 'n'], ['wr', 'r'], ['mb', 'm']
    ];
    
    substitutions.forEach(([from, to]) => {
      if (word.includes(from)) {
        variations.push(word.replace(new RegExp(from, 'g'), to));
      }
    });
    
    return [...new Set(variations)];
  }

  private getWordFrequency(word: string, category: string): number {
    // Assign frequency weights based on category and word length
    const categoryWeights = {
      common: 1.0,
      spirit: 2.0,
      name: 1.5,
      emotion: 1.8,
      location: 1.3,
      response: 2.2,
      command: 1.9
    };
    
    const baseWeight = categoryWeights[category as keyof typeof categoryWeights] || 1.0;
    const lengthPenalty = Math.max(0.5, 1 - (word.length - 4) * 0.1);
    
    return baseWeight * lengthPenalty;
  }

  private initializePhoneticPatterns(): void {
    this.phoneticPatterns = [
      {
        pattern: 'greeting',
        words: ['hello', 'hi', 'hey', 'greetings', 'welcome'],
        weight: 2.0,
        description: 'Greeting patterns indicating initial contact'
      },
      {
        pattern: 'farewell',
        words: ['goodbye', 'bye', 'farewell', 'see you', 'until'],
        weight: 2.0,
        description: 'Farewell patterns indicating communication end'
      },
      {
        pattern: 'affirmation',
        words: ['yes', 'yeah', 'yep', 'correct', 'right', 'true'],
        weight: 1.8,
        description: 'Positive response patterns'
      },
      {
        pattern: 'negation',
        words: ['no', 'nope', 'wrong', 'false', 'not', 'never'],
        weight: 1.8,
        description: 'Negative response patterns'
      },
      {
        pattern: 'help_request',
        words: ['help', 'assist', 'aid', 'support', 'please'],
        weight: 2.2,
        description: 'Requests for assistance or attention'
      },
      {
        pattern: 'location_reference',
        words: ['here', 'there', 'where', 'place', 'room', 'house'],
        weight: 1.5,
        description: 'References to locations or places'
      },
      {
        pattern: 'time_reference',
        words: ['now', 'then', 'when', 'time', 'day', 'night'],
        weight: 1.3,
        description: 'References to time or temporal concepts'
      },
      {
        pattern: 'identity',
        words: ['i', 'me', 'my', 'mine', 'myself', 'name'],
        weight: 1.9,
        description: 'Self-identification patterns'
      },
      {
        pattern: 'direct_address',
        words: ['you', 'your', 'yours', 'yourself'],
        weight: 1.7,
        description: 'Direct address to investigators'
      },
      {
        pattern: 'emotional_state',
        words: ['sad', 'happy', 'angry', 'scared', 'love', 'hate'],
        weight: 2.0,
        description: 'Expressions of emotional states'
      }
    ];
  }

  public processAudioSegment(segment: AudioSegment): void {
    if (!this.settings.realTimeDetection) return;

    this.recentAudioSegments.push(segment);
    
    // Limit segment history
    if (this.recentAudioSegments.length > this.maxSegmentHistory) {
      this.recentAudioSegments.shift();
    }

    // Only process segments that meet minimum criteria
    if (this.shouldProcessSegment(segment)) {
      this.performWordDetection(segment);
    }
  }

  private shouldProcessSegment(segment: AudioSegment): boolean {
    const now = Date.now();
    
    // Rate limiting
    if (now - this.lastProcessingTime < this.processingInterval) {
      return false;
    }

    // Signal quality checks
    const hasGoodSNR = segment.signalToNoiseRatio > -20;
    const hasGoodConfidence = segment.confidence > 0.3;
    const hasMinDuration = segment.duration > 200; // ms
    const hasMaxDuration = segment.duration < 10000; // ms
    const hasGoodEnergy = segment.features.energy > 0.001;
    
    return hasGoodSNR && hasGoodConfidence && hasMinDuration && hasMaxDuration && hasGoodEnergy;
  }

  private async performWordDetection(segment: AudioSegment): Promise<void> {
    this.lastProcessingTime = Date.now();

    try {
      // Extract potential words from audio features
      const candidateWords = this.extractCandidateWords(segment);
      
      // Match candidates against dictionary
      const matches: WordMatch[] = [];
      
      for (const candidate of candidateWords) {
        const wordMatches = await this.matchCandidate(candidate, segment);
        matches.push(...wordMatches);
      }

      // Filter and score matches
      const validMatches = this.filterAndScoreMatches(matches);

      if (validMatches.length > 0) {
        // Add to detection history
        this.detectedWords.push(...validMatches);
        
        // Limit word history
        if (this.detectedWords.length > this.maxWordHistory) {
          this.detectedWords.splice(0, this.detectedWords.length - this.maxWordHistory);
        }

        // Update word sequence buffer for pattern matching
        this.updateWordSequenceBuffer(validMatches);

        // Check for communication events
        this.checkForCommunicationEvents(validMatches, segment);

        // Emit detected words
        validMatches.forEach(match => {
          this.emit('wordDetected', match);
        });
      }

    } catch (error) {
      this.emit('error', `Word detection failed: ${error}`);
    }
  }

  private extractCandidateWords(segment: AudioSegment): string[] {
    const candidates: string[] = [];
    
    // This is a simplified approach - in practice, you would use
    // speech recognition APIs or phoneme detection algorithms
    
    const features = segment.features;
    
    // Use spectral features to generate phonetic patterns
    const spectralPattern = this.generateSpectralPattern(features);
    
    // Map spectral patterns to potential words
    const phoneticCandidates = this.mapSpectralToPhonetic(spectralPattern);
    
    candidates.push(...phoneticCandidates);
    
    // Add some common words based on audio characteristics
    if (features.fundamentalFrequency > 80 && features.fundamentalFrequency < 300) {
      // Likely human voice range
      candidates.push('yes', 'no', 'hello', 'help');
    }
    
    if (features.energy > 0.1) {
      // High energy - possible exclamation
      candidates.push('hey', 'stop', 'wait', 'here');
    }
    
    if (features.spectralCentroid > 2000) {
      // High frequency content - possible sibilants
      candidates.push('see', 'say', 'speak', 'listen');
    }
    
    return [...new Set(candidates)].filter(word => 
      word.length >= this.settings.minWordLength && 
      word.length <= this.settings.maxWordLength
    );
  }

  private generateSpectralPattern(features: AudioFeatures): string {
    // Generate a simplified spectral fingerprint
    const centroid = Math.floor(features.spectralCentroid / 500);
    const rolloff = Math.floor(features.spectralRolloff / 1000);
    const bandwidth = Math.floor(features.spectralBandwidth / 500);
    const flatness = Math.floor(features.spectralFlatness * 10);
    
    return `${centroid}-${rolloff}-${bandwidth}-${flatness}`;
  }

  private mapSpectralToPhonetic(pattern: string): string[] {
    // Simplified mapping of spectral patterns to phonetic possibilities
    const mappings: { [key: string]: string[] } = {
      '1-2-1-0': ['me', 'see', 'be'],
      '2-3-2-1': ['you', 'who', 'do'],
      '3-4-3-2': ['say', 'way', 'day'],
      '4-5-4-3': ['help', 'stop', 'come'],
      '5-6-5-4': ['here', 'there', 'where']
    };
    
    return mappings[pattern] || [];
  }

  private async matchCandidate(candidate: string, segment: AudioSegment): Promise<WordMatch[]> {
    const matches: WordMatch[] = [];
    
    // Exact matching
    if (this.isDictionaryWord(candidate)) {
      matches.push(this.createExactMatch(candidate, segment));
    }

    // Phonetic matching
    if (this.settings.enablePhoneticMatching) {
      const phoneticMatches = this.findPhoneticMatches(candidate, segment);
      matches.push(...phoneticMatches);
    }

    // Soundex matching
    if (this.settings.enableSoundexMatching) {
      const soundexMatches = this.findSoundexMatches(candidate, segment);
      matches.push(...soundexMatches);
    }

    // Fuzzy matching
    if (this.settings.enableFuzzyMatching) {
      const fuzzyMatches = this.findFuzzyMatches(candidate, segment);
      matches.push(...fuzzyMatches);
    }

    return matches;
  }

  private isDictionaryWord(word: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.phoneticDictionary, word.toLowerCase());
  }

  private createExactMatch(word: string, segment: AudioSegment): WordMatch {
    const dictEntry = this.phoneticDictionary[word.toLowerCase()];
    
    return {
      word: word.toLowerCase(),
      confidence: 0.95 + (dictEntry?.frequency || 0) * 0.05,
      phoneticMatch: dictEntry?.phoneticCodes[0] || '',
      soundexCode: dictEntry?.soundexCode || soundexCode(word),
      timestamp: Date.now(),
      audioSegment: segment,
      matchType: 'exact',
      similarity: 1.0,
      context: dictEntry?.category
    };
  }

  private findPhoneticMatches(candidate: string, segment: AudioSegment): WordMatch[] {
    const matches: WordMatch[] = [];
    const candidatePhonetic = soundexCode(candidate);
    
    Object.entries(this.phoneticDictionary).forEach(([word, entry]) => {
      const similarity = this.calculatePhoneticSimilarity(candidatePhonetic, entry.phoneticCodes);
      
      if (similarity >= this.settings.phoneticThreshold) {
        matches.push({
          word,
          confidence: similarity * 0.8 + entry.frequency * 0.2,
          phoneticMatch: candidatePhonetic,
          soundexCode: entry.soundexCode,
          timestamp: Date.now(),
          audioSegment: segment,
          matchType: 'phonetic',
          similarity,
          context: entry.category
        });
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private findSoundexMatches(candidate: string, segment: AudioSegment): WordMatch[] {
    const matches: WordMatch[] = [];
    const candidateSoundex = soundexCode(candidate);
    
    Object.entries(this.phoneticDictionary).forEach(([word, entry]) => {
      if (entry.soundexCode === candidateSoundex && word !== candidate) {
        const similarity = this.calculateLevenshteinSimilarity(candidate, word);
        
        if (similarity >= this.settings.soundexThreshold) {
          matches.push({
            word,
            confidence: similarity * 0.7 + entry.frequency * 0.3,
            phoneticMatch: candidateSoundex,
            soundexCode: entry.soundexCode,
            timestamp: Date.now(),
            audioSegment: segment,
            matchType: 'phonetic',
            similarity,
            context: entry.category
          });
        }
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
  }

  private findFuzzyMatches(candidate: string, segment: AudioSegment): WordMatch[] {
    const matches: WordMatch[] = [];
    
    Object.entries(this.phoneticDictionary).forEach(([word, entry]) => {
      const similarity = this.calculateLevenshteinSimilarity(candidate, word);
      
      if (similarity >= this.settings.fuzzyThreshold) {
        matches.push({
          word,
          confidence: similarity * 0.6 + entry.frequency * 0.4,
          phoneticMatch: soundexCode(candidate),
          soundexCode: entry.soundexCode,
          timestamp: Date.now(),
          audioSegment: segment,
          matchType: 'fuzzy',
          similarity,
          context: entry.category
        });
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
  }

  private calculatePhoneticSimilarity(code1: string, codes: string[]): number {
    let maxSimilarity = 0;
    
    codes.forEach(code2 => {
      const similarity = this.calculateLevenshteinSimilarity(code1, code2);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });
    
    return maxSimilarity;
  }

  private calculateLevenshteinSimilarity(s1: string, s2: string): number {
    const distance = this.levenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
    const maxLength = Math.max(s1.length, s2.length);
    
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const substitutionCost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }
    
    return matrix[s2.length][s1.length];
  }

  private filterAndScoreMatches(matches: WordMatch[]): WordMatch[] {
    // Remove duplicates and low-confidence matches
    const uniqueMatches = new Map<string, WordMatch>();
    
    matches.forEach(match => {
      if (match.confidence >= this.settings.confidenceThreshold) {
        const existing = uniqueMatches.get(match.word);
        if (!existing || match.confidence > existing.confidence) {
          uniqueMatches.set(match.word, match);
        }
      }
    });
    
    return Array.from(uniqueMatches.values()).sort((a, b) => b.confidence - a.confidence);
  }

  private updateWordSequenceBuffer(matches: WordMatch[]): void {
    this.wordSequenceBuffer.push(...matches);
    
    // Limit buffer size
    if (this.wordSequenceBuffer.length > this.sequenceBufferSize) {
      this.wordSequenceBuffer.splice(0, this.wordSequenceBuffer.length - this.sequenceBufferSize);
    }

    // Check for pattern matches
    if (this.settings.enablePatternDetection) {
      this.checkPatternMatches();
    }
  }

  private checkPatternMatches(): void {
    const recentWords = this.wordSequenceBuffer.slice(-5).map(match => match.word);
    
    this.phoneticPatterns.forEach(pattern => {
      const patternScore = this.calculatePatternScore(recentWords, pattern);
      
      if (patternScore >= this.settings.patternThreshold) {
        this.emit('patternDetected', {
          pattern: pattern.pattern,
          description: pattern.description,
          words: recentWords,
          score: patternScore,
          timestamp: Date.now()
        });
      }
    });
  }

  private calculatePatternScore(recentWords: string[], pattern: PhoneticPattern): number {
    let score = 0;
    let matches = 0;
    
    recentWords.forEach(word => {
      if (pattern.words.includes(word)) {
        matches++;
        score += pattern.weight;
      }
    });
    
    // Normalize by sequence length and pattern size
    const normalizedScore = (score / (recentWords.length * pattern.weight)) * (matches / pattern.words.length);
    
    return Math.min(normalizedScore, 1.0);
  }

  private checkForCommunicationEvents(matches: WordMatch[], segment: AudioSegment): void {
    // Group recent words into potential communication events
    const recentTimeWindow = 5000; // 5 seconds
    const now = Date.now();
    
    const recentWords = this.detectedWords.filter(match => 
      now - match.timestamp <= recentTimeWindow
    );

    if (recentWords.length >= 2) {
      const event = this.createCommunicationEvent(recentWords, segment);
      
      if (event.confidence >= this.settings.confidenceThreshold) {
        this.communicationEvents.push(event);
        
        // Limit event history
        if (this.communicationEvents.length > 100) {
          this.communicationEvents.shift();
        }

        this.emit('communicationEvent', event);
      }
    }
  }

  private createCommunicationEvent(words: WordMatch[], segment: AudioSegment): CommunicationEvent {
    const phrase = words.map(w => w.word).join(' ');
    const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
    const duration = segment.duration;
    
    const significance = this.calculateSignificance(words, segment);
    const classification = this.classifyEvent(words, segment);
    
    return {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      words,
      phrase,
      confidence: avgConfidence,
      duration,
      significance,
      audioFeatures: segment.features,
      classification
    };
  }

  private calculateSignificance(words: WordMatch[], segment: AudioSegment): number {
    let significance = 0;
    
    // Factor in word categories
    words.forEach(word => {
      const category = word.context;
      const categoryWeights = {
        spirit: 2.0,
        response: 1.8,
        emotion: 1.5,
        name: 1.3,
        command: 1.2,
        location: 1.0,
        common: 0.5
      };
      
      significance += (categoryWeights[category as keyof typeof categoryWeights] || 0.5) * word.confidence;
    });
    
    // Factor in audio quality
    const audioQuality = (segment.signalToNoiseRatio + 40) / 60; // Normalize SNR
    significance *= Math.max(0.1, Math.min(1.0, audioQuality));
    
    // Factor in anomaly score (higher anomaly = potentially more significant)
    significance += segment.anomalyScore * 0.2;
    
    return Math.min(significance / words.length, 2.0);
  }

  private classifyEvent(words: WordMatch[], segment: AudioSegment): CommunicationEvent['classification'] {
    const hasSpirit = words.some(w => w.context === 'spirit');
    const hasResponse = words.some(w => w.context === 'response');
    const hasEmotion = words.some(w => w.context === 'emotion');
    const hasName = words.some(w => w.context === 'name');
    
    const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
    const goodAudio = segment.signalToNoiseRatio > -10;
    const highAnomaly = segment.anomalyScore > 0.3;
    
    if ((hasSpirit || hasResponse || hasName) && avgConfidence > 0.7 && goodAudio) {
      return 'potential_evp';
    }
    
    if (avgConfidence > 0.5 && !highAnomaly) {
      return 'ambient_speech';
    }
    
    if (avgConfidence < 0.3 || segment.signalToNoiseRatio < -20) {
      return 'noise';
    }
    
    return 'unknown';
  }

  public getDetectedWords(timeWindow?: number): WordMatch[] {
    if (!timeWindow) return [...this.detectedWords];
    
    const cutoff = Date.now() - timeWindow;
    return this.detectedWords.filter(word => word.timestamp > cutoff);
  }

  public getCommunicationEvents(timeWindow?: number): CommunicationEvent[] {
    if (!timeWindow) return [...this.communicationEvents];
    
    const cutoff = Date.now() - timeWindow;
    return this.communicationEvents.filter(event => event.timestamp > cutoff);
  }

  public updateSettings(newSettings: Partial<DetectionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);
  }

  public getWordDatabase(): WordDatabase {
    return {
      commonWords: new Set(this.wordDatabase.commonWords),
      spiritTerms: new Set(this.wordDatabase.spiritTerms),
      names: new Set(this.wordDatabase.names),
      emotions: new Set(this.wordDatabase.emotions),
      locations: new Set(this.wordDatabase.locations),
      responses: new Set(this.wordDatabase.responses),
      commands: new Set(this.wordDatabase.commands)
    };
  }

  public addCustomWords(category: keyof WordDatabase, words: string[]): void {
    words.forEach(word => {
      this.wordDatabase[category].add(word.toLowerCase());
      
      // Add to phonetic dictionary
      const phoneticCodes = this.generatePhoneticCodes(word);
      const soundex = soundexCode(word);
      
      this.phoneticDictionary[word.toLowerCase()] = {
        phoneticCodes,
        soundexCode: soundex,
        variations: this.generateVariations(word),
        frequency: this.getWordFrequency(word, category),
        category
      };
    });
    
    this.emit('databaseUpdated', { category, words });
  }

  public getStatistics(): {
    totalWords: number;
    recentWords: number;
    totalEvents: number;
    recentEvents: number;
    topCategories: { [key: string]: number };
    avgConfidence: number;
  } {
    const recentTimeWindow = 300000; // 5 minutes
    const cutoff = Date.now() - recentTimeWindow;
    
    const recentWords = this.detectedWords.filter(w => w.timestamp > cutoff);
    const recentEvents = this.communicationEvents.filter(e => e.timestamp > cutoff);
    
    const categoryCount: { [key: string]: number } = {};
    this.detectedWords.forEach(word => {
      const category = word.context || 'unknown';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    const avgConfidence = this.detectedWords.length > 0 
      ? this.detectedWords.reduce((sum, w) => sum + w.confidence, 0) / this.detectedWords.length
      : 0;
    
    return {
      totalWords: this.detectedWords.length,
      recentWords: recentWords.length,
      totalEvents: this.communicationEvents.length,
      recentEvents: recentEvents.length,
      topCategories: categoryCount,
      avgConfidence
    };
  }

  public clearHistory(): void {
    this.detectedWords = [];
    this.communicationEvents = [];
    this.wordSequenceBuffer = [];
    this.recentAudioSegments = [];
    
    this.emit('historyCleared');
  }
}