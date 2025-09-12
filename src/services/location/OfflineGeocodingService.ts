import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { geolib } from 'geolib';
import NodeGeocoder from 'node-geocoder';
import { OpenCageApiClient } from 'opencage-api-client';

export interface GeocodedLocation {
  id: string;
  name: string;
  type: 'cemetery' | 'historical_site' | 'church' | 'hospital' | 'prison' | 'battlefield' | 'residence' | 'other';
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  elevation?: number;
  description?: string;
  yearEstablished?: number;
  yearClosed?: number;
  paranormalRating?: number; // 0-10 scale
  investigationHistory?: string;
  lastUpdated: Date;
  source: 'manual' | 'imported' | 'opencage' | 'nominatim';
}

export interface LocationSearchOptions {
  types?: ('cemetery' | 'historical_site' | 'church' | 'hospital' | 'prison' | 'battlefield' | 'residence' | 'other')[];
  radius?: number; // kilometers
  limit?: number;
  includeParanormalRating?: boolean;
  minParanormalRating?: number;
}

export interface LocationImportData {
  locations: Omit<GeocodedLocation, 'id' | 'lastUpdated' | 'source'>[];
}

export class OfflineGeocodingService {
  private db: Database.Database;
  private dbPath: string;
  private onlineGeocoder: NodeGeocoder.Geocoder;
  private openCageClient: OpenCageApiClient | null = null;

  constructor(databasePath?: string) {
    this.dbPath = databasePath || path.join(process.cwd(), 'data', 'geocoding.sqlite');
    this.ensureDatabaseDirectory();
    this.initializeDatabase();
    
    // Initialize online geocoder for fallback (when internet is available)
    this.onlineGeocoder = NodeGeocoder({
      provider: 'nominatim',
      httpAdapter: 'https',
      apiKey: undefined,
      formatter: null
    });
  }

  private ensureDatabaseDirectory(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initializeDatabase(): void {
    this.db = new Database(this.dbPath);
    
    // Create locations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        country TEXT NOT NULL,
        postal_code TEXT,
        elevation REAL,
        description TEXT,
        year_established INTEGER,
        year_closed INTEGER,
        paranormal_rating REAL,
        investigation_history TEXT,
        last_updated TEXT NOT NULL,
        source TEXT NOT NULL
      )
    `);

    // Create spatial index for location searches
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_location_coords ON locations (latitude, longitude)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_location_type ON locations (type)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_paranormal_rating ON locations (paranormal_rating)
    `);

