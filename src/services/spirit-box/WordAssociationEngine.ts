import { EventEmitter } from 'events';

export interface WordEntry {
  word: string;
  category: string;
  subcategory?: string;
  frequency: number;
  semanticWeight: number;
  associations: WordAssociation[];
}

export interface WordAssociation {
  targetWord: string;
  weight: number;
  relationshipType: 'semantic' | 'emotional' | 'contextual' | 'phonetic' | 'thematic';
  strength: number; // 0.1 to 1.0
}

export interface SemanticCategory {
  name: string;
  words: string[];
  associatedCategories: string[];
  contextTriggers: string[];
  weight: number;
}

export interface WordDatabase {
  entries: Map<string, WordEntry>;
  categories: Map<string, SemanticCategory>;
  totalWords: number;
  version: string;
}

export class WordAssociationEngine extends EventEmitter {
  private database: WordDatabase;
  private associationMatrix: Map<string, Map<string, number>> = new Map();
  private categoryWeights: Map<string, number> = new Map();
  private activeContext: string[] = [];
  private recentWords: string[] = [];
  private maxRecentWords = 20;

  constructor() {
    super();
    this.database = this.initializeDatabase();
    this.buildAssociationMatrix();
  }

  private initializeDatabase(): WordDatabase {
    const entries = new Map<string, WordEntry>();
    const categories = new Map<string, SemanticCategory>();

    // Death and Afterlife Category
    const deathAfterlife = [
      'death', 'die', 'died', 'dead', 'dying', 'passed', 'gone', 'departed', 'deceased',
      'afterlife', 'beyond', 'other side', 'heaven', 'hell', 'purgatory', 'limbo',
      'spirit', 'ghost', 'soul', 'essence', 'energy', 'presence', 'entity',
      'cross over', 'transition', 'journey', 'passage', 'portal', 'bridge',
      'eternal', 'forever', 'always', 'never', 'end', 'beginning', 'cycle',
      'peace', 'rest', 'sleep', 'wake', 'awake', 'consciousness', 'awareness',
      'memory', 'remember', 'forget', 'recall', 'reminisce', 'past', 'before',
      'grave', 'cemetery', 'burial', 'funeral', 'memorial', 'service', 'ceremony',
      'goodbye', 'farewell', 'until we meet', 'see you again', 'miss you', 'love you'
    ];

    // Names - Common First Names
    const names = [
      // Male names
      'james', 'robert', 'john', 'michael', 'william', 'david', 'richard', 'joseph',
      'thomas', 'christopher', 'charles', 'daniel', 'matthew', 'anthony', 'mark', 'donald',
      'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george',
      'timothy', 'ronald', 'jason', 'edward', 'jeffrey', 'ryan', 'jacob', 'gary',
      'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
      'benjamin', 'samuel', 'frank', 'gregory', 'raymond', 'alexander', 'patrick', 'jack',
      'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'henry', 'adam', 'douglas',
      'nathan', 'peter', 'zachary', 'kyle', 'noah', 'alan', 'ethan', 'jeremy',
      'lionel', 'wayne', 'ralph', 'roy', 'eugene', 'louis', 'philip', 'bobby',
      
      // Female names
      'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica',
      'sarah', 'karen', 'nancy', 'lisa', 'betty', 'helen', 'sandra', 'donna',
      'carol', 'ruth', 'sharon', 'michelle', 'laura', 'sarah', 'kimberly', 'deborah',
      'dorothy', 'lisa', 'nancy', 'karen', 'betty', 'helen', 'sandra', 'donna',
      'carol', 'ruth', 'sharon', 'michelle', 'laura', 'sarah', 'kimberly', 'deborah',
      'dorothy', 'amy', 'angela', 'ashley', 'brenda', 'emma', 'olivia', 'cynthia',
      'marie', 'janet', 'catherine', 'frances', 'christine', 'samantha', 'debra', 'rachel',
      'carolyn', 'janet', 'virginia', 'maria', 'heather', 'diane', 'julie', 'joyce',
      'victoria', 'kelly', 'christina', 'joan', 'evelyn', 'lauren', 'judith', 'megan',
      'cheryl', 'andrea', 'hannah', 'jacqueline', 'martha', 'gloria', 'sara', 'janice',
      
      // Historical/Vintage names
      'agnes', 'florence', 'clara', 'pearl', 'rose', 'grace', 'ida', 'edith',
      'bertha', 'minnie', 'alice', 'anna', 'emma', 'margaret', 'lucy', 'ethel',
      'arthur', 'walter', 'harold', 'albert', 'clarence', 'fred', 'earl', 'henry'
    ];

    // Emotions and Feelings
    const emotions = [
      'happy', 'sad', 'angry', 'mad', 'glad', 'joy', 'fear', 'afraid', 'scared',
      'worried', 'concerned', 'anxious', 'calm', 'peaceful', 'serene', 'tranquil',
      'excited', 'thrilled', 'elated', 'disappointed', 'frustrated', 'annoyed', 'irritated',
      'confused', 'lost', 'found', 'hopeful', 'hopeless', 'grateful', 'thankful',
      'sorry', 'regret', 'guilt', 'shame', 'pride', 'humble', 'confident', 'doubt',
      'trust', 'distrust', 'lonely', 'together', 'alone', 'crowded', 'empty', 'full',
      'love', 'hate', 'like', 'dislike', 'enjoy', 'suffer', 'hurt', 'pain',
      'comfort', 'warm', 'cold', 'hot', 'cool', 'bitter', 'sweet', 'sour',
      'jealous', 'envious', 'proud', 'ashamed', 'embarrassed', 'shy', 'bold', 'brave',
      'coward', 'strong', 'weak', 'powerful', 'helpless', 'capable', 'unable'
    ];

    // Locations and Places
    const locations = [
      'here', 'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere',
      'home', 'house', 'room', 'kitchen', 'bedroom', 'bathroom', 'living room',
      'attic', 'basement', 'garage', 'garden', 'yard', 'porch', 'deck',
      'door', 'window', 'stairs', 'hall', 'hallway', 'closet', 'pantry',
      'office', 'school', 'church', 'hospital', 'store', 'shop', 'market',
      'park', 'forest', 'woods', 'field', 'meadow', 'farm', 'barn',
      'river', 'lake', 'ocean', 'sea', 'pond', 'stream', 'creek',
      'mountain', 'hill', 'valley', 'cliff', 'cave', 'tunnel', 'bridge',
      'city', 'town', 'village', 'neighborhood', 'street', 'road', 'path',
      'country', 'state', 'nation', 'world', 'earth', 'ground', 'floor',
      'up', 'down', 'left', 'right', 'north', 'south', 'east', 'west',
      'center', 'middle', 'corner', 'edge', 'side', 'top', 'bottom',
      'inside', 'outside', 'upstairs', 'downstairs', 'nearby', 'far', 'close'
    ];

    // Actions and Verbs
    const actions = [
      'come', 'go', 'stay', 'leave', 'arrive', 'depart', 'enter', 'exit',
      'walk', 'run', 'jump', 'climb', 'fall', 'fly', 'swim', 'dance',
      'sit', 'stand', 'lie', 'sleep', 'wake', 'rest', 'work', 'play',
      'eat', 'drink', 'breathe', 'live', 'exist', 'be', 'become', 'remain',
      'start', 'begin', 'stop', 'end', 'finish', 'continue', 'pause', 'wait',
      'hurry', 'slow', 'fast', 'quick', 'move', 'still', 'quiet', 'loud',
      'speak', 'talk', 'say', 'tell', 'whisper', 'shout', 'call', 'answer',
      'listen', 'hear', 'see', 'look', 'watch', 'observe', 'notice', 'find',
      'search', 'seek', 'hide', 'show', 'reveal', 'conceal', 'display', 'present',
      'give', 'take', 'bring', 'carry', 'hold', 'release', 'let', 'allow',
      'help', 'assist', 'support', 'protect', 'guard', 'defend', 'attack', 'fight',
      'push', 'pull', 'lift', 'drop', 'throw', 'catch', 'touch', 'feel',
      'think', 'know', 'understand', 'learn', 'teach', 'remember', 'forget'
    ];

    // Family and Relationships
    const family = [
      'mother', 'mom', 'mama', 'mommy', 'father', 'dad', 'daddy', 'papa',
      'son', 'daughter', 'child', 'children', 'baby', 'infant', 'toddler',
      'brother', 'sister', 'sibling', 'twin', 'cousin', 'nephew', 'niece',
      'grandfather', 'grandpa', 'grandmother', 'grandma', 'grandparent',
      'uncle', 'aunt', 'husband', 'wife', 'spouse', 'partner', 'lover',
      'friend', 'buddy', 'pal', 'companion', 'neighbor', 'stranger',
      'family', 'relative', 'ancestor', 'descendant', 'generation', 'lineage',
      'marriage', 'wedding', 'divorce', 'birth', 'birthday', 'anniversary'
    ];

    // Time References
    const timeReferences = [
      'now', 'then', 'when', 'before', 'after', 'during', 'while', 'until',
      'today', 'yesterday', 'tomorrow', 'tonight', 'morning', 'afternoon', 'evening',
      'day', 'night', 'week', 'month', 'year', 'decade', 'century', 'lifetime',
      'second', 'minute', 'hour', 'moment', 'instant', 'forever', 'always', 'never',
      'early', 'late', 'soon', 'later', 'first', 'last', 'next', 'previous',
      'past', 'present', 'future', 'history', 'memory', 'prophecy', 'prediction',
      'spring', 'summer', 'autumn', 'fall', 'winter', 'season', 'weather'
    ];

    // Objects and Things
    const objects = [
      'book', 'paper', 'pen', 'pencil', 'letter', 'photograph', 'picture', 'image',
      'mirror', 'glass', 'window', 'door', 'key', 'lock', 'box', 'container',
      'clothes', 'dress', 'shirt', 'pants', 'shoes', 'hat', 'jewelry', 'ring',
      'watch', 'clock', 'time', 'calendar', 'phone', 'computer', 'television',
      'radio', 'music', 'song', 'instrument', 'piano', 'guitar', 'violin',
      'car', 'truck', 'bicycle', 'boat', 'plane', 'train', 'bus', 'vehicle',
      'money', 'coin', 'dollar', 'treasure', 'gold', 'silver', 'diamond', 'stone',
      'flower', 'tree', 'plant', 'grass', 'leaf', 'branch', 'root', 'seed',
      'food', 'water', 'bread', 'apple', 'candy', 'cake', 'cookie', 'meal',
      'fire', 'flame', 'candle', 'light', 'lamp', 'bulb', 'darkness', 'shadow',
      'toy', 'doll', 'ball', 'game', 'puzzle', 'cards', 'dice', 'chess'
    ];

    // Responses - Communication Words
    const responses = [
      'yes', 'yeah', 'yep', 'correct', 'right', 'true', 'absolutely', 'certainly',
      'no', 'nope', 'wrong', 'false', 'not', 'never', 'negative', 'incorrect',
      'maybe', 'perhaps', 'possibly', 'probably', 'might', 'could', 'should', 'would',
      'hello', 'hi', 'hey', 'greetings', 'welcome', 'goodbye', 'bye', 'farewell',
      'thanks', 'thank you', 'please', 'excuse me', 'pardon', 'sorry', 'forgive',
      'understand', 'know', 'remember', 'forget', 'recall', 'think', 'believe',
      'help', 'assist', 'support', 'protect', 'guard', 'watch', 'guide', 'lead',
      'okay', 'alright', 'fine', 'good', 'bad', 'better', 'worse', 'best', 'worst'
    ];

    // Paranormal and Spiritual
    const paranormal = [
      'spirit', 'ghost', 'entity', 'presence', 'energy', 'soul', 'essence', 'being',
      'haunted', 'haunting', 'manifestation', 'apparition', 'specter', 'phantom',
      'otherworldly', 'supernatural', 'paranormal', 'unexplained', 'mysterious',
      'psychic', 'medium', 'communication', 'message', 'sign', 'signal', 'contact',
      'dimension', 'realm', 'plane', 'world', 'universe', 'cosmos', 'void',
      'portal', 'gateway', 'doorway', 'passage', 'crossing', 'threshold',
      'energy', 'vibration', 'frequency', 'resonance', 'aura', 'field', 'force',
      'séance', 'ritual', 'ceremony', 'blessing', 'prayer', 'meditation', 'spiritual',
      'investigation', 'evidence', 'phenomena', 'activity', 'occurrence', 'event'
    ];

    // Colors
    const colors = [
      'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
      'black', 'white', 'gray', 'grey', 'silver', 'gold', 'dark', 'light',
      'bright', 'dim', 'clear', 'cloudy', 'transparent', 'opaque', 'vivid', 'pale'
    ];

    // Numbers and Quantities
    const numbers = [
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
      'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
      'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
      'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
      'ninth', 'tenth', 'last', 'final', 'initial', 'beginning', 'end',
      'few', 'many', 'several', 'some', 'all', 'none', 'every', 'each', 'most',
      'more', 'less', 'enough', 'too much', 'too little', 'plenty', 'abundance'
    ];

    // Medical and Body
    const medical = [
      'sick', 'ill', 'disease', 'pain', 'hurt', 'injury', 'wound', 'broken',
      'heal', 'cure', 'medicine', 'doctor', 'nurse', 'hospital', 'surgery',
      'head', 'face', 'eye', 'nose', 'mouth', 'ear', 'hair', 'neck',
      'shoulder', 'arm', 'hand', 'finger', 'chest', 'heart', 'lung', 'stomach',
      'back', 'leg', 'foot', 'toe', 'skin', 'bone', 'blood', 'breath'
    ];

    // Weather and Nature
    const weather = [
      'sun', 'sunny', 'sunshine', 'bright', 'hot', 'warm', 'heat', 'summer',
      'rain', 'rainy', 'wet', 'storm', 'thunder', 'lightning', 'flood', 'drip',
      'snow', 'snowy', 'cold', 'ice', 'frozen', 'winter', 'freeze', 'chill',
      'wind', 'windy', 'breeze', 'gust', 'blow', 'air', 'atmosphere', 'sky',
      'cloud', 'cloudy', 'clear', 'foggy', 'mist', 'haze', 'visibility',
      'season', 'climate', 'temperature', 'weather', 'forecast', 'prediction'
    ];

    // Create category mappings
    const categoryData = [
      { name: 'death_afterlife', words: deathAfterlife, weight: 2.0, triggers: ['death', 'died', 'passed', 'afterlife', 'spirit'] },
      { name: 'names', words: names, weight: 1.5, triggers: ['name', 'called', 'who'] },
      { name: 'emotions', words: emotions, weight: 1.8, triggers: ['feel', 'feeling', 'emotion', 'happy', 'sad'] },
      { name: 'locations', words: locations, weight: 1.3, triggers: ['where', 'place', 'location', 'room'] },
      { name: 'actions', words: actions, weight: 1.6, triggers: ['do', 'doing', 'action', 'what'] },
      { name: 'family', words: family, weight: 1.7, triggers: ['family', 'relative', 'mother', 'father', 'child'] },
      { name: 'time', words: timeReferences, weight: 1.2, triggers: ['when', 'time', 'day', 'year'] },
      { name: 'objects', words: objects, weight: 1.0, triggers: ['thing', 'object', 'item'] },
      { name: 'responses', words: responses, weight: 2.2, triggers: ['question', 'ask', 'answer'] },
      { name: 'paranormal', words: paranormal, weight: 2.5, triggers: ['spirit', 'ghost', 'energy', 'presence'] },
      { name: 'colors', words: colors, weight: 0.8, triggers: ['color', 'look', 'see'] },
      { name: 'numbers', words: numbers, weight: 1.1, triggers: ['how many', 'number', 'count'] },
      { name: 'medical', words: medical, weight: 1.4, triggers: ['hurt', 'pain', 'sick', 'body'] },
      { name: 'weather', words: weather, weight: 0.9, triggers: ['weather', 'outside', 'sky'] }
    ];

    // Build entries and categories
    categoryData.forEach(catData => {
      const category: SemanticCategory = {
        name: catData.name,
        words: catData.words,
        associatedCategories: this.getAssociatedCategories(catData.name),
        contextTriggers: catData.triggers,
        weight: catData.weight
      };
      categories.set(catData.name, category);

      catData.words.forEach(word => {
        const entry: WordEntry = {
          word: word.toLowerCase(),
          category: catData.name,
          frequency: this.calculateWordFrequency(word, catData.name),
          semanticWeight: catData.weight,
          associations: this.generateAssociations(word, catData.name, categoryData)
        };
        entries.set(word.toLowerCase(), entry);
      });
    });

    return {
      entries,
      categories,
      totalWords: entries.size,
      version: '1.0.0'
    };
  }

