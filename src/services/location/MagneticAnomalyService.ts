// import Database from 'better-sqlite3'; // Temporarily disabled for basic startup
import * as fs from 'fs';
import * as path from 'path';
import { geolib } from 'geolib';

export interface MagneticAnomalyData {
  id: string;
  latitude: number;
  longitude: number;
  declination: number; // degrees, positive = east, negative = west
  inclination: number; // degrees, positive = downward
  intensity: number; // nanotesla (nT)
  horizontalIntensity: number; // nT
  verticalIntensity: number; // nT
  anomalyStrength: number; // 0-10 scale, deviation from normal
  anomalyType: 'positive' | 'negative' | 'dipolar' | 'complex';
  source: 'calculated' | 'measured' | 'interpolated' | 'igrf_model';
  confidence: number; // 0-1
  timestamp: Date;
  gridResolution: number; // meters between data points
}

export interface MagneticFieldGrid {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  resolution: number; // meters
  dataPoints: MagneticAnomalyData[];
  created: Date;
  lastUpdated: Date;
  dataSource: string;
  totalAnomalies: number;
  averageIntensity: number;
}

export interface AnomalySearchOptions {
  minAnomalyStrength?: number;
  maxDistance?: number; // kilometers
  anomalyTypes?: ('positive' | 'negative' | 'dipolar' | 'complex')[];
  includeCalculated?: boolean;
  includeMeasured?: boolean;
  limit?: number;
}

export interface LocalMagneticEnvironment {
  centerPoint: { latitude: number; longitude: number };
  radius: number; // kilometers
  averageDeclination: number;
  averageInclination: number;
  averageIntensity: number;
  anomalies: MagneticAnomalyData[];
  hotspots: Array<{
    center: { latitude: number; longitude: number };
    strength: number;
    radius: number;
    anomalyCount: number;
  }>;
  recommendations: string[];
}

export class MagneticAnomalyService {
  private db: Database.Database;
  private dbPath: string;
  private cacheDir: string;

  constructor(databasePath?: string) {
    this.dbPath = databasePath || path.join(process.cwd(), 'data', 'magnetic_anomalies.sqlite');
    this.cacheDir = path.join(process.cwd(), 'data', 'magnetic_cache');
    this.ensureDirectories();
    this.initializeDatabase();
  }

