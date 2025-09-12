import { BarometerTrend } from 'barometer-trend';
import { Location } from './AstronomicalCalculations';

export interface PressureReading {
  timestamp: Date;
  pressure: number; // hPa (hectopascals/millibars)
  temperature?: number; // Celsius
  humidity?: number; // percentage
  source: 'device-sensor' | 'manual' | 'estimated';
}

export interface WeatherTrend {
  tendency: 'rising' | 'falling' | 'steady';
  rate: number; // hPa per hour
  strength: 'weak' | 'moderate' | 'strong';
  duration: number; // hours
  reliability: number; // 0-1 confidence score
}

export interface WeatherPattern {
  current: WeatherCondition;
  forecast: WeatherForecast[];
  atmospheric: AtmosphericConditions;
  paranormalInfluence: ParanormalWeatherInfluence;
}

export interface WeatherCondition {
  type: 'clear' | 'partly-cloudy' | 'cloudy' | 'overcast' | 'storm-approaching' | 'storm-active' | 'storm-clearing' | 'fog' | 'unknown';
  pressure: number;
  trend: WeatherTrend;
  stability: 'stable' | 'changing' | 'volatile';
  confidence: number; // 0-1
}

export interface WeatherForecast {
  timeHours: number; // hours from now
  condition: WeatherCondition['type'];
  pressure: number;
  confidence: number;
  paranormalActivity: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';
}

export interface AtmosphericConditions {
  pressure: number;
  pressureSeaLevel: number;
  dewPoint?: number;
  visibility: 'excellent' | 'good' | 'fair' | 'poor' | 'very-poor';
  atmosphericStability: 'very-stable' | 'stable' | 'neutral' | 'unstable' | 'very-unstable';
  ionization: number; // 0-1 estimated atmospheric ionization
}

export interface ParanormalWeatherInfluence {
  stormActivity: 'none' | 'approaching' | 'active' | 'clearing';
  electricalActivity: number; // 0-1 scale
  atmosphericTension: number; // 0-1 scale
  optimalConditions: boolean;
  recommendations: string[];
}

export class WeatherEstimationService {
  private pressureHistory: PressureReading[] = [];
  private barometerTrend: BarometerTrend;
  private location: Location;
  private maxHistorySize = 168; // 7 days of hourly readings

  constructor(location: Location) {
    this.location = location;
    this.barometerTrend = new BarometerTrend();
  }

  setLocation(location: Location): void {
    this.location = location;
  }

  // Add pressure reading to history
  addPressureReading(reading: PressureReading): void {
    this.pressureHistory.push(reading);
    
    // Sort by timestamp
    this.pressureHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Keep only recent readings
    if (this.pressureHistory.length > this.maxHistorySize) {
      this.pressureHistory = this.pressureHistory.slice(-this.maxHistorySize);
    }

    // Add to barometer trend analyzer
    this.barometerTrend.addPressure(reading.pressure, reading.timestamp);
  }

  // Get current weather pattern analysis
  getWeatherPattern(): WeatherPattern {
    const currentCondition = this.getCurrentCondition();
    const forecast = this.generateForecast();
    const atmospheric = this.getAtmosphericConditions();
    const paranormalInfluence = this.getParanormalInfluence(currentCondition, atmospheric);

    return {
      current: currentCondition,
      forecast,
      atmospheric,
      paranormalInfluence
    };
  }

  // Simulate device sensor reading (for testing)
  async simulateDeviceSensor(): Promise<PressureReading | null> {
    try {
      // In a real implementation, this would access device sensors
      // For now, simulate based on time patterns
      const basePressure = 1013.25; // Standard sea level pressure
      const timeVariation = Math.sin(Date.now() / (6 * 60 * 60 * 1000)) * 5; // 6-hour cycle
      const randomVariation = (Math.random() - 0.5) * 3;
      
      const pressure = basePressure + timeVariation + randomVariation;
      const temperature = 20 + Math.sin(Date.now() / (24 * 60 * 60 * 1000)) * 10 + (Math.random() - 0.5) * 2;
      const humidity = 50 + Math.sin(Date.now() / (12 * 60 * 60 * 1000)) * 30 + (Math.random() - 0.5) * 10;

      return {
        timestamp: new Date(),
        pressure,
        temperature,
        humidity: Math.max(0, Math.min(100, humidity)),
        source: 'device-sensor'
      };
    } catch (error) {
      console.warn('Device sensors not available:', error);
      return null;
    }
  }