  private getAssociatedCategories(categoryName: string): string[] {
    const associations: { [key: string]: string[] } = {
      death_afterlife: ['paranormal', 'emotions', 'family', 'time'],
      names: ['family', 'responses', 'emotions'],
      emotions: ['death_afterlife', 'family', 'responses', 'medical'],
      locations: ['family', 'objects', 'actions'],
      actions: ['locations', 'objects', 'emotions', 'time'],
      family: ['names', 'emotions', 'death_afterlife', 'locations'],
      time: ['death_afterlife', 'actions', 'weather', 'family'],
      objects: ['locations', 'actions', 'colors'],
      responses: ['emotions', 'names', 'paranormal'],
      paranormal: ['death_afterlife', 'emotions', 'responses'],
      colors: ['objects', 'emotions', 'weather'],
      numbers: ['time', 'family', 'objects'],
      medical: ['emotions', 'family', 'death_afterlife'],
      weather: ['time', 'emotions', 'locations']
    };

    return associations[categoryName] || [];
  }

  private calculateWordFrequency(word: string, category: string): number {
    const categoryWeights: { [key: string]: number } = {
      death_afterlife: 2.0,
      names: 1.5,
      emotions: 1.8,
      locations: 1.3,
      actions: 1.6,
      family: 1.7,
      time: 1.2,
      objects: 1.0,
      responses: 2.2,
      paranormal: 2.5,
      colors: 0.8,
      numbers: 1.1,
      medical: 1.4,
      weather: 0.9
    };

    const baseFreq = categoryWeights[category] || 1.0;
    const lengthPenalty = Math.max(0.3, 1 - (word.length - 4) * 0.05);
    
    // Boost common communication words
    const commonWords = ['yes', 'no', 'hello', 'goodbye', 'help', 'here', 'love', 'peace'];
    const commonBoost = commonWords.includes(word.toLowerCase()) ? 1.5 : 1.0;

    return baseFreq * lengthPenalty * commonBoost;
  }

