import { AstronomicalCalculations } from './AstronomicalCalculations';

export interface GeomagneticReading {
  timestamp: Date;
  kIndex: number; // 0-9 scale
  confidence: number; // 0-1 reliability of estimate
  stormLevel: 'quiet' | 'unsettled' | 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme';
  source: 'estimated' | 'historical_pattern' | 'solar_cycle' | 'combined';
}

export interface SolarCycleData {
  cycleNumber: number; // Solar cycle number (24, 25, etc.)
  cycleDay: number; // Day within current 11-year cycle
  cyclePhase: 'minimum' | 'ascending' | 'maximum' | 'descending';
  solarActivity: number; // 0-1 estimated solar activity level
  sunspotNumber: number; // Estimated sunspot number
}

export interface GeomagneticForecast {
  next24Hours: GeomagneticReading[];
  next7Days: GeomagneticReading[];
  stormProbability: number; // 0-1 probability of geomagnetic storm
  recommendations: string[];
}

export interface ParanormalGeomagneticInfluence {
  electromagneticSensitivity: number; // 0-1 how sensitive equipment might be
  anomalyProbability: number; // 0-1 likelihood of electromagnetic anomalies
  investigationOptimal: boolean; // Is this a good time for investigation?
  recommendations: string[];
  equipmentAdjustments: string[];
}

export interface HistoricalKIndexPattern {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  month: number;
  dayOfYear: number;
  averageKIndex: number;
  variance: number;
  stormProbability: number;
}

export class GeomagneticActivityEstimator {
  private location: { latitude: number; longitude: number; elevation?: number };
  private currentReading: GeomagneticReading | null = null;
  private readingHistory: GeomagneticReading[] = [];
  private astronomicalCalc: AstronomicalCalculations;
  
  // Historical patterns based on typical geomagnetic activity
  private readonly HISTORICAL_PATTERNS: HistoricalKIndexPattern[] = [
    // Spring equinox effects (higher activity)
    { season: 'spring', month: 3, dayOfYear: 80, averageKIndex: 3.2, variance: 1.8, stormProbability: 0.15 },
    { season: 'spring', month: 4, dayOfYear: 110, averageKIndex: 2.8, variance: 1.5, stormProbability: 0.12 },
    { season: 'spring', month: 5, dayOfYear: 140, averageKIndex: 2.5, variance: 1.3, stormProbability: 0.10 },
    
    // Summer (generally lower activity)
    { season: 'summer', month: 6, dayOfYear: 170, averageKIndex: 2.0, variance: 1.0, stormProbability: 0.08 },
    { season: 'summer', month: 7, dayOfYear: 200, averageKIndex: 1.8, variance: 0.9, stormProbability: 0.06 },
    { season: 'summer', month: 8, dayOfYear: 230, averageKIndex: 2.1, variance: 1.1, stormProbability: 0.09 },
    
    // Autumn equinox effects (higher activity)
    { season: 'autumn', month: 9, dayOfYear: 260, averageKIndex: 3.0, variance: 1.7, stormProbability: 0.14 },
    { season: 'autumn', month: 10, dayOfYear: 290, averageKIndex: 2.9, variance: 1.6, stormProbability: 0.13 },
    { season: 'autumn', month: 11, dayOfYear: 320, averageKIndex: 2.6, variance: 1.4, stormProbability: 0.11 },
    
    // Winter (moderate activity)
    { season: 'winter', month: 12, dayOfYear: 350, averageKIndex: 2.3, variance: 1.2, stormProbability: 0.09 },
    { season: 'winter', month: 1, dayOfYear: 20, averageKIndex: 2.4, variance: 1.2, stormProbability: 0.10 },
    { season: 'winter', month: 2, dayOfYear: 50, averageKIndex: 2.7, variance: 1.4, stormProbability: 0.12 }
  ];

  constructor(
    location: { latitude: number; longitude: number; elevation?: number },
    currentTime?: Date
  ) {
    this.location = location;
    this.astronomicalCalc = new AstronomicalCalculations(location, currentTime);
  }