  // Estimate pressure based on location and time
  estimatePressure(location: Location = this.location, time: Date = new Date()): PressureReading {
    // Base pressure at sea level
    let pressure = 1013.25;
    
    // Altitude correction (approximately -0.12 hPa per meter)
    if (location.elevation) {
      pressure -= (location.elevation * 0.12);
    }
    
    // Seasonal variation
    const dayOfYear = this.getDayOfYear(time);
    const seasonalVariation = Math.cos((dayOfYear - 365/4) / 365 * 2 * Math.PI) * 3;
    pressure += seasonalVariation;
    
    // Time of day variation
    const hourOfDay = time.getHours() + time.getMinutes() / 60;
    const diurnalVariation = Math.cos((hourOfDay - 14) / 24 * 2 * Math.PI) * 1.5;
    pressure += diurnalVariation;
    
    // Random weather variation
    const weatherVariation = (Math.random() - 0.5) * 10;
    pressure += weatherVariation;
    
    return {
      timestamp: time,
      pressure: Math.max(950, Math.min(1050, pressure)), // Reasonable bounds
      source: 'estimated'
    };
  }

  // Generate sample pressure history for testing
  generateSampleHistory(days: number = 7): void {
    this.pressureHistory = [];
    const now = new Date();
    
    for (let i = days * 24; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const reading = this.estimatePressure(this.location, time);
      this.pressureHistory.push(reading);
    }
    
    // Add some storm patterns
    this.addStormPattern(2); // Storm 2 days ago
  }

  private addStormPattern(daysAgo: number): void {
    const stormStart = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    for (let i = -12; i <= 12; i++) {
      const time = new Date(stormStart.getTime() + i * 60 * 60 * 1000);
      const existingIndex = this.pressureHistory.findIndex(r => 
        Math.abs(r.timestamp.getTime() - time.getTime()) < 30 * 60 * 1000
      );
      
      if (existingIndex !== -1) {
        // Storm pressure profile: drop before, lowest during, rise after
        let pressureDrop = 0;
        if (i < -6) pressureDrop = (6 + i) * 2; // Gradual drop
        else if (i < 0) pressureDrop = -15 - i * 2; // Steep drop
        else if (i < 6) pressureDrop = -20 + i * 2; // Recovery
        else pressureDrop = Math.max(-5, -20 + i * 1.5); // Back to normal
        
        this.pressureHistory[existingIndex].pressure += pressureDrop;
      }
    }
  }

  private getCurrentCondition(): WeatherCondition {
    if (this.pressureHistory.length < 3) {
      return {
        type: 'unknown',
        pressure: 1013.25,
        trend: { tendency: 'steady', rate: 0, strength: 'weak', duration: 0, reliability: 0 },
        stability: 'stable',
        confidence: 0
      };
    }

    const recent = this.pressureHistory.slice(-6); // Last 6 hours
    const currentPressure = recent[recent.length - 1].pressure;
    
    // Calculate trend using barometer-trend
    const trend = this.calculateTrend(recent);
    
    // Determine weather type based on pressure and trend
    const type = this.classifyWeatherType(currentPressure, trend);
    
    // Calculate stability
    const stability = this.calculateStability(recent);
    
    // Calculate confidence based on data quality and age
    const confidence = this.calculateConfidence(recent);

    return {
      type,
      pressure: currentPressure,
      trend,
      stability,
      confidence
    };
  }

