import * as Astronomy from 'astronomy-engine';
import * as SunCalc from 'suncalc';

export interface Location {
  latitude: number;
  longitude: number;
  elevation?: number; // meters above sea level
  timezone?: string;
}

export interface MoonPhaseData {
  phase: number; // 0-1, where 0 = new moon, 0.5 = full moon
  phaseName: string;
  illumination: number; // 0-1
  age: number; // days since new moon
  distance: number; // km from Earth
  angularDiameter: number; // degrees
  nextNewMoon: Date;
  nextFullMoon: Date;
  isWaxing: boolean;
  visibility: 'visible' | 'not-visible' | 'partial';
}

export interface SolarData {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  civilTwilightStart: Date;
  civilTwilightEnd: Date;
  nauticalTwilightStart: Date;
  nauticalTwilightEnd: Date;
  astronomicalTwilightStart: Date;
  astronomicalTwilightEnd: Date;
  azimuth: number; // degrees from north
  elevation: number; // degrees above horizon
  dayLength: number; // hours
  isDay: boolean;
  isDusk: boolean;
  isDawn: boolean;
  isNight: boolean;
  goldenHourStart: Date;
  goldenHourEnd: Date;
  blueHourStart: Date;
  blueHourEnd: Date;
}

export interface PlanetaryData {
  mercury: PlanetPosition;
  venus: PlanetPosition;
  mars: PlanetPosition;
  jupiter: PlanetPosition;
  saturn: PlanetPosition;
}

export interface PlanetPosition {
  visible: boolean;
  constellation: string;
  azimuth: number;
  elevation: number;
  distance: number; // AU from Earth
  magnitude: number; // visual magnitude
  phase: number; // 0-1 for inner planets
}

export interface AstronomicalInfluences {
  moonInfluence: 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous' | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';
  solarInfluence: 'day' | 'golden-hour' | 'blue-hour' | 'civil-twilight' | 'nautical-twilight' | 'astronomical-twilight' | 'night';
  planetaryInfluence: string[];
  overallActivity: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';
  recommendations: string[];
}

export class AstronomicalCalculations {
  private location: Location;
  private currentTime: Date;

  constructor(location: Location, time: Date = new Date()) {
    this.location = location;
    this.currentTime = time;
  }

  setLocation(location: Location): void {
    this.location = location;
  }

  setTime(time: Date): void {
    this.currentTime = time;
  }