  private generateAssociations(word: string, category: string, allCategories: any[]): WordAssociation[] {
    const associations: WordAssociation[] = [];

    // Semantic associations within same category
    const sameCategory = allCategories.find(cat => cat.name === category);
    if (sameCategory) {
      const relatedWords = sameCategory.words.filter((w: string) => w !== word);
      const numAssociations = Math.min(5, relatedWords.length);
      
      for (let i = 0; i < numAssociations; i++) {
        const targetWord = relatedWords[Math.floor(Math.random() * relatedWords.length)];
        associations.push({
          targetWord: targetWord.toLowerCase(),
          weight: 0.8 + Math.random() * 0.2,
          relationshipType: 'semantic',
          strength: 0.7 + Math.random() * 0.3
        });
      }
    }

    // Cross-category associations
    const associatedCategories = this.getAssociatedCategories(category);
    associatedCategories.forEach(catName => {
      const associatedCat = allCategories.find(cat => cat.name === catName);
      if (associatedCat) {
        const crossWords = associatedCat.words.slice(0, 3);
        crossWords.forEach((crossWord: string) => {
          associations.push({
            targetWord: crossWord.toLowerCase(),
            weight: 0.4 + Math.random() * 0.3,
            relationshipType: 'contextual',
            strength: 0.3 + Math.random() * 0.4
          });
        });
      }
    });

    // Special thematic associations
    const thematicAssociations = this.getThematicAssociations(word);
    associations.push(...thematicAssociations);

    return associations.slice(0, 15); // Limit to 15 associations per word
  }