  public setLocation(location: { latitude: number; longitude: number; elevation?: number }): void {
    this.location = location;
    this.astronomicalCalc.setLocation(location);
  }

  public getCurrentSolarCycle(date: Date = new Date()): SolarCycleData {
    // Solar Cycle 25 began in December 2019
    const cycle25Start = new Date('2019-12-01');
    const solarCycleLength = 11 * 365.25 * 24 * 60 * 60 * 1000; // 11 years in milliseconds
    
    const timeSinceCycle25 = date.getTime() - cycle25Start.getTime();
    const cycleDay = Math.floor(timeSinceCycle25 / (24 * 60 * 60 * 1000));
    const cycleProgress = (timeSinceCycle25 / solarCycleLength);
    
    let phase: 'minimum' | 'ascending' | 'maximum' | 'descending';
    let solarActivity: number;
    let sunspotNumber: number;
    
    if (cycleProgress < 0.15) {
      phase = 'minimum';
      solarActivity = 0.1 + Math.random() * 0.2;
      sunspotNumber = Math.floor(Math.random() * 20);
    } else if (cycleProgress < 0.4) {
      phase = 'ascending';
      solarActivity = 0.3 + (cycleProgress - 0.15) * 2.8; // Ramp up
      sunspotNumber = Math.floor(30 + (cycleProgress - 0.15) * 300);
    } else if (cycleProgress < 0.6) {
      phase = 'maximum';
      solarActivity = 0.7 + Math.random() * 0.3;
      sunspotNumber = Math.floor(100 + Math.random() * 100);
    } else {
      phase = 'descending';
      solarActivity = 0.8 - (cycleProgress - 0.6) * 2.0; // Ramp down
      sunspotNumber = Math.floor(120 - (cycleProgress - 0.6) * 100);
    }

    return {
      cycleNumber: 25,
      cycleDay,
      cyclePhase: phase,
      solarActivity: Math.max(0.1, Math.min(1.0, solarActivity)),
      sunspotNumber: Math.max(0, sunspotNumber)
    };
  }

  public estimateKIndex(date: Date = new Date()): GeomagneticReading {
    const solarCycle = this.getCurrentSolarCycle(date);
    const historicalPattern = this.getHistoricalPattern(date);
    const astronomicalInfluence = this.getAstronomicalInfluence(date);
    
    // Base K-index from historical pattern
    let estimatedKIndex = historicalPattern.averageKIndex;
    
    // Adjust for solar cycle
    const solarCycleMultiplier = solarCycle.solarActivity * 1.5;
    estimatedKIndex *= (0.5 + solarCycleMultiplier);
    
    // Adjust for astronomical influences (moon phase, planetary alignment)
    estimatedKIndex += astronomicalInfluence * 0.8;
    
    // Add some random variation based on historical variance
    const randomVariation = (Math.random() - 0.5) * historicalPattern.variance;
    estimatedKIndex += randomVariation;
    
    // Clamp to valid K-index range (0-9)
    estimatedKIndex = Math.max(0, Math.min(9, estimatedKIndex));
    
    // Determine storm level
    const stormLevel = this.getStormLevel(estimatedKIndex);
    
    // Calculate confidence based on multiple factors
    const confidence = this.calculateConfidence(solarCycle, historicalPattern, date);
    
    const reading: GeomagneticReading = {
      timestamp: date,
      kIndex: Math.round(estimatedKIndex * 10) / 10, // Round to 1 decimal
      confidence,
      stormLevel,
      source: 'combined'
    };
    
    this.currentReading = reading;
    this.readingHistory.push(reading);
    
    // Keep history manageable
    if (this.readingHistory.length > 1000) {
      this.readingHistory = this.readingHistory.slice(-500);
    }
    
    return reading;
  }