  getMoonPhaseData(): MoonPhaseData {
    try {
      // Get moon illumination using SunCalc
      const moonIllumination = SunCalc.getMoonIllumination(this.currentTime);
      
      // Get moon position
      const moonPosition = SunCalc.getMoonPosition(this.currentTime, this.location.latitude, this.location.longitude);
      
      // Get moon times
      const moonTimes = SunCalc.getMoonTimes(this.currentTime, this.location.latitude, this.location.longitude);

      // Calculate using astronomy-engine for more precise data
      const observer = Astronomy.MakeObserver(this.location.latitude, this.location.longitude, this.location.elevation || 0);
      const moonState = Astronomy.MoonPhase(this.currentTime);
      
      // Get moon distance using astronomy-engine
      const moonVector = Astronomy.GeoMoon(this.currentTime);
      const moonDistance = moonVector.vec.Length() * Astronomy.KM_PER_AU;

      // Calculate angular diameter
      const moonAngularRadius = Math.asin(1737.4 / moonDistance) * (180 / Math.PI); // Moon radius = 1737.4 km
      const angularDiameter = moonAngularRadius * 2;

      // Determine phase name
      const phaseName = this.getMoonPhaseName(moonIllumination.phase);
      
      // Calculate moon age (days since new moon)
      const moonAge = moonIllumination.phase * 29.53059; // synodic month
      
      // Find next new moon and full moon
      const searchDate = new Date(this.currentTime);
      let nextNewMoon: Date;
      let nextFullMoon: Date;

      // Search for next new moon (phase = 0)
      for (let i = 1; i <= 35; i++) {
        const testDate = new Date(this.currentTime.getTime() + i * 24 * 60 * 60 * 1000);
        const testPhase = Astronomy.MoonPhase(testDate);
        if (Math.abs(testPhase) < 0.01) {
          nextNewMoon = testDate;
          break;
        }
      }

      // Search for next full moon (phase = 0.5)
      for (let i = 1; i <= 35; i++) {
        const testDate = new Date(this.currentTime.getTime() + i * 24 * 60 * 60 * 1000);
        const testPhase = Astronomy.MoonPhase(testDate);
        if (Math.abs(Math.abs(testPhase) - 0.5) < 0.01) {
          nextFullMoon = testDate;
          break;
        }
      }

      // Determine visibility
      let visibility: 'visible' | 'not-visible' | 'partial' = 'not-visible';
      if (moonTimes.rise && moonTimes.set) {
        const now = this.currentTime.getTime();
        const rise = moonTimes.rise.getTime();
        const set = moonTimes.set.getTime();
        
        if (rise <= now && now <= set) {
          visibility = moonPosition.altitude > 0 ? 'visible' : 'partial';
        }
      }

      return {
        phase: Math.abs(moonState), // 0 = new, 0.5 = full
        phaseName,
        illumination: moonIllumination.fraction,
        age: moonAge,
        distance: moonDistance,
        angularDiameter,
        nextNewMoon: nextNewMoon!,
        nextFullMoon: nextFullMoon!,
        isWaxing: moonIllumination.phase < 0,
        visibility
      };
    } catch (error) {
      console.error('Error calculating moon phase data:', error);
      return this.getDefaultMoonPhaseData();
    }
  }

  getSolarData(): SolarData {
    try {
      // Get sun times using SunCalc
      const sunTimes = SunCalc.getTimes(this.currentTime, this.location.latitude, this.location.longitude);
      
      // Get current sun position
      const sunPosition = SunCalc.getPosition(this.currentTime, this.location.latitude, this.location.longitude);

      // Calculate day length
      const dayLength = sunTimes.sunset && sunTimes.sunrise ? 
        (sunTimes.sunset.getTime() - sunTimes.sunrise.getTime()) / (1000 * 60 * 60) : 0;

      // Determine current period
      const now = this.currentTime.getTime();
      const isDay = sunTimes.sunrise && sunTimes.sunset && 
        now >= sunTimes.sunrise.getTime() && now <= sunTimes.sunset.getTime();
      
      const isDusk = sunTimes.sunset && sunTimes.dusk &&
        now >= sunTimes.sunset.getTime() && now <= sunTimes.dusk.getTime();
      
      const isDawn = sunTimes.dawn && sunTimes.sunrise &&
        now >= sunTimes.dawn.getTime() && now <= sunTimes.sunrise.getTime();
      
      const isNight = !isDay && !isDusk && !isDawn;

      return {
        sunrise: sunTimes.sunrise,
        sunset: sunTimes.sunset,
        solarNoon: sunTimes.solarNoon,
        civilTwilightStart: sunTimes.dawn,
        civilTwilightEnd: sunTimes.dusk,
        nauticalTwilightStart: sunTimes.nauticalDawn,
        nauticalTwilightEnd: sunTimes.nauticalDusk,
        astronomicalTwilightStart: sunTimes.nightEnd,
        astronomicalTwilightEnd: sunTimes.night,
        azimuth: sunPosition.azimuth * (180 / Math.PI), // Convert to degrees
        elevation: sunPosition.altitude * (180 / Math.PI),
        dayLength,
        isDay,
        isDusk,
        isDawn,
        isNight,
        goldenHourStart: sunTimes.goldenHour,
        goldenHourEnd: sunTimes.goldenHourEnd,
        blueHourStart: sunTimes.blueHour,
        blueHourEnd: sunTimes.blueHourEnd
      };
    } catch (error) {
      console.error('Error calculating solar data:', error);
      return this.getDefaultSolarData();
    }
  }