    // Create cache table for online geocoding results
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS geocoding_cache (
        query_hash TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `);

    this.populateInitialData();
  }

  private populateInitialData(): void {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number };
    
    if (count.count === 0) {
      console.log('Populating initial location database with sample data...');
      this.addSampleLocations();
    }
  }

  private addSampleLocations(): void {
    const sampleLocations: Omit<GeocodedLocation, 'id' | 'lastUpdated' | 'source'>[] = [
      // Famous Haunted Cemeteries
      {
        name: 'Père Lachaise Cemetery',
        type: 'cemetery',
        latitude: 48.8616,
        longitude: 2.3933,
        address: '16 Rue du Repos',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        postalCode: '75020',
        description: 'Famous cemetery with numerous celebrity graves and reported paranormal activity',
        yearEstablished: 1804,
        paranormalRating: 8.5,
        investigationHistory: 'Multiple investigations documented supernatural voices and apparitions'
      },
      {
        name: 'Greyfriars Kirkyard',
        type: 'cemetery',
        latitude: 55.9467,
        longitude: -3.1925,
        address: 'Greyfriars Place',
        city: 'Edinburgh',
        state: 'Scotland',
        country: 'United Kingdom',
        description: 'Historic cemetery famous for the MacKenzie Poltergeist',
        yearEstablished: 1562,
        paranormalRating: 9.2,
        investigationHistory: 'Over 450 documented attacks by the MacKenzie Poltergeist'
      },
      {
        name: 'Bonaventure Cemetery',
        type: 'cemetery',
        latitude: 32.0683,
        longitude: -81.0342,
        address: '330 Bonaventure Rd',
        city: 'Savannah',
        state: 'Georgia',
        country: 'United States',
        postalCode: '31404',
        description: 'Victorian cemetery with Spanish moss and reported apparitions',
        yearEstablished: 1846,
        paranormalRating: 7.8,
        investigationHistory: 'Featured in Midnight in the Garden of Good and Evil, numerous ghost tours'
      },
      
      // Historic Sites
      {
        name: 'Tower of London',
        type: 'historical_site',
        latitude: 51.5081,
        longitude: -0.0759,
        address: 'St Katharine\'s & Wapping',
        city: 'London',
        state: 'England',
        country: 'United Kingdom',
        postalCode: 'EC3N 4AB',
        description: 'Historic castle with numerous executions and ghostly sightings',
        yearEstablished: 1066,
        paranormalRating: 9.5,
        investigationHistory: 'Anne Boleyn, Lady Jane Grey, and other historical figures reportedly seen'
      },
      {
        name: 'Eastern State Penitentiary',
        type: 'prison',
        latitude: 39.9686,
        longitude: -75.1717,
        address: '2027 Fairmount Ave',
        city: 'Philadelphia',
        state: 'Pennsylvania',
        country: 'United States',
        postalCode: '19130',
        description: 'Abandoned prison known for its harsh conditions and paranormal activity',
        yearEstablished: 1829,
        yearClosed: 1971,
        paranormalRating: 8.9,
        investigationHistory: 'Shadow figures, disembodied voices, and cell door slams reported'
      },

      // Hospitals
      {
        name: 'Waverly Hills Sanatorium',
        type: 'hospital',
        latitude: 38.1531,
        longitude: -85.6624,
        address: '4400 Paralee Dr',
        city: 'Louisville',
        state: 'Kentucky',
        country: 'United States',
        postalCode: '40272',
        description: 'Former tuberculosis hospital with extensive paranormal activity',
        yearEstablished: 1910,
        yearClosed: 1961,
        paranormalRating: 9.7,
        investigationHistory: 'Death tunnel, room 502, and numerous documented investigations'
      },
      
      // Churches
      {
        name: 'St. Bartholomew\'s Church',
        type: 'church',
        latitude: 53.0293,
        longitude: -2.1788,
        address: 'Church Lane',
        city: 'Church Lawton',
        state: 'Cheshire',
        country: 'United Kingdom',
        description: 'Medieval church with reported phantom organist',
        yearEstablished: 1343,
        paranormalRating: 6.5,
        investigationHistory: 'Organ music heard when no one is present, cold spots documented'
      },

      // Battlefields
      {
        name: 'Gettysburg Battlefield',
        type: 'battlefield',
        latitude: 39.8111,
        longitude: -77.2306,
        address: '1195 Baltimore Pike',
        city: 'Gettysburg',
        state: 'Pennsylvania',
        country: 'United States',
        postalCode: '17325',
        description: 'Civil War battlefield with numerous reported apparitions',
        yearEstablished: 1863,
        paranormalRating: 8.3,
        investigationHistory: 'Soldier apparitions, cannon sounds, and phantom horses reported'
      }
    ];

    const insertStmt = this.db.prepare(`
      INSERT INTO locations (
        id, name, type, latitude, longitude, address, city, state, country,
        postal_code, elevation, description, year_established, year_closed,
        paranormal_rating, investigation_history, last_updated, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const location of sampleLocations) {
      const id = this.generateLocationId(location.name, location.latitude, location.longitude);
      insertStmt.run([
        id,
        location.name,
        location.type,
        location.latitude,
        location.longitude,
        location.address,
        location.city,
        location.state,
        location.country,
        location.postalCode || null,
        location.elevation || null,
        location.description || null,
        location.yearEstablished || null,
        location.yearClosed || null,
        location.paranormalRating || null,
        location.investigationHistory || null,
        new Date().toISOString(),
        'manual'
      ]);
    }

    console.log(`Added ${sampleLocations.length} sample locations to database`);
  }

  private generateLocationId(name: string, lat: number, lon: number): string {
    return `loc_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.round(lat * 10000)}_${Math.round(lon * 10000)}`;
  }

  public async searchNearbyLocations(
    latitude: number,
    longitude: number,
    options: LocationSearchOptions = {}
  ): Promise<GeocodedLocation[]> {
    const {
      types = [],
      radius = 50, // 50km default
      limit = 100,
      includeParanormalRating = false,
      minParanormalRating = 0
    } = options;

    let query = `
      SELECT * FROM locations
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by types
    if (types.length > 0) {
      query += ` AND type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }

    // Filter by minimum paranormal rating
    if (includeParanormalRating && minParanormalRating > 0) {
      query += ` AND paranormal_rating >= ?`;
      params.push(minParanormalRating);
    }