  private ensureDirectories(): void {
    [path.dirname(this.dbPath), this.cacheDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private initializeDatabase(): void {
    this.db = new Database(this.dbPath);

    // Magnetic anomaly data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS magnetic_anomalies (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        declination REAL NOT NULL,
        inclination REAL NOT NULL,
        intensity REAL NOT NULL,
        horizontal_intensity REAL NOT NULL,
        vertical_intensity REAL NOT NULL,
        anomaly_strength REAL NOT NULL,
        anomaly_type TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp TEXT NOT NULL,
        grid_resolution REAL NOT NULL
      )
    `);

    // Magnetic field grids table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS magnetic_grids (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        north_bound REAL NOT NULL,
        south_bound REAL NOT NULL,
        east_bound REAL NOT NULL,
        west_bound REAL NOT NULL,
        resolution REAL NOT NULL,
        created TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        data_source TEXT NOT NULL,
        total_anomalies INTEGER NOT NULL,
        average_intensity REAL NOT NULL
      )
    `);

    // Downloaded map tiles cache
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS map_tile_cache (
        tile_id TEXT PRIMARY KEY,
        zoom_level INTEGER NOT NULL,
        tile_x INTEGER NOT NULL,
        tile_y INTEGER NOT NULL,
        data_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        downloaded_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        file_size INTEGER NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_anomaly_location ON magnetic_anomalies (latitude, longitude)
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_anomaly_strength ON magnetic_anomalies (anomaly_strength)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_grid_bounds ON magnetic_grids (north_bound, south_bound, east_bound, west_bound)
    `);

    this.populateInitialData();
  }

  private populateInitialData(): void {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM magnetic_anomalies').get() as { count: number };
    
    if (count.count === 0) {
      console.log('Generating initial magnetic anomaly data...');
      this.generateSampleAnomalies();
    }
  }

  private generateSampleAnomalies(): void {
    // Generate sample magnetic anomaly data for various locations
    const sampleAnomalies: Omit<MagneticAnomalyData, 'id' | 'timestamp'>[] = [
      // Bermuda Triangle area
      {
        latitude: 25.0000,
        longitude: -71.0000,
        declination: -14.5,
        inclination: 57.2,
        intensity: 47800,
        horizontalIntensity: 26500,
        verticalIntensity: 40200,
        anomalyStrength: 8.5,
        anomalyType: 'complex',
        source: 'calculated',
        confidence: 0.7,
        gridResolution: 1000
      },
      // Magnetic Hill, New Brunswick
      {
        latitude: 46.1351,
        longitude: -64.7857,
        declination: -18.2,
        inclination: 70.1,
        intensity: 58200,
        horizontalIntensity: 20100,
        verticalIntensity: 54800,
        anomalyStrength: 7.2,
        anomalyType: 'positive',
        source: 'measured',
        confidence: 0.95,
        gridResolution: 500
      },
      // Marfa Lights area, Texas
      {
        latitude: 30.3077,
        longitude: -104.0173,
        declination: 8.5,
        inclination: 58.9,
        intensity: 49500,
        horizontalIntensity: 26800,
        verticalIntensity: 42100,
        anomalyStrength: 6.8,
        anomalyType: 'dipolar',
        source: 'calculated',
        confidence: 0.8,
        gridResolution: 750
      },
      // Oregon Vortex
      {
        latitude: 42.4358,
        longitude: -122.9875,
        declination: 14.8,
        inclination: 64.2,
        intensity: 52100,
        horizontalIntensity: 22300,
        verticalIntensity: 46800,
        anomalyStrength: 7.9,
        anomalyType: 'complex',
        source: 'measured',
        confidence: 0.9,
        gridResolution: 250
      },
      // Skinwalker Ranch, Utah
      {
        latitude: 40.2586,
        longitude: -109.8900,
        declination: 11.2,
        inclination: 66.8,
        intensity: 53400,
        horizontalIntensity: 21200,
        verticalIntensity: 49100,
        anomalyStrength: 8.1,
        anomalyType: 'complex',
        source: 'calculated',
        confidence: 0.75,
        gridResolution: 500
      },
      // Magnetic Island, Australia
      {
        latitude: -19.1667,
        longitude: 146.8333,
        declination: 7.8,
        inclination: -49.2,
        intensity: 55600,
        horizontalIntensity: 36200,
        verticalIntensity: -42100,
        anomalyStrength: 6.5,
        anomalyType: 'positive',
        source: 'measured',
        confidence: 0.92,
        gridResolution: 1000
      }
    ];

    const insertStmt = this.db.prepare(`
      INSERT INTO magnetic_anomalies (
        id, latitude, longitude, declination, inclination, intensity,
        horizontal_intensity, vertical_intensity, anomaly_strength,
        anomaly_type, source, confidence, timestamp, grid_resolution
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const anomaly of sampleAnomalies) {
      const id = this.generateAnomalyId(anomaly.latitude, anomaly.longitude);
      insertStmt.run([
        id,
        anomaly.latitude,
        anomaly.longitude,
        anomaly.declination,
        anomaly.inclination,
        anomaly.intensity,
        anomaly.horizontalIntensity,
        anomaly.verticalIntensity,
        anomaly.anomalyStrength,
        anomaly.anomalyType,
        anomaly.source,
        anomaly.confidence,
        new Date().toISOString(),
        anomaly.gridResolution
      ]);
    }

    console.log(`Added ${sampleAnomalies.length} sample magnetic anomalies`);
  }

  private generateAnomalyId(lat: number, lon: number): string {
    return `mag_${Math.round(lat * 10000)}_${Math.round(lon * 10000)}_${Date.now()}`;
  }

  public calculateLocalMagneticField(
    latitude: number,
    longitude: number,
    altitude = 0,
    date: Date = new Date()
  ): MagneticAnomalyData {
    // Simplified IGRF (International Geomagnetic Reference Field) calculation
    // In a real implementation, you'd use the full IGRF coefficients
    
    const year = date.getFullYear();
    const baseYear = 2020;
    const yearDiff = year - baseYear;
    
    // Convert to radians
    const latRad = latitude * Math.PI / 180;
    const lonRad = longitude * Math.PI / 180;
    
    // Simplified magnetic field calculation using dipole approximation
    const earthRadius = 6371200; // meters
    const dipoleLatitude = 80.65 * Math.PI / 180; // Magnetic north pole
    const dipoleLongitude = -72.68 * Math.PI / 180;
    
    // Calculate magnetic declination (simplified)
    let declination = Math.atan2(
      Math.sin(lonRad - dipoleLongitude),
      Math.cos(latRad) * Math.tan(dipoleLatitude) - Math.sin(latRad) * Math.cos(lonRad - dipoleLongitude)
    ) * 180 / Math.PI;
    
    // Add secular variation
    declination += yearDiff * 0.1;
    
    // Calculate magnetic inclination
    const magneticLatitude = Math.asin(
      Math.sin(dipoleLatitude) * Math.sin(latRad) +
      Math.cos(dipoleLatitude) * Math.cos(latRad) * Math.cos(lonRad - dipoleLongitude)
    );
    const inclination = Math.atan(2 * Math.tan(magneticLatitude)) * 180 / Math.PI;
    
    // Calculate total field intensity (simplified)
    const baseIntensity = 50000; // nT at equator
    const intensity = baseIntensity * Math.sqrt(1 + 3 * Math.sin(magneticLatitude) ** 2);
    
    // Calculate horizontal and vertical components
    const horizontalIntensity = intensity * Math.cos(inclination * Math.PI / 180);
    const verticalIntensity = intensity * Math.sin(inclination * Math.PI / 180);
    
    // Add altitude correction
    const altitudeCorrectedIntensity = intensity * Math.pow(earthRadius / (earthRadius + altitude), 3);
    
    return {
      id: this.generateAnomalyId(latitude, longitude),
      latitude,
      longitude,
      declination,
      inclination,
      intensity: altitudeCorrectedIntensity,
      horizontalIntensity: horizontalIntensity * Math.pow(earthRadius / (earthRadius + altitude), 3),
      verticalIntensity: verticalIntensity * Math.pow(earthRadius / (earthRadius + altitude), 3),
      anomalyStrength: 0, // Normal field, no anomaly
      anomalyType: 'positive',
      source: 'calculated',
      confidence: 0.85,
      timestamp: date,
      gridResolution: 1000
    };
  }

  public searchNearbyAnomalies(
    latitude: number,
    longitude: number,
    options: AnomalySearchOptions = {}
  ): MagneticAnomalyData[] {
    const {
      minAnomalyStrength = 0,
      maxDistance = 100, // km
      anomalyTypes = [],
      includeCalculated = true,
      includeMeasured = true,
      limit = 50
    } = options;

    let query = `
      SELECT * FROM magnetic_anomalies
      WHERE anomaly_strength >= ?
    `;
    const params: any[] = [minAnomalyStrength];

    // Filter by anomaly types
    if (anomalyTypes.length > 0) {
      query += ` AND anomaly_type IN (${anomalyTypes.map(() => '?').join(',')})`;
      params.push(...anomalyTypes);
    }

    // Filter by source type
    const sources: string[] = [];
    if (includeCalculated) sources.push('calculated');
    if (includeMeasured) sources.push('measured');
    sources.push('interpolated');

    if (sources.length > 0) {
      query += ` AND source IN (${sources.map(() => '?').join(',')})`;
      params.push(...sources);
    }

    query += `
      ORDER BY 
        ((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?))
      LIMIT ?
    `;
    params.push(latitude, latitude, longitude, longitude, limit);

    const results = this.db.prepare(query).all(params) as any[];

    // Filter by distance
    const filteredResults = results.filter(row => {
      const distance = geolib.getDistance(
        { latitude, longitude },
        { latitude: row.latitude, longitude: row.longitude }
      ) / 1000; // Convert to km
      return distance <= maxDistance;
    });

    return filteredResults.map(this.rowToAnomaly);
  }

  public getLocalMagneticEnvironment(
    centerLatitude: number,
    centerLongitude: number,
    radius = 25 // km
  ): LocalMagneticEnvironment {
    const anomalies = this.searchNearbyAnomalies(centerLatitude, centerLongitude, {
      maxDistance: radius,
      limit: 500
    });

    // Calculate averages
    const totalIntensity = anomalies.reduce((sum, a) => sum + a.intensity, 0);
    const totalDeclination = anomalies.reduce((sum, a) => sum + a.declination, 0);
    const totalInclination = anomalies.reduce((sum, a) => sum + a.inclination, 0);
    
    const averageIntensity = anomalies.length > 0 ? totalIntensity / anomalies.length : 50000;
    const averageDeclination = anomalies.length > 0 ? totalDeclination / anomalies.length : 0;
    const averageInclination = anomalies.length > 0 ? totalInclination / anomalies.length : 60;

    // Identify hotspots (clusters of high anomaly strength)
    const hotspots = this.identifyMagneticHotspots(anomalies, radius / 4);

    // Generate recommendations
    const recommendations = this.generateMagneticRecommendations(anomalies, hotspots, averageIntensity);

    return {
      centerPoint: { latitude: centerLatitude, longitude: centerLongitude },
      radius,
      averageDeclination,
      averageInclination,
      averageIntensity,
      anomalies,
      hotspots,
      recommendations
    };
  }

  private identifyMagneticHotspots(
    anomalies: MagneticAnomalyData[],
    clusterRadius: number // km
  ): Array<{
    center: { latitude: number; longitude: number };
    strength: number;
    radius: number;
    anomalyCount: number;
  }> {
    const hotspots: Array<{
      center: { latitude: number; longitude: number };
      strength: number;
      radius: number;
      anomalyCount: number;
    }> = [];

    // Find clusters of strong anomalies
    const strongAnomalies = anomalies.filter(a => a.anomalyStrength >= 6.0);
    const processed = new Set<string>();

    for (const anomaly of strongAnomalies) {
      if (processed.has(anomaly.id)) continue;

      const cluster = [anomaly];
      processed.add(anomaly.id);

      // Find nearby strong anomalies
      for (const other of strongAnomalies) {
        if (processed.has(other.id)) continue;

        const distance = geolib.getDistance(
          { latitude: anomaly.latitude, longitude: anomaly.longitude },
          { latitude: other.latitude, longitude: other.longitude }
        ) / 1000; // km

        if (distance <= clusterRadius) {
          cluster.push(other);
          processed.add(other.id);
        }
      }

      // Only consider clusters with multiple anomalies
      if (cluster.length >= 2) {
        const centerLat = cluster.reduce((sum, a) => sum + a.latitude, 0) / cluster.length;
        const centerLon = cluster.reduce((sum, a) => sum + a.longitude, 0) / cluster.length;
        const avgStrength = cluster.reduce((sum, a) => sum + a.anomalyStrength, 0) / cluster.length;

        hotspots.push({
          center: { latitude: centerLat, longitude: centerLon },
          strength: avgStrength,
          radius: clusterRadius,
          anomalyCount: cluster.length
        });
      }
    }

    return hotspots.sort((a, b) => b.strength - a.strength);
  }

  private generateMagneticRecommendations(
    anomalies: MagneticAnomalyData[],
    hotspots: Array<{
      center: { latitude: number; longitude: number };
      strength: number;
      radius: number;
      anomalyCount: number;
    }>,
    averageIntensity: number
  ): string[] {
    const recommendations: string[] = [];

    // Hotspot recommendations
    if (hotspots.length > 0) {
      recommendations.push(`${hotspots.length} magnetic hotspot(s) detected - investigate these areas first`);
      
      const strongestHotspot = hotspots[0];
      if (strongestHotspot.strength >= 8.0) {
        recommendations.push('Extremely strong magnetic anomaly detected - use sensitive equipment');
      } else if (strongestHotspot.strength >= 6.5) {
        recommendations.push('Strong magnetic anomaly area - good for EMF investigations');
      }
    }

    // Anomaly distribution recommendations
    const strongAnomalies = anomalies.filter(a => a.anomalyStrength >= 6.0);
    if (strongAnomalies.length > 5) {
      recommendations.push('High magnetic activity in area - excellent for electromagnetic investigations');
    } else if (strongAnomalies.length > 0) {
      recommendations.push('Moderate magnetic activity detected - suitable for sensitive equipment');
    } else {
      recommendations.push('Low magnetic activity - may need highly sensitive equipment');
    }

    // Equipment recommendations based on field strength
    if (averageIntensity > 60000) {
      recommendations.push('High magnetic field strength - use lower sensitivity EMF settings');
    } else if (averageIntensity < 40000) {
      recommendations.push('Low magnetic field strength - increase EMF detector sensitivity');
    }

    // Complex anomaly recommendations
    const complexAnomalies = anomalies.filter(a => a.anomalyType === 'complex');
    if (complexAnomalies.length > 0) {
      recommendations.push('Complex magnetic patterns detected - may indicate geological or artificial interference');
    }

    return recommendations;
  }

  public addMeasuredAnomaly(
    latitude: number,
    longitude: number,
    measurements: {
      declination: number;
      inclination: number;
      intensity: number;
    },
    metadata: {
      equipment?: string;
      conditions?: string;
      confidence: number;
    }
  ): string {
    const calculatedField = this.calculateLocalMagneticField(latitude, longitude);
    
    // Calculate anomaly strength based on deviation from calculated field
    const intensityDeviation = Math.abs(measurements.intensity - calculatedField.intensity);
    const anomalyStrength = Math.min(10, (intensityDeviation / calculatedField.intensity) * 50);
    
    // Determine anomaly type
    let anomalyType: MagneticAnomalyData['anomalyType'] = 'positive';
    if (measurements.intensity < calculatedField.intensity * 0.9) {
      anomalyType = 'negative';
    } else if (Math.abs(measurements.declination - calculatedField.declination) > 10) {
      anomalyType = 'complex';
    } else if (intensityDeviation > calculatedField.intensity * 0.2) {
      anomalyType = 'dipolar';
    }

    const horizontalIntensity = measurements.intensity * Math.cos(measurements.inclination * Math.PI / 180);
    const verticalIntensity = measurements.intensity * Math.sin(measurements.inclination * Math.PI / 180);

    const id = this.generateAnomalyId(latitude, longitude);
    
    const insertStmt = this.db.prepare(`
      INSERT INTO magnetic_anomalies (
        id, latitude, longitude, declination, inclination, intensity,
        horizontal_intensity, vertical_intensity, anomaly_strength,
        anomaly_type, source, confidence, timestamp, grid_resolution
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run([
      id,
      latitude,
      longitude,
      measurements.declination,
      measurements.inclination,
      measurements.intensity,
      horizontalIntensity,
      verticalIntensity,
      anomalyStrength,
      anomalyType,
      'measured',
      metadata.confidence,
      new Date().toISOString(),
      10 // High resolution for measured data
    ]);

    return id;
  }

  public cacheMapTile(
    zoom: number,
    tileX: number,
    tileY: number,
    dataType: 'declination' | 'inclination' | 'intensity' | 'anomaly',
    tileData: Buffer,
    expirationDays = 30
  ): string {
    const tileId = `${dataType}_${zoom}_${tileX}_${tileY}`;
    const fileName = `${tileId}.png`;
    const filePath = path.join(this.cacheDir, fileName);

    // Save tile data to file
    fs.writeFileSync(filePath, tileData);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // Store in database
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO map_tile_cache (
        tile_id, zoom_level, tile_x, tile_y, data_type,
        file_path, downloaded_at, expires_at, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run([
      tileId,
      zoom,
      tileX,
      tileY,
      dataType,
      filePath,
      new Date().toISOString(),
      expiresAt.toISOString(),
      tileData.length
    ]);

    return filePath;
  }

  public getCachedMapTile(
    zoom: number,
    tileX: number,
    tileY: number,
    dataType: 'declination' | 'inclination' | 'intensity' | 'anomaly'
  ): Buffer | null {
    const tileId = `${dataType}_${zoom}_${tileX}_${tileY}`;
    
    const tileInfo = this.db.prepare(`
      SELECT file_path, expires_at FROM map_tile_cache 
      WHERE tile_id = ? AND expires_at > ?
    `).get([tileId, new Date().toISOString()]) as { file_path: string; expires_at: string } | undefined;

    if (!tileInfo || !fs.existsSync(tileInfo.file_path)) {
      return null;
    }

    return fs.readFileSync(tileInfo.file_path);
  }

  public cleanExpiredCache(): number {
    // Get expired entries
    const expiredTiles = this.db.prepare(`
      SELECT file_path FROM map_tile_cache WHERE expires_at <= ?
    `).all([new Date().toISOString()]) as { file_path: string }[];

    // Delete files
    let deletedCount = 0;
    for (const tile of expiredTiles) {
      try {
        if (fs.existsSync(tile.file_path)) {
          fs.unlinkSync(tile.file_path);
        }
        deletedCount++;
      } catch (error) {
        console.error('Failed to delete cached tile:', tile.file_path, error);
      }
    }

    // Remove from database
    this.db.prepare('DELETE FROM map_tile_cache WHERE expires_at <= ?')
        .run([new Date().toISOString()]);

    return deletedCount;
  }

  public getCacheStatistics(): {
    totalTiles: number;
    totalSizeMB: number;
    tilesByType: Record<string, number>;
    oldestTile: Date | null;
    newestTile: Date | null;
  } {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_tiles,
        SUM(file_size) as total_size,
        MIN(downloaded_at) as oldest,
        MAX(downloaded_at) as newest
      FROM map_tile_cache
    `).get() as any;

    const byType = this.db.prepare(`
      SELECT data_type, COUNT(*) as count 
      FROM map_tile_cache 
      GROUP BY data_type
    `).all() as { data_type: string; count: number }[];

    return {
      totalTiles: stats.total_tiles || 0,
      totalSizeMB: Math.round((stats.total_size || 0) / (1024 * 1024) * 100) / 100,
      tilesByType: byType.reduce((acc, item) => ({ ...acc, [item.data_type]: item.count }), {}),
      oldestTile: stats.oldest ? new Date(stats.oldest) : null,
      newestTile: stats.newest ? new Date(stats.newest) : null
    };
  }

  private rowToAnomaly(row: any): MagneticAnomalyData {
    return {
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      declination: row.declination,
      inclination: row.inclination,
      intensity: row.intensity,
      horizontalIntensity: row.horizontal_intensity,
      verticalIntensity: row.vertical_intensity,
      anomalyStrength: row.anomaly_strength,
      anomalyType: row.anomaly_type,
      source: row.source,
      confidence: row.confidence,
      timestamp: new Date(row.timestamp),
      gridResolution: row.grid_resolution
    };
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Factory function
export function createMagneticAnomalyService(databasePath?: string): MagneticAnomalyService {
  return new MagneticAnomalyService(databasePath);
}