  getPlanetaryData(): PlanetaryData {
    try {
      const observer = Astronomy.MakeObserver(this.location.latitude, this.location.longitude, this.location.elevation || 0);
      
      const planets = {
        mercury: this.getPlanetPosition('Mercury', observer),
        venus: this.getPlanetPosition('Venus', observer),
        mars: this.getPlanetPosition('Mars', observer),
        jupiter: this.getPlanetPosition('Jupiter', observer),
        saturn: this.getPlanetPosition('Saturn', observer)
      };

      return planets;
    } catch (error) {
      console.error('Error calculating planetary data:', error);
      return this.getDefaultPlanetaryData();
    }
  }

  private getPlanetPosition(planetName: string, observer: Astronomy.Observer): PlanetPosition {
    try {
      const body = planetName as Astronomy.Body;
      const equ = Astronomy.Equator(body, this.currentTime, observer, true, true);
      const hor = Astronomy.Horizon(this.currentTime, observer, equ.ra, equ.dec, 'normal');
      
      // Get distance (this is approximate)
      const vector = Astronomy.HelioVector(body, this.currentTime);
      const earthVector = Astronomy.HelioVector('Earth', this.currentTime);
      const distance = Math.sqrt(
        Math.pow(vector.x - earthVector.x, 2) +
        Math.pow(vector.y - earthVector.y, 2) +
        Math.pow(vector.z - earthVector.z, 2)
      );

      // Estimate magnitude (simplified)
      let magnitude = 0;
      switch (planetName) {
        case 'Mercury': magnitude = -0.4; break;
        case 'Venus': magnitude = -4.4; break;
        case 'Mars': magnitude = 0.7; break;
        case 'Jupiter': magnitude = -2.9; break;
        case 'Saturn': magnitude = 0.5; break;
      }

      // Calculate phase for inner planets
      let phase = 1; // Full phase for outer planets
      if (planetName === 'Mercury' || planetName === 'Venus') {
        // Simplified phase calculation
        phase = (1 + Math.cos(distance * Math.PI / 2)) / 2;
      }

      return {
        visible: hor.altitude > 0,
        constellation: this.getConstellation(equ.ra, equ.dec),
        azimuth: hor.azimuth,
        elevation: hor.altitude,
        distance,
        magnitude,
        phase
      };
    } catch (error) {
      console.error(`Error calculating position for ${planetName}:`, error);
      return {
        visible: false,
        constellation: 'Unknown',
        azimuth: 0,
        elevation: 0,
        distance: 0,
        magnitude: 0,
        phase: 0
      };
    }
  }

  getAstronomicalInfluences(): AstronomicalInfluences {
    const moonData = this.getMoonPhaseData();
    const solarData = this.getSolarData();
    const planetaryData = this.getPlanetaryData();

    // Determine moon influence
    const moonInfluence = this.getMoonInfluenceCategory(moonData);
    
    // Determine solar influence
    const solarInfluence = this.getSolarInfluenceCategory(solarData);
    
    // Determine planetary influences
    const planetaryInfluence = this.getPlanetaryInfluences(planetaryData);
    
    // Calculate overall activity level
    const overallActivity = this.calculateOverallActivity(moonData, solarData, planetaryData);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(moonData, solarData, planetaryData);

    return {
      moonInfluence,
      solarInfluence,
      planetaryInfluence,
      overallActivity,
      recommendations
    };
  }

  private getMoonPhaseName(phase: number): string {
    const absPhase = Math.abs(phase);
    if (absPhase < 0.05) return 'New Moon';
    if (absPhase < 0.25) return phase > 0 ? 'Waxing Crescent' : 'Waning Crescent';
    if (absPhase < 0.30) return phase > 0 ? 'First Quarter' : 'Last Quarter';
    if (absPhase < 0.45) return phase > 0 ? 'Waxing Gibbous' : 'Waning Gibbous';
    return 'Full Moon';
  }