  private getThematicAssociations(word: string): WordAssociation[] {
    const associations: WordAssociation[] = [];
    
    const thematicMappings: { [key: string]: { words: string[], type: WordAssociation['relationshipType'], strength: number } } = {
      // Death theme
      'death': { words: ['afterlife', 'spirit', 'peace', 'remember', 'love'], type: 'thematic', strength: 0.9 },
      'spirit': { words: ['energy', 'presence', 'message', 'communication', 'love'], type: 'thematic', strength: 0.9 },
      'ghost': { words: ['spirit', 'presence', 'here', 'message', 'help'], type: 'thematic', strength: 0.8 },
      
      // Family theme
      'mother': { words: ['love', 'care', 'protect', 'child', 'family'], type: 'thematic', strength: 0.8 },
      'father': { words: ['strong', 'protect', 'guide', 'family', 'love'], type: 'thematic', strength: 0.8 },
      'child': { words: ['play', 'toy', 'school', 'young', 'innocent'], type: 'thematic', strength: 0.8 },
      
      // Emotional theme
      'love': { words: ['care', 'miss', 'remember', 'forever', 'heart'], type: 'emotional', strength: 0.9 },
      'sad': { words: ['cry', 'hurt', 'miss', 'alone', 'pain'], type: 'emotional', strength: 0.7 },
      'happy': { words: ['joy', 'smile', 'laugh', 'good', 'bright'], type: 'emotional', strength: 0.7 },
      
      // Communication theme
      'hello': { words: ['here', 'present', 'communication', 'message', 'contact'], type: 'contextual', strength: 0.8 },
      'help': { words: ['need', 'assistance', 'please', 'urgent', 'important'], type: 'contextual', strength: 0.8 },
      'yes': { words: ['correct', 'true', 'right', 'agree', 'confirm'], type: 'contextual', strength: 0.9 },
      'no': { words: ['wrong', 'false', 'disagree', 'stop', 'not'], type: 'contextual', strength: 0.9 }
    };

    const mapping = thematicMappings[word.toLowerCase()];
    if (mapping) {
      mapping.words.forEach(targetWord => {
        associations.push({
          targetWord,
          weight: 0.6 + Math.random() * 0.3,
          relationshipType: mapping.type,
          strength: mapping.strength
        });
      });
    }

    return associations;
  }