  private calculateTrend(readings: PressureReading[]): WeatherTrend {
    if (readings.length < 2) {
      return { tendency: 'steady', rate: 0, strength: 'weak', duration: 0, reliability: 0 };
    }

    // Calculate pressure change rate
    const timeSpan = readings[readings.length - 1].timestamp.getTime() - readings[0].timestamp.getTime();
    const pressureChange = readings[readings.length - 1].pressure - readings[0].pressure;
    const rate = (pressureChange / (timeSpan / (1000 * 60 * 60))); // hPa per hour

    // Determine tendency
    let tendency: WeatherTrend['tendency'] = 'steady';
    if (Math.abs(rate) > 0.1) {
      tendency = rate > 0 ? 'rising' : 'falling';
    }

    // Determine strength
    let strength: WeatherTrend['strength'] = 'weak';
    if (Math.abs(rate) > 1.0) strength = 'moderate';
    if (Math.abs(rate) > 3.0) strength = 'strong';

    // Calculate duration of current trend
    let duration = 0;
    let currentDirection = tendency;
    for (let i = readings.length - 1; i > 0; i--) {
      const hourlyRate = (readings[i].pressure - readings[i-1].pressure);
      const hourlyTendency = Math.abs(hourlyRate) > 0.1 ? (hourlyRate > 0 ? 'rising' : 'falling') : 'steady';
      
      if (hourlyTendency === currentDirection) {
        duration++;
      } else {
        break;
      }
    }

    // Calculate reliability based on consistency
    const reliability = Math.min(1, duration / 6); // More reliable with longer duration

    return { tendency, rate, strength, duration, reliability };
  }

  private classifyWeatherType(pressure: number, trend: WeatherTrend): WeatherCondition['type'] {
    // High pressure systems (>1020 hPa)
    if (pressure > 1020) {
      if (trend.tendency === 'rising') return 'clear';
      if (trend.tendency === 'steady') return 'clear';
      return 'partly-cloudy';
    }
    
    // Normal pressure (1000-1020 hPa)
    if (pressure > 1000) {
      if (trend.tendency === 'rising') return 'partly-cloudy';
      if (trend.tendency === 'steady') return 'cloudy';
      if (trend.strength === 'strong') return 'storm-approaching';
      return 'overcast';
    }
    
    // Low pressure systems (<1000 hPa)
    if (pressure > 990) {
      if (trend.tendency === 'falling' && trend.strength === 'strong') return 'storm-approaching';
      if (trend.tendency === 'rising') return 'storm-clearing';
      return 'storm-active';
    }
    
    // Very low pressure (<990 hPa)
    if (trend.tendency === 'rising') return 'storm-clearing';
    return 'storm-active';
  }