  private getMoonInfluenceCategory(moonData: MoonPhaseData): AstronomicalInfluences['moonInfluence'] {
    if (moonData.phase < 0.05) return 'new';
    if (moonData.phase < 0.25) return moonData.isWaxing ? 'waxing-crescent' : 'waning-crescent';
    if (moonData.phase < 0.30) return moonData.isWaxing ? 'first-quarter' : 'last-quarter';
    if (moonData.phase < 0.45) return moonData.isWaxing ? 'waxing-gibbous' : 'waning-gibbous';
    return 'full';
  }

  private getSolarInfluenceCategory(solarData: SolarData): AstronomicalInfluences['solarInfluence'] {
    if (solarData.isDay) {
      const now = this.currentTime.getTime();
      const goldenStart = solarData.goldenHourStart?.getTime();
      const goldenEnd = solarData.goldenHourEnd?.getTime();
      
      if (goldenStart && goldenEnd && now >= goldenStart && now <= goldenEnd) {
        return 'golden-hour';
      }
      return 'day';
    }
    
    if (solarData.isDusk || solarData.isDawn) {
      const blueStart = solarData.blueHourStart?.getTime();
      const blueEnd = solarData.blueHourEnd?.getTime();
      
      if (blueStart && blueEnd && 
          this.currentTime.getTime() >= blueStart && 
          this.currentTime.getTime() <= blueEnd) {
        return 'blue-hour';
      }
      return 'civil-twilight';
    }
    
    const now = this.currentTime.getTime();
    const nauticalStart = solarData.nauticalTwilightStart?.getTime();
    const nauticalEnd = solarData.nauticalTwilightEnd?.getTime();
    
    if (nauticalStart && nauticalEnd && 
        (now >= nauticalStart && now <= solarData.sunrise.getTime() ||
         now >= solarData.sunset.getTime() && now <= nauticalEnd)) {
      return 'nautical-twilight';
    }
    
    const astroStart = solarData.astronomicalTwilightStart?.getTime();
    const astroEnd = solarData.astronomicalTwilightEnd?.getTime();
    
    if (astroStart && astroEnd &&
        (now >= astroStart && now <= solarData.sunrise.getTime() ||
         now >= solarData.sunset.getTime() && now <= astroEnd)) {
      return 'astronomical-twilight';
    }
    
    return 'night';
  }

  private getPlanetaryInfluences(planetaryData: PlanetaryData): string[] {
    const influences: string[] = [];
    
    Object.entries(planetaryData).forEach(([name, data]) => {
      if (data.visible && data.elevation > 20) {
        influences.push(`${name.charAt(0).toUpperCase() + name.slice(1)} visible (${data.elevation.toFixed(1)}°)`);
      }
    });
    
    return influences;
  }

  private calculateOverallActivity(moonData: MoonPhaseData, solarData: SolarData, planetaryData: PlanetaryData): AstronomicalInfluences['overallActivity'] {
    let activityScore = 0;
    
    // Moon phase influence
    if (moonData.phase < 0.1 || moonData.phase > 0.4) activityScore += 2; // New or Full moon
    else if (moonData.phase < 0.3) activityScore += 1; // Quarter moons
    
    // Solar influence
    if (solarData.isNight) activityScore += 2;
    else if (solarData.isDusk || solarData.isDawn) activityScore += 1;
    
    // Planetary influence
    const visiblePlanets = Object.values(planetaryData).filter(p => p.visible).length;
    activityScore += Math.min(visiblePlanets, 2);
    
    if (activityScore >= 5) return 'very-high';
    if (activityScore >= 4) return 'high';
    if (activityScore >= 2) return 'moderate';
    if (activityScore >= 1) return 'low';
    return 'very-low';
  }