  private buildAssociationMatrix(): void {
    this.database.entries.forEach((entry, word) => {
      const wordAssociations = new Map<string, number>();
      
      entry.associations.forEach(assoc => {
        wordAssociations.set(assoc.targetWord, assoc.weight * assoc.strength);
      });
      
      this.associationMatrix.set(word, wordAssociations);
    });

    // Initialize category weights
    this.database.categories.forEach((category, name) => {
      this.categoryWeights.set(name, category.weight);
    });
  }

  public getAssociatedWords(inputWord: string, maxResults = 10): string[] {
    const word = inputWord.toLowerCase();
    const associations = this.associationMatrix.get(word);
    
    if (!associations) {
      return this.getFallbackWords(word, maxResults);
    }

    // Sort by association weight and return top results
    const sortedAssociations = Array.from(associations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([associatedWord]) => associatedWord);

    return sortedAssociations;
  }

  private getFallbackWords(word: string, maxResults: number): string[] {
    // If word not in database, try phonetic similarity
    const fallbackWords: string[] = [];
    
    this.database.entries.forEach((entry, dbWord) => {
      if (this.calculatePhoneticSimilarity(word, dbWord) > 0.7) {
        fallbackWords.push(dbWord);
      }
    });

    return fallbackWords.slice(0, maxResults);
  }