    query += ` ORDER BY 
      ((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?))
      LIMIT ?
    `;
    params.push(latitude, latitude, longitude, longitude, limit);

    const results = this.db.prepare(query).all(params) as any[];

    // Filter by radius using geolib for accurate distance calculation
    const filteredResults = results.filter(row => {
      const distance = geolib.getDistance(
        { latitude, longitude },
        { latitude: row.latitude, longitude: row.longitude }
      ) / 1000; // Convert to kilometers
      return distance <= radius;
    });

    // Convert to GeocodedLocation objects
    return filteredResults.map(this.rowToLocation);
  }

  public searchLocationsByName(query: string, limit = 50): GeocodedLocation[] {
    const searchQuery = `
      SELECT * FROM locations
      WHERE name LIKE ? OR address LIKE ? OR description LIKE ?
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN address LIKE ? THEN 2
          ELSE 3
        END,
        paranormal_rating DESC
      LIMIT ?
    `;

    const searchPattern = `%${query}%`;
    const exactPattern = `${query}%`;

    const results = this.db.prepare(searchQuery).all([
      searchPattern, searchPattern, searchPattern,
      exactPattern, exactPattern,
      limit
    ]) as any[];

    return results.map(this.rowToLocation);
  }

  public getLocationById(id: string): GeocodedLocation | null {
    const result = this.db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as any;
    return result ? this.rowToLocation(result) : null;
  }

  public addLocation(location: Omit<GeocodedLocation, 'id' | 'lastUpdated' | 'source'>): string {
    const id = this.generateLocationId(location.name, location.latitude, location.longitude);
    
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO locations (
        id, name, type, latitude, longitude, address, city, state, country,
        postal_code, elevation, description, year_established, year_closed,
        paranormal_rating, investigation_history, last_updated, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run([
      id,
      location.name,
      location.type,
      location.latitude,
      location.longitude,
      location.address,
      location.city,
      location.state,
      location.country,
      location.postalCode || null,
      location.elevation || null,
      location.description || null,
      location.yearEstablished || null,
      location.yearClosed || null,
      location.paranormalRating || null,
      location.investigationHistory || null,
      new Date().toISOString(),
      'manual'
    ]);

    return id;
  }

  public updateLocation(id: string, updates: Partial<GeocodedLocation>): boolean {
    const existingLocation = this.getLocationById(id);
    if (!existingLocation) {
      return false;
    }

    const updateFields: string[] = [];
    const params: any[] = [];

    // Build dynamic UPDATE query
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'lastUpdated' && key !== 'source') {
        const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbColumn} = ?`);
        params.push((updates as any)[key]);
      }
    });

    if (updateFields.length === 0) {
      return false;
    }

    updateFields.push('last_updated = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const updateQuery = `
      UPDATE locations 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    const result = this.db.prepare(updateQuery).run(params);
    return result.changes > 0;
  }

  public deleteLocation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    return result.changes > 0;
  }

  public async onlineGeocode(query: string, useCache = true): Promise<GeocodedLocation[]> {
    const queryHash = this.hashString(query);
    
    // Check cache first
    if (useCache) {
      const cached = this.getCachedGeocoding(queryHash);
      if (cached) {
        return JSON.parse(cached.result);
      }
    }

    try {
      // Try OpenCage first (if API key available), then fallback to Nominatim
      let results: any[] = [];
      
      if (this.openCageClient) {
        const response = await this.openCageClient.geocode({ q: query });
        results = response.results || [];
      } else {
        results = await this.onlineGeocoder.geocode(query);
      }

      // Convert to GeocodedLocation format
      const locations: GeocodedLocation[] = results.slice(0, 10).map((result, index) => {
        const location: GeocodedLocation = {
          id: this.generateLocationId(`online_${index}`, result.latitude, result.longitude),
          name: result.formattedAddress || result.address || query,
          type: this.inferLocationType(result.formattedAddress || result.address || ''),
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.formattedAddress || result.address || '',
          city: result.city || result.administrativeLevels?.level2long || '',
          state: result.administrativeLevels?.level1long || result.state || '',
          country: result.country || result.countryCode || '',
          postalCode: result.zipcode || result.postcode,
          lastUpdated: new Date(),
          source: 'opencage'
        };
        return location;
      });

      // Cache the results
      if (useCache) {
        this.cacheGeocodingResult(queryHash, query, JSON.stringify(locations));
      }

      return locations;
    } catch (error) {
      console.error('Online geocoding failed:', error);
      return [];
    }
  }

  private inferLocationType(address: string): GeocodedLocation['type'] {
    const addressLower = address.toLowerCase();
    
    if (addressLower.includes('cemetery') || addressLower.includes('graveyard')) return 'cemetery';
    if (addressLower.includes('church') || addressLower.includes('cathedral')) return 'church';
    if (addressLower.includes('hospital') || addressLower.includes('medical')) return 'hospital';
    if (addressLower.includes('prison') || addressLower.includes('jail')) return 'prison';
    if (addressLower.includes('battlefield') || addressLower.includes('memorial')) return 'battlefield';
    if (addressLower.includes('historic') || addressLower.includes('museum')) return 'historical_site';
    
    return 'other';
  }

  private getCachedGeocoding(queryHash: string): { result: string } | null {
    const result = this.db.prepare(`
      SELECT result FROM geocoding_cache 
      WHERE query_hash = ? AND expires_at > ?
    `).get([queryHash, new Date().toISOString()]) as { result: string } | undefined;
    
    return result || null;
  }

  private cacheGeocodingResult(queryHash: string, query: string, result: string): void {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Cache for 30 days

    this.db.prepare(`
      INSERT OR REPLACE INTO geocoding_cache 
      (query_hash, query, result, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run([
      queryHash,
      query,
      result,
      new Date().toISOString(),
      expiresAt.toISOString()
    ]);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  public importLocations(data: LocationImportData): number {
    let imported = 0;
    
    for (const location of data.locations) {
      try {
        this.addLocation(location);
        imported++;
      } catch (error) {
        console.error(`Failed to import location: ${location.name}`, error);
      }
    }
    
    return imported;
  }

  public exportLocations(filters?: LocationSearchOptions): LocationImportData {
    let query = 'SELECT * FROM locations WHERE 1=1';
    const params: any[] = [];

    if (filters?.types && filters.types.length > 0) {
      query += ` AND type IN (${filters.types.map(() => '?').join(',')})`;
      params.push(...filters.types);
    }

    if (filters?.minParanormalRating) {
      query += ' AND paranormal_rating >= ?';
      params.push(filters.minParanormalRating);
    }

    if (filters?.limit) {
      query += ' ORDER BY paranormal_rating DESC LIMIT ?';
      params.push(filters.limit);
    }

    const results = this.db.prepare(query).all(params) as any[];
    const locations = results.map(this.rowToLocation).map(loc => {
      // Remove id, lastUpdated, and source for export
      const { id, lastUpdated, source, ...exportLoc } = loc;
      return exportLoc;
    });

    return { locations };
  }

  public getStatistics(): {
    totalLocations: number;
    locationsByType: Record<string, number>;
    averageParanormalRating: number;
    locationsByCountry: Record<string, number>;
  } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number };
    
    const byType = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM locations 
      GROUP BY type 
      ORDER BY count DESC
    `).all() as { type: string; count: number }[];

    const avgRating = this.db.prepare(`
      SELECT AVG(paranormal_rating) as avg 
      FROM locations 
      WHERE paranormal_rating IS NOT NULL
    `).get() as { avg: number };

    const byCountry = this.db.prepare(`
      SELECT country, COUNT(*) as count 
      FROM locations 
      GROUP BY country 
      ORDER BY count DESC
    `).all() as { country: string; count: number }[];

    return {
      totalLocations: total.count,
      locationsByType: byType.reduce((acc, item) => ({ ...acc, [item.type]: item.count }), {}),
      averageParanormalRating: avgRating.avg || 0,
      locationsByCountry: byCountry.reduce((acc, item) => ({ ...acc, [item.country]: item.count }), {})
    };
  }

  private rowToLocation(row: any): GeocodedLocation {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
      elevation: row.elevation,
      description: row.description,
      yearEstablished: row.year_established,
      yearClosed: row.year_closed,
      paranormalRating: row.paranormal_rating,
      investigationHistory: row.investigation_history,
      lastUpdated: new Date(row.last_updated),
      source: row.source as 'manual' | 'imported' | 'opencage' | 'nominatim'
    };
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Factory function
export function createOfflineGeocodingService(databasePath?: string): OfflineGeocodingService {
  return new OfflineGeocodingService(databasePath);
}