  private generateRecommendations(moonData: MoonPhaseData, solarData: SolarData, planetaryData: PlanetaryData): string[] {
    const recommendations: string[] = [];
    
    // Moon-based recommendations
    if (moonData.phase < 0.1) {
      recommendations.push('New Moon - Ideal for new investigations and fresh starts');
    } else if (moonData.phase > 0.4) {
      recommendations.push('Full Moon - Peak paranormal activity expected');
    }
    
    // Solar-based recommendations
    if (solarData.isNight) {
      recommendations.push('Nighttime - Optimal conditions for paranormal investigation');
    } else if (solarData.isDusk || solarData.isDawn) {
      recommendations.push('Twilight hours - Transitional period with increased activity');
    }
    
    // Planetary recommendations
    const visiblePlanets = Object.values(planetaryData).filter(p => p.visible).length;
    if (visiblePlanets >= 3) {
      recommendations.push('Multiple planets visible - Enhanced cosmic influence');
    }
    
    return recommendations;
  }

  private getConstellation(ra: number, dec: number): string {
    // Simplified constellation detection based on declination
    // In a real implementation, this would use proper constellation boundaries
    if (dec > 60) return 'Northern circumpolar';
    if (dec > 30) return 'Northern sky';
    if (dec > -30) return 'Equatorial region';
    if (dec > -60) return 'Southern sky';
    return 'Southern circumpolar';
  }

  private getDefaultMoonPhaseData(): MoonPhaseData {
    return {
      phase: 0,
      phaseName: 'Unknown',
      illumination: 0,
      age: 0,
      distance: 384400,
      angularDiameter: 0.5,
      nextNewMoon: new Date(),
      nextFullMoon: new Date(),
      isWaxing: false,
      visibility: 'not-visible'
    };
  }

  private getDefaultSolarData(): SolarData {
    const now = new Date();
    return {
      sunrise: now,
      sunset: now,
      solarNoon: now,
      civilTwilightStart: now,
      civilTwilightEnd: now,
      nauticalTwilightStart: now,
      nauticalTwilightEnd: now,
      astronomicalTwilightStart: now,
      astronomicalTwilightEnd: now,
      azimuth: 0,
      elevation: 0,
      dayLength: 12,
      isDay: false,
      isDusk: false,
      isDawn: false,
      isNight: true,
      goldenHourStart: now,
      goldenHourEnd: now,
      blueHourStart: now,
      blueHourEnd: now
    };
  }

  private getDefaultPlanetaryData(): PlanetaryData {
    const defaultPlanet: PlanetPosition = {
      visible: false,
      constellation: 'Unknown',
      azimuth: 0,
      elevation: 0,
      distance: 0,
      magnitude: 0,
      phase: 0
    };

    return {
      mercury: defaultPlanet,
      venus: defaultPlanet,
      mars: defaultPlanet,
      jupiter: defaultPlanet,
      saturn: defaultPlanet
    };
  }
}

// Utility functions for common calculations
export const calculateMoonDistance = (date: Date): number => {
  try {
    const moonVector = Astronomy.GeoMoon(date);
    return moonVector.vec.Length() * Astronomy.KM_PER_AU;
  } catch {
    return 384400; // Average distance in km
  }
};

export const isOptimalInvestigationTime = (location: Location, date: Date = new Date()): boolean => {
  const calc = new AstronomicalCalculations(location, date);
  const influences = calc.getAstronomicalInfluences();
  return influences.overallActivity === 'high' || influences.overallActivity === 'very-high';
};

export const getNextOptimalTime = (location: Location, startDate: Date = new Date()): Date => {
  let searchDate = new Date(startDate);
  
  for (let i = 0; i < 30; i++) { // Search next 30 days
    if (isOptimalInvestigationTime(location, searchDate)) {
      return searchDate;
    }
    searchDate = new Date(searchDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Fallback
};