  private calculatePhoneticSimilarity(word1: string, word2: string): number {
    // Simple phonetic similarity based on common letters
    const chars1 = new Set(word1.toLowerCase().split(''));
    const chars2 = new Set(word2.toLowerCase().split(''));
    
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    const union = new Set([...chars1, ...chars2]);
    
    return intersection.size / union.size;
  }

  public updateContext(contextWords: string[]): void {
    this.activeContext = contextWords.map(w => w.toLowerCase());
    
    // Update category weights based on context
    this.activeContext.forEach(word => {
      const entry = this.database.entries.get(word);
      if (entry) {
        const currentWeight = this.categoryWeights.get(entry.category) || 1.0;
        this.categoryWeights.set(entry.category, currentWeight * 1.5);
      }
    });

    this.emit('contextUpdated', this.activeContext);
  }

  public addRecentWord(word: string): void {
    this.recentWords.unshift(word.toLowerCase());
    
    if (this.recentWords.length > this.maxRecentWords) {
      this.recentWords.pop();
    }

    // Update associations based on recent words
    this.updateDynamicAssociations();
  }

  private updateDynamicAssociations(): void {
    // Boost words that are associated with recent words
    const recentBoosts = new Map<string, number>();
    
    this.recentWords.forEach((recentWord, index) => {
      const associations = this.associationMatrix.get(recentWord);
      if (associations) {
        associations.forEach((weight, associatedWord) => {
          const boost = (1.0 - index * 0.1) * 0.3; // Decay boost for older words
          recentBoosts.set(associatedWord, (recentBoosts.get(associatedWord) || 0) + boost);
        });
      }
    });

    this.emit('associationsUpdated', recentBoosts);
  }

