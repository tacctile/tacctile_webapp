import { app } from 'electron';
// import Database from 'better-sqlite3'; // Temporarily disabled for basic startup
import { join } from 'path';

export interface InvestigationMetadata {
  location: string;
  date: Date;
  time?: string;
  weather?: string;
  temperature?: string;
  investigatorName?: string;
  teamMembers?: string[];
  equipmentUsed?: string[];
  phenomena?: string[];
  confidenceLevel?: 'low' | 'medium' | 'high' | 'very-high';
  classification?: 'unexplained' | 'paranormal' | 'inconclusive' | 'debunked';
}

export interface EvidenceData {
  type: 'evp' | 'visual' | 'temperature' | 'emf' | 'motion' | 'other';
  timestamp: Date;
  description: string;
  strength: 'weak' | 'moderate' | 'strong' | 'compelling';
  verified: boolean;
  coordinates?: { lat: number; lng: number };
  sensorReadings?: Record<string, number>;
  mediaFiles?: string[];
}

export interface PostTemplate {
  id: string;
  name: string;
  platform: string;
  category: 'evidence' | 'investigation' | 'analysis' | 'announcement';
  template: string; // Template string with placeholders
  variables: string[]; // List of available placeholder variables
  hashtags: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedPost {
  platform: string;
  caption: string;
  hashtags: string[];
  suggestedMedia?: string;
  metadata: InvestigationMetadata;
  evidenceData?: EvidenceData;
}

export class PostTemplateManager {
  private static instance: PostTemplateManager;
  private db: Database.Database;

  private constructor() {
    this.initializeDatabase();
    this.seedDefaultTemplates();
  }

  public static getInstance(): PostTemplateManager {
    if (!PostTemplateManager.instance) {
      PostTemplateManager.instance = new PostTemplateManager();
    }
    return PostTemplateManager.instance;
  }