  private calculateStability(readings: PressureReading[]): WeatherCondition['stability'] {
    if (readings.length < 3) return 'stable';
    
    // Calculate pressure variance
    const pressures = readings.map(r => r.pressure);
    const mean = pressures.reduce((a, b) => a + b) / pressures.length;
    const variance = pressures.reduce((acc, pressure) => acc + Math.pow(pressure - mean, 2), 0) / pressures.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev > 5) return 'volatile';
    if (stdDev > 2) return 'changing';
    return 'stable';
  }

  private calculateConfidence(readings: PressureReading[]): number {
    if (readings.length === 0) return 0;
    
    let confidence = 0.5; // Base confidence
    
    // More readings = higher confidence
    confidence += Math.min(0.3, readings.length * 0.05);
    
    // Recent readings are more reliable
    const avgAge = readings.reduce((sum, r) => {
      const ageHours = (Date.now() - r.timestamp.getTime()) / (1000 * 60 * 60);
      return sum + ageHours;
    }, 0) / readings.length;
    
    confidence += Math.max(0, 0.2 - avgAge * 0.01);
    
    // Device sensor readings are more reliable than estimates
    const deviceReadings = readings.filter(r => r.source === 'device-sensor').length;
    confidence += (deviceReadings / readings.length) * 0.2;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private generateForecast(): WeatherForecast[] {
    const current = this.getCurrentCondition();
    const forecast: WeatherForecast[] = [];
    
    for (let hours = 1; hours <= 24; hours += 3) {
      let condition = current.type;
      let pressure = current.pressure;
      let confidence = Math.max(0.1, current.confidence - hours * 0.03);
      
      // Apply trend to forecast
      pressure += current.trend.rate * hours;
      
      // Adjust condition based on forecasted pressure
      condition = this.classifyWeatherType(pressure, current.trend);
      
      // Calculate paranormal activity likelihood
      const paranormalActivity = this.calculateParanormalActivity(condition, pressure, hours);
      
      forecast.push({
        timeHours: hours,
        condition,
        pressure,
        confidence,
        paranormalActivity
      });
    }
    
    return forecast;
  }

  private calculateParanormalActivity(condition: WeatherCondition['type'], pressure: number, hoursAhead: number): WeatherForecast['paranormalActivity'] {
    let activity = 0;
    
    // Storm conditions increase activity
    if (condition === 'storm-approaching' || condition === 'storm-active') activity += 3;
    if (condition === 'storm-clearing') activity += 2;
    
    // Low pressure increases activity
    if (pressure < 1000) activity += 2;
    if (pressure < 990) activity += 1;
    
    // High pressure decreases activity
    if (pressure > 1020) activity -= 1;
    
    // Uncertainty over time
    activity -= hoursAhead * 0.1;
    
    if (activity >= 4) return 'very-high';
    if (activity >= 3) return 'high';
    if (activity >= 1) return 'moderate';
    if (activity >= 0) return 'low';
    return 'very-low';
  }

  private getAtmosphericConditions(): AtmosphericConditions {
    const currentReading = this.pressureHistory[this.pressureHistory.length - 1];
    if (!currentReading) {
      return {
        pressure: 1013.25,
        pressureSeaLevel: 1013.25,
        visibility: 'good',
        atmosphericStability: 'stable',
        ionization: 0.5
      };
    }

    // Calculate sea level pressure
    const pressureSeaLevel = currentReading.pressure + (this.location.elevation || 0) * 0.12;
    
    // Estimate visibility based on pressure and humidity
    let visibility: AtmosphericConditions['visibility'] = 'good';
    if (currentReading.pressure < 990) visibility = 'poor';
    else if (currentReading.pressure < 1000) visibility = 'fair';
    else if (currentReading.pressure > 1025) visibility = 'excellent';
    
    // Calculate atmospheric stability
    const recent = this.pressureHistory.slice(-6);
    const stability = this.calculateStability(recent);
    let atmosphericStability: AtmosphericConditions['atmosphericStability'];
    
    switch (stability) {
      case 'stable': atmosphericStability = 'stable'; break;
      case 'changing': atmosphericStability = 'neutral'; break;
      case 'volatile': atmosphericStability = 'unstable'; break;
    }
    
    // Estimate ionization based on pressure changes
    const trend = this.calculateTrend(recent);
    let ionization = 0.3; // Base level
    if (trend.strength === 'strong') ionization += 0.4;
    if (currentReading.pressure < 995) ionization += 0.2;
    ionization = Math.max(0, Math.min(1, ionization));

    return {
      pressure: currentReading.pressure,
      pressureSeaLevel,
      dewPoint: currentReading.temperature ? this.calculateDewPoint(currentReading.temperature, currentReading.humidity) : undefined,
      visibility,
      atmosphericStability,
      ionization
    };
  }

  private calculateDewPoint(temperature: number, humidity?: number): number {
    if (!humidity) return temperature - 5; // Rough estimate
    
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
  }

  private getParanormalInfluence(condition: WeatherCondition, atmospheric: AtmosphericConditions): ParanormalWeatherInfluence {
    let stormActivity: ParanormalWeatherInfluence['stormActivity'] = 'none';
    if (condition.type === 'storm-approaching') stormActivity = 'approaching';
    if (condition.type === 'storm-active') stormActivity = 'active';
    if (condition.type === 'storm-clearing') stormActivity = 'clearing';
    
    // Calculate electrical activity (higher during storms and pressure changes)
    let electricalActivity = atmospheric.ionization;
    if (stormActivity !== 'none') electricalActivity = Math.min(1, electricalActivity + 0.3);
    if (condition.trend.strength === 'strong') electricalActivity = Math.min(1, electricalActivity + 0.2);
    
    // Calculate atmospheric tension
    let atmosphericTension = 0.5;
    if (condition.trend.tendency === 'falling' && condition.trend.strength === 'strong') atmosphericTension += 0.4;
    if (atmospheric.pressure < 1000) atmosphericTension += 0.2;
    if (atmospheric.atmosphericStability === 'unstable') atmosphericTension += 0.2;
    atmosphericTension = Math.max(0, Math.min(1, atmosphericTension));
    
    // Determine if conditions are optimal for paranormal investigation
    const optimalConditions = 
      stormActivity === 'approaching' || 
      (electricalActivity > 0.6 && atmosphericTension > 0.7) ||
      (atmospheric.pressure < 1000 && condition.trend.tendency === 'falling');
    
    // Generate recommendations
    const recommendations = this.generateWeatherRecommendations(stormActivity, electricalActivity, atmosphericTension, optimalConditions);

    return {
      stormActivity,
      electricalActivity,
      atmosphericTension,
      optimalConditions,
      recommendations
    };
  }

  private generateWeatherRecommendations(
    stormActivity: ParanormalWeatherInfluence['stormActivity'],
    electricalActivity: number,
    atmosphericTension: number,
    optimalConditions: boolean
  ): string[] {
    const recommendations: string[] = [];
    
    if (optimalConditions) {
      recommendations.push('Optimal atmospheric conditions for paranormal investigation');
    }
    
    if (stormActivity === 'approaching') {
      recommendations.push('Storm approaching - increased electrical activity expected');
      recommendations.push('Monitor EMF equipment for anomalous readings');
    }
    
    if (stormActivity === 'active') {
      recommendations.push('Active storm conditions - exercise caution with electronic equipment');
      recommendations.push('High electrical activity may interfere with standard measurements');
    }
    
    if (electricalActivity > 0.7) {
      recommendations.push('High atmospheric electrical activity detected');
      recommendations.push('Increased likelihood of electromagnetic anomalies');
    }
    
    if (atmosphericTension > 0.8) {
      recommendations.push('High atmospheric tension - unstable conditions');
      recommendations.push('Consider extended monitoring periods');
    }
    
    return recommendations;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Utility methods
  getRecentReadings(hours: number = 24): PressureReading[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.pressureHistory.filter(r => r.timestamp >= cutoff);
  }

  getPressureStatistics(): {
    current: number;
    min24h: number;
    max24h: number;
    avg24h: number;
    trend: string;
  } {
    const recent = this.getRecentReadings(24);
    if (recent.length === 0) {
      return { current: 0, min24h: 0, max24h: 0, avg24h: 0, trend: 'unknown' };
    }

    const pressures = recent.map(r => r.pressure);
    const current = pressures[pressures.length - 1];
    const min24h = Math.min(...pressures);
    const max24h = Math.max(...pressures);
    const avg24h = pressures.reduce((a, b) => a + b) / pressures.length;
    
    const trend = this.calculateTrend(recent.slice(-6));
    
    return {
      current,
      min24h,
      max24h,
      avg24h,
      trend: `${trend.tendency} (${trend.rate.toFixed(1)} hPa/h)`
    };
  }

  clearHistory(): void {
    this.pressureHistory = [];
    this.barometerTrend = new BarometerTrend();
  }
}

// Utility functions
export const isOptimalWeatherConditions = (pattern: WeatherPattern): boolean => {
  return pattern.paranormalInfluence.optimalConditions;
};

export const getWeatherSummary = (pattern: WeatherPattern): string => {
  const condition = pattern.current;
  const influence = pattern.paranormalInfluence;
  
  let summary = `${condition.type.replace('-', ' ')} (${condition.pressure.toFixed(1)} hPa, ${condition.trend.tendency})`;
  
  if (influence.optimalConditions) {
    summary += ' - OPTIMAL CONDITIONS';
  }
  
  return summary;
};