  public getWordsByCategory(category: string, limit = 20): string[] {
    const categoryData = this.database.categories.get(category);
    if (!categoryData) return [];

    return categoryData.words
      .sort((a, b) => {
        const entryA = this.database.entries.get(a);
        const entryB = this.database.entries.get(b);
        return (entryB?.frequency || 0) - (entryA?.frequency || 0);
      })
      .slice(0, limit);
  }

  public findWordsWithContext(contextWords: string[], maxResults = 10): string[] {
    const contextSet = new Set(contextWords.map(w => w.toLowerCase()));
    const scoredWords: { word: string, score: number }[] = [];

    this.database.entries.forEach((entry, word) => {
      let score = entry.frequency * entry.semanticWeight;

      // Boost if word has associations with context words
      entry.associations.forEach(assoc => {
        if (contextSet.has(assoc.targetWord)) {
          score += assoc.weight * assoc.strength * 2.0;
        }
      });

      // Boost if word is in same category as context words
      contextWords.forEach(contextWord => {
        const contextEntry = this.database.entries.get(contextWord.toLowerCase());
        if (contextEntry && contextEntry.category === entry.category) {
          score += 1.0;
        }
      });

      scoredWords.push({ word, score });
    });

    return scoredWords
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.word);
  }

  public getRandomWordFromCategory(category: string): string | null {
    const categoryData = this.database.categories.get(category);
    if (!categoryData || categoryData.words.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * categoryData.words.length);
    return categoryData.words[randomIndex];
  }

  public getCategoryTriggers(inputText: string): string[] {
    const text = inputText.toLowerCase();
    const triggeredCategories: string[] = [];

    this.database.categories.forEach((category, name) => {
      const hasMatch = category.contextTriggers.some(trigger => 
        text.includes(trigger.toLowerCase())
      );
      
      if (hasMatch) {
        triggeredCategories.push(name);
      }
    });

    return triggeredCategories;
  }

  public getDatabaseStats(): {
    totalWords: number;
    categories: number;
    averageAssociations: number;
    topCategories: { name: string, wordCount: number }[];
  } {
    const categoryCounts = new Map<string, number>();
    let totalAssociations = 0;

    this.database.entries.forEach(entry => {
      categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
      totalAssociations += entry.associations.length;
    });

    const topCategories = Array.from(categoryCounts.entries())
      .map(([name, wordCount]) => ({ name, wordCount }))
      .sort((a, b) => b.wordCount - a.wordCount);

    return {
      totalWords: this.database.totalWords,
      categories: this.database.categories.size,
      averageAssociations: totalAssociations / this.database.totalWords,
      topCategories
    };
  }

  public exportDatabase(): WordDatabase {
    return {
      entries: new Map(this.database.entries),
      categories: new Map(this.database.categories),
      totalWords: this.database.totalWords,
      version: this.database.version
    };
  }

  public resetWeights(): void {
    this.database.categories.forEach((category, name) => {
      this.categoryWeights.set(name, category.weight);
    });
    
    this.activeContext = [];
    this.recentWords = [];
    this.emit('weightsReset');
  }
}