  private initializeDatabase(): void {
    const dbPath = join(app.getPath('userData'), 'post-templates.db');
    this.db = new Database(dbPath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS post_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        category TEXT NOT NULL,
        template TEXT NOT NULL,
        variables TEXT NOT NULL, -- JSON array
        hashtags TEXT NOT NULL, -- JSON array
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_templates_platform_category 
      ON post_templates (platform, category);
    `);
  }

  public generatePost(
    templateId: string,
    metadata: InvestigationMetadata,
    evidenceData?: EvidenceData
  ): GeneratedPost {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const variables = this.extractVariables(metadata, evidenceData);
    const caption = this.processTemplate(template.template, variables);

    return {
      platform: template.platform,
      caption,
      hashtags: template.hashtags,
      metadata,
      evidenceData
    };
  }

  public generatePostsForAllPlatforms(
    metadata: InvestigationMetadata,
    evidenceData?: EvidenceData,
    category = 'evidence'
  ): GeneratedPost[] {
    const platforms = ['instagram', 'tiktok', 'twitter', 'facebook', 'reddit'];
    const posts: GeneratedPost[] = [];

    for (const platform of platforms) {
      const template = this.getDefaultTemplateForPlatform(platform, category);
      if (template) {
        try {
          const post = this.generatePost(template.id, metadata, evidenceData);
          posts.push(post);
        } catch (error) {
          console.warn(`Failed to generate post for ${platform}:`, error);
        }
      }
    }

    return posts;
  }

  public createTemplate(template: Omit<PostTemplate, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO post_templates 
      (id, name, platform, category, template, variables, hashtags, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      template.name,
      template.platform,
      template.category,
      template.template,
      JSON.stringify(template.variables),
      JSON.stringify(template.hashtags),
      template.isDefault ? 1 : 0,
      now,
      now
    );

    return id;
  }

  public updateTemplate(id: string, updates: Partial<PostTemplate>): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id' || key === 'createdAt') return;
      
      let dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (key === 'isDefault') dbKey = 'is_default';
      
      fields.push(`${dbKey} = ?`);
      
      if (key === 'variables' || key === 'hashtags') {
        values.push(JSON.stringify(value));
      } else if (key === 'isDefault') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    });

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE post_templates 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  public deleteTemplate(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM post_templates WHERE id = ? AND is_default = 0');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public getTemplate(id: string): PostTemplate | null {
    const stmt = this.db.prepare('SELECT * FROM post_templates WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.mapRowToTemplate(row);
  }

  public getTemplates(filters?: {
    platform?: string;
    category?: string;
    includeDefaults?: boolean;
  }): PostTemplate[] {
    let query = 'SELECT * FROM post_templates WHERE 1=1';
    const params: any[] = [];

    if (filters?.platform) {
      query += ' AND platform = ?';
      params.push(filters.platform);
    }

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters?.includeDefaults === false) {
      query += ' AND is_default = 0';
    }

    query += ' ORDER BY is_default DESC, name ASC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToTemplate(row));
  }

  public getDefaultTemplateForPlatform(platform: string, category: string): PostTemplate | null {
    const stmt = this.db.prepare(`
      SELECT * FROM post_templates 
      WHERE platform = ? AND category = ? AND is_default = 1
      LIMIT 1
    `);
    
    const row = stmt.get(platform, category) as any;
    return row ? this.mapRowToTemplate(row) : null;
  }

  private extractVariables(metadata: InvestigationMetadata, evidenceData?: EvidenceData): Record<string, string> {
    const variables: Record<string, string> = {
      // Investigation metadata
      location: metadata.location,
      date: metadata.date.toLocaleDateString(),
      time: metadata.time || metadata.date.toLocaleTimeString(),
      weather: metadata.weather || 'Unknown',
      temperature: metadata.temperature || 'Unknown',
      investigator: metadata.investigatorName || 'Anonymous',
      team: metadata.teamMembers?.join(', ') || 'Solo investigation',
      equipment: metadata.equipmentUsed?.join(', ') || 'Standard equipment',
      phenomena: metadata.phenomena?.join(', ') || 'Various phenomena',
      confidence: metadata.confidenceLevel || 'unknown',
      classification: metadata.classification || 'under review',
      
      // Evidence data
      evidenceType: evidenceData?.type || 'general',
      evidenceTime: evidenceData?.timestamp.toLocaleTimeString() || '',
      evidenceDescription: evidenceData?.description || 'Compelling evidence captured',
      evidenceStrength: evidenceData?.strength || 'moderate',
      verified: evidenceData?.verified ? 'verified' : 'under review',

      // Generated content
      currentDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      season: this.getCurrentSeason(),
      moonPhase: this.getMoonPhase(),
      
      // Ghost hunting specific
      investigationType: this.getInvestigationType(metadata),
      locationtype: this.getLocationType(metadata.location),
      evidenceSummary: this.generateEvidenceSummary(evidenceData)
    };

    return variables;
  }

  private processTemplate(template: string, variables: Record<string, string>): string {
    let processed = template;

    // Replace all variables in the format {variableName}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(placeholder, value);
    }

    // Handle conditional blocks {if:variable}content{/if}
    processed = processed.replace(/\{if:(\w+)\}(.*?)\{\/if\}/g, (match, variable, content) => {
      const value = variables[variable];
      return (value && value !== 'Unknown' && value !== 'unknown') ? content : '';
    });

    // Clean up extra whitespace and newlines
    processed = processed.replace(/\n\s*\n/g, '\n').trim();

    return processed;
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  }

  private getMoonPhase(): string {
    // Simplified moon phase calculation
    const now = new Date();
    const phase = (now.getTime() / 86400000 - 3) % 29.53;
    
    if (phase < 1.84566) return 'New Moon';
    if (phase < 5.53699) return 'Waxing Crescent';
    if (phase < 9.22831) return 'First Quarter';
    if (phase < 12.91963) return 'Waxing Gibbous';
    if (phase < 16.61096) return 'Full Moon';
    if (phase < 20.30228) return 'Waning Gibbous';
    if (phase < 23.99361) return 'Last Quarter';
    if (phase < 27.68493) return 'Waning Crescent';
    return 'New Moon';
  }

  private getInvestigationType(metadata: InvestigationMetadata): string {
    if (metadata.phenomena?.includes('EVP') || metadata.phenomena?.includes('voice')) return 'EVP Investigation';
    if (metadata.phenomena?.includes('apparition') || metadata.phenomena?.includes('shadow')) return 'Visual Investigation';
    if (metadata.phenomena?.includes('cold') || metadata.phenomena?.includes('temperature')) return 'Environmental Investigation';
    return 'General Investigation';
  }

  private getLocationType(location: string): string {
    const lower = location.toLowerCase();
    if (lower.includes('house') || lower.includes('home')) return 'residential';
    if (lower.includes('hospital') || lower.includes('medical')) return 'medical facility';
    if (lower.includes('school') || lower.includes('university')) return 'educational';
    if (lower.includes('cemetery') || lower.includes('graveyard')) return 'cemetery';
    if (lower.includes('church') || lower.includes('chapel')) return 'religious';
    if (lower.includes('hotel') || lower.includes('inn')) return 'hospitality';
    if (lower.includes('theater') || lower.includes('theatre')) return 'entertainment venue';
    return 'historic location';
  }

  private generateEvidenceSummary(evidenceData?: EvidenceData): string {
    if (!evidenceData) return 'Multiple phenomena documented';
    
    const strength = evidenceData.strength;
    const type = evidenceData.type.toUpperCase();
    
    return `${strength} ${type} evidence captured`;
  }

  private seedDefaultTemplates(): void {
    // Check if default templates already exist
    const existingCount = this.db.prepare('SELECT COUNT(*) as count FROM post_templates WHERE is_default = 1').get() as any;
    if (existingCount.count > 0) return;

    const defaultTemplates: Omit<PostTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // Instagram Templates
      {
        name: 'Instagram Evidence Post',
        platform: 'instagram',
        category: 'evidence',
        template: `🔍 PARANORMAL EVIDENCE ALERT 🔍

Location: {location}
Date: {date} at {time}
Evidence Type: {evidenceType}
Strength: {evidenceStrength}

{evidenceDescription}

Investigation Details:
📍 {locationtype}
🌡️ Temperature: {temperature}
🌙 Moon Phase: {moonPhase}
{if:weather}🌤️ Weather: {weather}{/if}

Classification: {classification}
Status: {verified}

What do you think? Share your thoughts in the comments! 👻

#ParanormalEvidence #GhostHunting #Paranormal #Evidence`,
        variables: ['location', 'date', 'time', 'evidenceType', 'evidenceStrength', 'evidenceDescription', 'locationtype', 'temperature', 'moonPhase', 'weather', 'classification', 'verified'],
        hashtags: ['#ParanormalEvidence', '#GhostHunting', '#Paranormal', '#Evidence', '#Supernatural', '#Investigation'],
        isDefault: true
      },

      // TikTok Templates
      {
        name: 'TikTok Evidence Reveal',
        platform: 'tiktok',
        category: 'evidence',
        template: `👻 CAUGHT ON CAMERA 👻

This happened at {location} on {date}...

{evidenceDescription}

Evidence strength: {evidenceStrength}
Classification: {classification}

What would YOU do in this situation? 😱

#fyp #paranormal #ghost #evidence #scary #investigation #supernatural #haunted`,
        variables: ['location', 'date', 'evidenceDescription', 'evidenceStrength', 'classification'],
        hashtags: ['#fyp', '#paranormal', '#ghost', '#evidence', '#scary', '#investigation', '#supernatural', '#haunted'],
        isDefault: true
      },

      // Twitter Templates
      {
        name: 'Twitter Evidence Thread',
        platform: 'twitter',
        category: 'evidence',
        template: `🧵 THREAD: Paranormal Evidence from {location}

{evidenceDescription}

📅 {date} at {time}
📊 Evidence strength: {evidenceStrength}
🔍 Status: {verified}

Full analysis in replies ⬇️

#ParanormalEvidence #GhostHunting`,
        variables: ['location', 'evidenceDescription', 'date', 'time', 'evidenceStrength', 'verified'],
        hashtags: ['#ParanormalEvidence', '#GhostHunting', '#Paranormal', '#Evidence'],
        isDefault: true
      },

      // Facebook Templates
      {
        name: 'Facebook Investigation Report',
        platform: 'facebook',
        category: 'evidence',
        template: `PARANORMAL INVESTIGATION REPORT 📋

Location: {location}
Investigation Date: {date}
Investigator: {investigator}
Team: {team}

EVIDENCE SUMMARY:
Type: {evidenceType}
Strength: {evidenceStrength}
Description: {evidenceDescription}

ENVIRONMENTAL CONDITIONS:
Temperature: {temperature}
Weather: {weather}
Moon Phase: {moonPhase}

CONCLUSION:
Classification: {classification}
Verification Status: {verified}

Equipment Used: {equipment}

What are your thoughts on this evidence? Have you experienced similar phenomena? Share your stories in the comments!

#ParanormalInvestigation #GhostHunting #ParanormalEvidence`,
        variables: ['location', 'date', 'investigator', 'team', 'evidenceType', 'evidenceStrength', 'evidenceDescription', 'temperature', 'weather', 'moonPhase', 'classification', 'verified', 'equipment'],
        hashtags: ['#ParanormalInvestigation', '#GhostHunting', '#ParanormalEvidence', '#Supernatural'],
        isDefault: true
      },

      // Reddit Templates
      {
        name: 'Reddit Evidence Discussion',
        platform: 'reddit',
        category: 'evidence',
        template: `[Evidence] {evidenceType} captured at {location} - {classification}

**Investigation Details:**
- Location: {location} ({locationtype})
- Date/Time: {date} at {time}
- Investigator: {investigator}
- Equipment: {equipment}

**Evidence Summary:**
{evidenceDescription}

Strength: {evidenceStrength}
Verification: {verified}

**Environmental Conditions:**
- Temperature: {temperature}
- Weather: {weather}
- Moon Phase: {moonPhase}

**Analysis:**
After reviewing the evidence, I've classified this as: {classification}

What do you think? I'd love to hear your analysis and any similar experiences you might have had.

[Media files and additional details in comments]`,
        variables: ['evidenceType', 'location', 'classification', 'locationtype', 'date', 'time', 'investigator', 'equipment', 'evidenceDescription', 'evidenceStrength', 'verified', 'temperature', 'weather', 'moonPhase'],
        hashtags: [], // Reddit doesn't use hashtags
        isDefault: true
      }
    ];

    // Insert default templates
    for (const template of defaultTemplates) {
      this.createTemplate(template);
    }
  }

  private mapRowToTemplate(row: any): PostTemplate {
    return {
      id: row.id,
      name: row.name,
      platform: row.platform,
      category: row.category,
      template: row.template,
      variables: JSON.parse(row.variables),
      hashtags: JSON.parse(row.hashtags),
      isDefault: row.is_default === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private generateId(): string {
    return 'template_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

// Export singleton instance
export const postTemplateManager = PostTemplateManager.getInstance();