  private getHistoricalPattern(date: Date): HistoricalKIndexPattern {
    const dayOfYear = this.getDayOfYear(date);
    const month = date.getMonth() + 1;
    
    // Find closest historical pattern
    let closestPattern = this.HISTORICAL_PATTERNS[0];
    let smallestDiff = Math.abs(closestPattern.dayOfYear - dayOfYear);
    
    for (const pattern of this.HISTORICAL_PATTERNS) {
      const diff = Math.abs(pattern.dayOfYear - dayOfYear);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestPattern = pattern;
      }
    }
    
    return closestPattern;
  }

  private getAstronomicalInfluence(date: Date): number {
    try {
      const moonData = this.astronomicalCalc.getMoonPhaseData();
      const solarData = this.astronomicalCalc.getSolarData();
      
      let influence = 0;
      
      // New moon and full moon can increase geomagnetic activity
      if (moonData.phase === 'New' || moonData.phase === 'Full') {
        influence += 0.3;
      }
      
      // Solar activity correlation (twilight periods)
      if (solarData.twilight.nautical.start || solarData.twilight.nautical.end) {
        influence += 0.2;
      }
      
      // Moon proximity effect
      if (moonData.distance < 370000) { // Close to Earth
        influence += 0.2;
      }
      
      return Math.max(0, Math.min(1, influence));
    } catch (error) {
      console.warn('Failed to calculate astronomical influence:', error);
      return 0.1; // Default minimal influence
    }
  }

  private getStormLevel(kIndex: number): 'quiet' | 'unsettled' | 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme' {
    if (kIndex < 1) return 'quiet';
    if (kIndex < 2) return 'quiet';
    if (kIndex < 3) return 'unsettled';
    if (kIndex < 4) return 'unsettled';
    if (kIndex < 5) return 'minor';
    if (kIndex < 6) return 'moderate';
    if (kIndex < 7) return 'strong';
    if (kIndex < 8) return 'severe';
    return 'extreme';
  }

  private calculateConfidence(solarCycle: SolarCycleData, pattern: HistoricalKIndexPattern, date: Date): number {
    let confidence = 0.6; // Base confidence
    
    // Higher confidence during known solar cycle phases
    if (solarCycle.cyclePhase === 'maximum' || solarCycle.cyclePhase === 'minimum') {
      confidence += 0.2;
    }
    
    // Lower confidence for high variance historical patterns
    confidence -= pattern.variance * 0.1;
    
    // Recent data is more reliable
    const hoursOld = (new Date().getTime() - date.getTime()) / (1000 * 60 * 60);
    if (hoursOld < 24) {
      confidence += 0.1;
    } else if (hoursOld > 168) { // 1 week
      confidence -= 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  public generateForecast(hoursAhead: number = 168): GeomagneticForecast { // Default 7 days
    const forecasts: GeomagneticReading[] = [];
    const now = new Date();
    
    for (let hour = 1; hour <= hoursAhead; hour++) {
      const forecastTime = new Date(now.getTime() + hour * 60 * 60 * 1000);
      const reading = this.estimateKIndex(forecastTime);
      reading.source = 'estimated';
      reading.confidence *= 0.9 ** (hour / 24); // Confidence decreases over time
      forecasts.push(reading);
    }
    
    const next24Hours = forecasts.slice(0, 24);
    const next7Days = forecasts.filter((_, index) => index % 24 === 0).slice(0, 7);
    
    // Calculate storm probability
    const stormCount = forecasts.filter(reading => 
      reading.stormLevel === 'moderate' || 
      reading.stormLevel === 'strong' || 
      reading.stormLevel === 'severe' || 
      reading.stormLevel === 'extreme'
    ).length;
    
    const stormProbability = stormCount / forecasts.length;
    
    const recommendations = this.generateRecommendations(forecasts, stormProbability);
    
    return {
      next24Hours,
      next7Days,
      stormProbability,
      recommendations
    };
  }

  private generateRecommendations(forecasts: GeomagneticReading[], stormProbability: number): string[] {
    const recommendations: string[] = [];
    
    if (stormProbability > 0.3) {
      recommendations.push("High geomagnetic activity expected - ideal for EMF investigations");
      recommendations.push("Increase sensitivity on electromagnetic detection equipment");
      recommendations.push("Monitor for equipment malfunctions or unusual readings");
    } else if (stormProbability > 0.15) {
      recommendations.push("Moderate geomagnetic activity - good conditions for investigation");
      recommendations.push("Standard equipment sensitivity recommended");
    } else {
      recommendations.push("Low geomagnetic activity - baseline conditions");
      recommendations.push("Focus on other environmental factors for investigation timing");
    }
    
    const highActivityPeriods = forecasts.filter(f => f.kIndex > 4);
    if (highActivityPeriods.length > 0) {
      const nextHighActivity = highActivityPeriods[0];
      const hoursUntil = Math.round((nextHighActivity.timestamp.getTime() - new Date().getTime()) / (1000 * 60 * 60));
      recommendations.push(`Next high activity period in approximately ${hoursUntil} hours`);
    }
    
    return recommendations;
  }

  public getParanormalInfluence(reading?: GeomagneticReading): ParanormalGeomagneticInfluence {
    const currentReading = reading || this.currentReading || this.estimateKIndex();
    
    const electromagneticSensitivity = Math.min(1, currentReading.kIndex / 5); // Scale 0-1
    const anomalyProbability = Math.min(1, (currentReading.kIndex - 2) / 4); // Higher K-index = more anomalies
    const investigationOptimal = currentReading.kIndex >= 3 && currentReading.kIndex <= 6; // Sweet spot
    
    const recommendations: string[] = [];
    const equipmentAdjustments: string[] = [];
    
    if (currentReading.kIndex >= 5) {
      recommendations.push("Excellent conditions for electromagnetic anomaly detection");
      recommendations.push("Increased likelihood of equipment interference and unusual readings");
      equipmentAdjustments.push("Reduce EMF detector sensitivity to avoid false positives");
      equipmentAdjustments.push("Use shielded cables and equipment when possible");
    } else if (currentReading.kIndex >= 3) {
      recommendations.push("Good conditions for paranormal investigation");
      recommendations.push("Normal equipment sensitivity recommended");
      equipmentAdjustments.push("Standard equipment settings appropriate");
    } else {
      recommendations.push("Quiet geomagnetic conditions - baseline readings expected");
      recommendations.push("Consider other environmental factors for investigation timing");
      equipmentAdjustments.push("May increase equipment sensitivity for subtle readings");
    }
    
    if (currentReading.stormLevel === 'severe' || currentReading.stormLevel === 'extreme') {
      recommendations.push("CAUTION: Extreme geomagnetic activity may cause equipment damage");
      equipmentAdjustments.push("Consider postponing investigation or use backup equipment");
    }
    
    return {
      electromagneticSensitivity,
      anomalyProbability: Math.max(0, anomalyProbability),
      investigationOptimal,
      recommendations,
      equipmentAdjustments
    };
  }

  public getCurrentReading(): GeomagneticReading | null {
    return this.currentReading;
  }

  public getReadingHistory(): GeomagneticReading[] {
    return [...this.readingHistory];
  }

  public simulateRealTimeMonitoring(durationHours: number = 24, intervalMinutes: number = 30): GeomagneticReading[] {
    const readings: GeomagneticReading[] = [];
    const startTime = new Date();
    const totalIntervals = (durationHours * 60) / intervalMinutes;
    
    for (let i = 0; i < totalIntervals; i++) {
      const timestamp = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
      const reading = this.estimateKIndex(timestamp);
      reading.source = 'estimated';
      readings.push(reading);
    }
    
    return readings;
  }
}

export function createGeomagneticEstimator(
  location: { latitude: number; longitude: number; elevation?: number },
  currentTime?: Date
): GeomagneticActivityEstimator {
  return new GeomagneticActivityEstimator(location, currentTime);
}