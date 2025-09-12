import { EventEmitter } from 'events';
import {
  EnvironmentalBaseline,
  EnvironmentalReading,
  EnvironmentalSensor,
  EMFReading,
  AudioReading,
  MotionEvent,
  EMFFrequencyBand,
  AudioFrequencyBand
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('EnvironmentalBaselineEstablisher');

export class EnvironmentalBaselineEstablisher extends EventEmitter {
  private activeBaselines: Map<string, EnvironmentalBaseline> = new Map();
  private currentBaseline: EnvironmentalBaseline | null = null;
  private isEstablishing = false;
  private dataBuffer: BaselineDataBuffer;
  private statisticsCalculator: StatisticsCalculator;
  private qualityAnalyzer: BaselineQualityAnalyzer;

  constructor() {
    super();
    this.dataBuffer = new BaselineDataBuffer();
    this.statisticsCalculator = new StatisticsCalculator();
    this.qualityAnalyzer = new BaselineQualityAnalyzer();
  }

  async establishBaseline(location: string, duration = 300): Promise<EnvironmentalBaseline> {
    if (this.isEstablishing) {
      throw new Error('Baseline establishment already in progress');
    }

    const baselineId = `baseline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`Starting baseline establishment for location: ${location} (${duration}s)`);
      
      this.isEstablishing = true;
      this.dataBuffer.clear();
      
      const baseline: EnvironmentalBaseline = {
        id: baselineId,
        timestamp: new Date(),
        duration,
        location,
        conditions: this.initializeBaselineConditions(),
        isActive: false,
        confidence: 0
      };

      this.currentBaseline = baseline;
      
      // Start data collection
      this.startDataCollection(duration);
      
      // Emit progress updates
      this.emitProgressUpdates(duration);
      
      // Wait for collection to complete
      await this.waitForCompletion(duration);
      
      // Calculate final baseline statistics
      await this.calculateBaselineStatistics(baseline);
      
      // Assess baseline quality
      const quality = this.qualityAnalyzer.assessQuality(baseline, this.dataBuffer);
      baseline.confidence = quality.overallConfidence;
      
      if (quality.overallConfidence >= 0.7) {
        baseline.isActive = true;
        this.activeBaselines.set(baselineId, baseline);
        this.emit('baseline-established', baseline);
        logger.info(`Baseline established successfully: ${baseline.id} (confidence: ${baseline.confidence.toFixed(2)})`);
      } else {
        this.emit('baseline-failed', { 
          baseline, 
          reason: 'Low confidence score',
          quality 
        });
        logger.warn(`Baseline establishment failed due to low confidence: ${quality.overallConfidence.toFixed(2)}`);
      }
      
      return baseline;
    } catch (error) {
      this.isEstablishing = false;
      this.emit('baseline-error', { error, location, duration });
      logger.error('Baseline establishment failed:', error);
      throw error;
    } finally {
      this.isEstablishing = false;
      this.currentBaseline = null;
    }
  }

  private initializeBaselineConditions(): EnvironmentalBaseline['conditions'] {
    return {
      temperature: { mean: 0, std: 0, range: [0, 0] },
      humidity: { mean: 0, std: 0, range: [0, 0] },
      pressure: { mean: 0, std: 0, range: [0, 0] },
      emf: {},
      audio: {
        backgroundLevel: 0,
        dominantFrequencies: [],
        spectralProfile: new Float32Array(0)
      },
      motion: {
        averageActivity: 0,
        quietPeriods: [],
        noiseSources: []
      }
    };
  }

  private startDataCollection(duration: number): void {
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    
    const collectData = () => {
      if (Date.now() >= endTime || !this.isEstablishing) {
        return; // Collection complete
      }

      // Collect current environmental readings
      this.collectEnvironmentalSnapshot();
      
      // Schedule next collection
      setTimeout(collectData, 1000); // Collect every second
    };

    collectData();
  }

  private collectEnvironmentalSnapshot(): void {
    const timestamp = Date.now();
    
    // Simulate environmental data collection
    // In a real implementation, this would read from actual sensors
    const snapshot: EnvironmentalSnapshot = {
      timestamp,
      temperature: 20 + (Math.random() - 0.5) * 4, // 18-22°C
      humidity: 45 + (Math.random() - 0.5) * 10,   // 40-50%
      pressure: 1013 + (Math.random() - 0.5) * 20, // 1003-1023 hPa
      emfReadings: this.generateEMFReadings(timestamp),
      audioReadings: this.generateAudioReadings(timestamp),
      motionActivity: Math.random() * 5, // 0-5 motion units
      lightLevel: 400 + Math.random() * 200, // 400-600 lux
      vibration: Math.random() * 0.1, // 0-0.1 m/s²
      magneticField: 25 + (Math.random() - 0.5) * 5 // 22.5-27.5 µT (Earth's field)
    };

    this.dataBuffer.addSnapshot(snapshot);
    this.emit('baseline-data-collected', { 
      progress: this.calculateProgress(),
      snapshot 
    });
  }

  private generateEMFReadings(timestamp: number): EMFReading[] {
    const readings: EMFReading[] = [];
    
    // Generate readings for different frequency bands
    const bands: EMFFrequencyBand[] = [
      EMFFrequencyBand.ELF,
      EMFFrequencyBand.SLF,
      EMFFrequencyBand.VLF,
      EMFFrequencyBand.LF
    ];

    for (const band of bands) {
      const baseIntensity = this.getBaseIntensityForBand(band);
      const intensity = baseIntensity * (0.8 + Math.random() * 0.4); // ±20% variation
      
      readings.push({
        timestamp,
        frequencyBand: band,
        intensity,
        frequency: this.getCenterFrequencyForBand(band),
        fieldType: 'combined',
        coordinates: { x: 0, y: 0, z: 0 }
      });
    }

    return readings;
  }

  private getBaseIntensityForBand(band: EMFFrequencyBand): number {
    // Typical background EMF levels in µT
    const baselevels: Record<EMFFrequencyBand, number> = {
      [EMFFrequencyBand.ELF]: 0.1,      // 0.1 µT
      [EMFFrequencyBand.SLF]: 0.05,     // 0.05 µT
      [EMFFrequencyBand.ULF]: 0.02,     // 0.02 µT
      [EMFFrequencyBand.VLF]: 0.01,     // 0.01 µT
      [EMFFrequencyBand.LF]: 0.005,     // 0.005 µT
      [EMFFrequencyBand.MF]: 0.002,     // 0.002 µT
      [EMFFrequencyBand.HF]: 0.001,     // 0.001 µT
      [EMFFrequencyBand.VHF]: 0.0005,   // 0.0005 µT
      [EMFFrequencyBand.UHF]: 0.0002,   // 0.0002 µT
      [EMFFrequencyBand.MICROWAVE]: 0.0001 // 0.0001 µT
    };
    
    return baselevels[band] || 0.01;
  }

  private getCenterFrequencyForBand(band: EMFFrequencyBand): number {
    // Center frequencies for each band in Hz
    const frequencies: Record<EMFFrequencyBand, number> = {
      [EMFFrequencyBand.ELF]: 15,        // 15 Hz
      [EMFFrequencyBand.SLF]: 150,       // 150 Hz
      [EMFFrequencyBand.ULF]: 1500,      // 1.5 kHz
      [EMFFrequencyBand.VLF]: 15000,     // 15 kHz
      [EMFFrequencyBand.LF]: 150000,     // 150 kHz
      [EMFFrequencyBand.MF]: 1500000,    // 1.5 MHz
      [EMFFrequencyBand.HF]: 15000000,   // 15 MHz
      [EMFFrequencyBand.VHF]: 150000000, // 150 MHz
      [EMFFrequencyBand.UHF]: 1500000000, // 1.5 GHz
      [EMFFrequencyBand.MICROWAVE]: 10000000000 // 10 GHz
    };
    
    return frequencies[band] || 1000;
  }

  private generateAudioReadings(timestamp: number): AudioReading[] {
    const readings: AudioReading[] = [];
    
    // Generate baseline audio readings
    const bands: AudioFrequencyBand[] = [
      AudioFrequencyBand.LOW_BASS,
      AudioFrequencyBand.BASS,
      AudioFrequencyBand.MIDRANGE,
      AudioFrequencyBand.BRILLIANCE
    ];

    for (const band of bands) {
      const baseAmplitude = this.getBaseAmplitudeForBand(band);
      const amplitude = baseAmplitude + (Math.random() - 0.5) * 10; // ±5 dB variation
      
      readings.push({
        timestamp,
        frequencyBand: band,
        amplitude,
        frequency: this.getCenterFrequencyForAudioBand(band),
        classification: 'ambient'
      });
    }

    return readings;
  }

  private getBaseAmplitudeForBand(band: AudioFrequencyBand): number {
    // Typical ambient noise levels in dB
    const baseAmplitudes: Record<AudioFrequencyBand, number> = {
      [AudioFrequencyBand.INFRASONIC]: -45,     // Very quiet
      [AudioFrequencyBand.LOW_BASS]: -35,       // Room tone
      [AudioFrequencyBand.BASS]: -30,           // HVAC, traffic
      [AudioFrequencyBand.LOW_MIDRANGE]: -25,   // General ambient
      [AudioFrequencyBand.MIDRANGE]: -20,       // Speech range
      [AudioFrequencyBand.HIGH_MIDRANGE]: -25,  // Reduced presence
      [AudioFrequencyBand.PRESENCE]: -30,       // Electronics, fans
      [AudioFrequencyBand.BRILLIANCE]: -35,     // Air movement
      [AudioFrequencyBand.ULTRASONIC]: -50      // Very quiet
    };
    
    return baseAmplitudes[band] || -30;
  }

  private getCenterFrequencyForAudioBand(band: AudioFrequencyBand): number {
    // Center frequencies for each audio band in Hz
    const frequencies: Record<AudioFrequencyBand, number> = {
      [AudioFrequencyBand.INFRASONIC]: 10,      // 10 Hz
      [AudioFrequencyBand.LOW_BASS]: 40,        // 40 Hz
      [AudioFrequencyBand.BASS]: 155,           // 155 Hz
      [AudioFrequencyBand.LOW_MIDRANGE]: 375,   // 375 Hz
      [AudioFrequencyBand.MIDRANGE]: 1250,      // 1.25 kHz
      [AudioFrequencyBand.HIGH_MIDRANGE]: 3000, // 3 kHz
      [AudioFrequencyBand.PRESENCE]: 5000,      // 5 kHz
      [AudioFrequencyBand.BRILLIANCE]: 13000,   // 13 kHz
      [AudioFrequencyBand.ULTRASONIC]: 25000    // 25 kHz
    };
    
    return frequencies[band] || 1000;
  }

  private calculateProgress(): number {
    if (!this.currentBaseline || !this.isEstablishing) return 0;
    
    const elapsedTime = (Date.now() - this.currentBaseline.timestamp.getTime()) / 1000;
    return Math.min(100, (elapsedTime / this.currentBaseline.duration) * 100);
  }

  private emitProgressUpdates(duration: number): void {
    const updateInterval = Math.max(1000, duration * 10); // Update every 1% or 1 second minimum
    
    const emitProgress = () => {
      if (!this.isEstablishing) return;
      
      const progress = this.calculateProgress();
      this.emit('baseline-progress', {
        progress,
        dataPoints: this.dataBuffer.getSnapshotCount(),
        currentConditions: this.dataBuffer.getCurrentConditions()
      });
      
      if (progress < 100) {
        setTimeout(emitProgress, updateInterval);
      }
    };
    
    setTimeout(emitProgress, updateInterval);
  }

  private async waitForCompletion(duration: number): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const progress = this.calculateProgress();
        if (progress >= 100 || !this.isEstablishing) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      
      checkCompletion();
    });
  }

  private async calculateBaselineStatistics(baseline: EnvironmentalBaseline): Promise<void> {
    const snapshots = this.dataBuffer.getAllSnapshots();
    
    if (snapshots.length === 0) {
      throw new Error('No data collected for baseline calculation');
    }

    // Calculate temperature statistics
    const temperatures = snapshots.map(s => s.temperature);
    baseline.conditions.temperature = this.statisticsCalculator.calculateStats(temperatures);
    
    // Calculate humidity statistics
    const humidities = snapshots.map(s => s.humidity);
    baseline.conditions.humidity = this.statisticsCalculator.calculateStats(humidities);
    
    // Calculate pressure statistics
    const pressures = snapshots.map(s => s.pressure);
    baseline.conditions.pressure = this.statisticsCalculator.calculateStats(pressures);
    
    // Calculate EMF statistics
    this.calculateEMFStatistics(baseline, snapshots);
    
    // Calculate audio statistics
    this.calculateAudioStatistics(baseline, snapshots);
    
    // Calculate motion statistics
    this.calculateMotionStatistics(baseline, snapshots);
    
    logger.debug('Baseline statistics calculated', {
      dataPoints: snapshots.length,
      temperature: baseline.conditions.temperature,
      emfBands: Object.keys(baseline.conditions.emf).length
    });
  }

  private calculateEMFStatistics(baseline: EnvironmentalBaseline, snapshots: EnvironmentalSnapshot[]): void {
    // Group EMF readings by frequency band
    const emfByBand: Map<EMFFrequencyBand, number[]> = new Map();
    
    for (const snapshot of snapshots) {
      for (const reading of snapshot.emfReadings) {
        if (!emfByBand.has(reading.frequencyBand)) {
          emfByBand.set(reading.frequencyBand, []);
        }
        emfByBand.get(reading.frequencyBand)!.push(reading.intensity);
      }
    }
    
    // Calculate statistics for each band
    for (const [band, values] of emfByBand) {
      if (values.length > 0) {
        baseline.conditions.emf[band] = this.statisticsCalculator.calculateStats(values);
      }
    }
  }

  private calculateAudioStatistics(baseline: EnvironmentalBaseline, snapshots: EnvironmentalSnapshot[]): void {
    // Collect audio data
    const allAmplitudes: number[] = [];
    const frequencyMap: Map<number, number> = new Map();
    
    for (const snapshot of snapshots) {
      for (const reading of snapshot.audioReadings) {
        allAmplitudes.push(reading.amplitude);
        
        // Track frequency occurrences
        const freq = Math.round(reading.frequency / 10) * 10; // Round to nearest 10Hz
        frequencyMap.set(freq, (frequencyMap.get(freq) || 0) + 1);
      }
    }
    
    // Calculate background level
    if (allAmplitudes.length > 0) {
      const sorted = allAmplitudes.sort((a, b) => a - b);
      baseline.conditions.audio.backgroundLevel = sorted[Math.floor(sorted.length * 0.1)]; // 10th percentile
    }
    
    // Find dominant frequencies
    const sortedFreqs = Array.from(frequencyMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([freq]) => freq);
    
    baseline.conditions.audio.dominantFrequencies = sortedFreqs;
    
    // Generate spectral profile
    baseline.conditions.audio.spectralProfile = this.generateSpectralProfile(snapshots);
  }

  private generateSpectralProfile(snapshots: EnvironmentalSnapshot[]): Float32Array {
    // Create a simplified spectral profile
    const profile = new Float32Array(64); // 64-bin profile
    const binSize = 22050 / 32; // Assuming 44.1kHz Nyquist, 32 bins to 22kHz
    
    for (const snapshot of snapshots) {
      for (const reading of snapshot.audioReadings) {
        const bin = Math.floor(reading.frequency / binSize);
        if (bin >= 0 && bin < profile.length) {
          profile[bin] += Math.pow(10, reading.amplitude / 20); // Convert dB to linear
        }
      }
    }
    
    // Normalize
    const maxValue = Math.max(...profile);
    if (maxValue > 0) {
      for (let i = 0; i < profile.length; i++) {
        profile[i] /= maxValue;
      }
    }
    
    return profile;
  }

  private calculateMotionStatistics(baseline: EnvironmentalBaseline, snapshots: EnvironmentalSnapshot[]): void {
    const motionValues = snapshots.map(s => s.motionActivity);
    
    // Calculate average motion activity
    baseline.conditions.motion.averageActivity = motionValues.reduce((sum, val) => sum + val, 0) / motionValues.length;
    
    // Identify quiet periods (motion below 10% of average)
    const quietThreshold = baseline.conditions.motion.averageActivity * 0.1;
    const quietPeriods: number[] = [];
    
    let quietStart = -1;
    for (let i = 0; i < snapshots.length; i++) {
      if (motionValues[i] < quietThreshold) {
        if (quietStart === -1) {
          quietStart = snapshots[i].timestamp;
        }
      } else {
        if (quietStart !== -1) {
          quietPeriods.push(quietStart);
          quietStart = -1;
        }
      }
    }
    
    baseline.conditions.motion.quietPeriods = quietPeriods;
    
    // Identify potential noise sources (simplified)
    const noiseSources: string[] = [];
    if (baseline.conditions.audio.backgroundLevel > -20) {
      noiseSources.push('high_ambient_audio');
    }
    if (baseline.conditions.motion.averageActivity > 2) {
      noiseSources.push('mechanical_vibration');
    }
    if (baseline.conditions.emf[EMFFrequencyBand.LF]?.mean && baseline.conditions.emf[EMFFrequencyBand.LF].mean > 0.01) {
      noiseSources.push('electrical_interference');
    }
    
    baseline.conditions.motion.noiseSources = noiseSources;
  }

  addEnvironmentalReading(reading: EnvironmentalReading): void {
    if (!this.isEstablishing) return;
    
    // Convert environmental reading to snapshot data if needed
    // This allows external sensors to contribute to baseline establishment
    this.emit('external-reading-added', reading);
  }

  addEMFReading(reading: EMFReading): void {
    if (!this.isEstablishing) return;
    
    // Add EMF reading to current data collection
    const lastSnapshot = this.dataBuffer.getLastSnapshot();
    if (lastSnapshot && Math.abs(lastSnapshot.timestamp - reading.timestamp) < 2000) {
      lastSnapshot.emfReadings.push(reading);
    }
  }

  addAudioReading(reading: AudioReading): void {
    if (!this.isEstablishing) return;
    
    // Add audio reading to current data collection
    const lastSnapshot = this.dataBuffer.getLastSnapshot();
    if (lastSnapshot && Math.abs(lastSnapshot.timestamp - reading.timestamp) < 2000) {
      lastSnapshot.audioReadings.push(reading);
    }
  }

  addMotionEvent(event: MotionEvent): void {
    if (!this.isEstablishing) return;
    
    // Factor motion event into baseline calculations
    const lastSnapshot = this.dataBuffer.getLastSnapshot();
    if (lastSnapshot && Math.abs(lastSnapshot.timestamp - event.timestamp) < 2000) {
      // Increase motion activity based on event intensity
      const eventIntensity = event.motionRegions.reduce((sum, region) => sum + region.velocity.magnitude, 0);
      lastSnapshot.motionActivity = Math.max(lastSnapshot.motionActivity, eventIntensity / 10);
    }
  }

  getActiveBaseline(): EnvironmentalBaseline | null {
    // Return the most recent active baseline
    const activeBaselines = Array.from(this.activeBaselines.values())
      .filter(b => b.isActive)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return activeBaselines.length > 0 ? activeBaselines[0] : null;
  }

  getAllBaselines(): EnvironmentalBaseline[] {
    return Array.from(this.activeBaselines.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  activateBaseline(baselineId: string): boolean {
    const baseline = this.activeBaselines.get(baselineId);
    if (!baseline) return false;
    
    // Deactivate other baselines
    for (const b of this.activeBaselines.values()) {
      b.isActive = false;
    }
    
    baseline.isActive = true;
    this.emit('baseline-activated', baseline);
    logger.info(`Activated baseline: ${baselineId}`);
    return true;
  }

  deactivateBaseline(baselineId: string): boolean {
    const baseline = this.activeBaselines.get(baselineId);
    if (!baseline) return false;
    
    baseline.isActive = false;
    this.emit('baseline-deactivated', baseline);
    logger.info(`Deactivated baseline: ${baselineId}`);
    return true;
  }

  deleteBaseline(baselineId: string): boolean {
    const baseline = this.activeBaselines.get(baselineId);
    if (!baseline) return false;
    
    this.activeBaselines.delete(baselineId);
    this.emit('baseline-deleted', baseline);
    logger.info(`Deleted baseline: ${baselineId}`);
    return true;
  }

  exportBaseline(baselineId: string): string | null {
    const baseline = this.activeBaselines.get(baselineId);
    if (!baseline) return null;
    
    return JSON.stringify({
      baseline,
      exportTimestamp: new Date().toISOString(),
      version: '1.0'
    }, null, 2);
  }

  importBaseline(baselineData: string): boolean {
    try {
      const data = JSON.parse(baselineData);
      const baseline: EnvironmentalBaseline = data.baseline;
      
      // Validate baseline data
      if (!baseline.id || !baseline.timestamp || !baseline.conditions) {
        throw new Error('Invalid baseline data format');
      }
      
      // Convert timestamp if needed
      if (typeof baseline.timestamp === 'string') {
        baseline.timestamp = new Date(baseline.timestamp);
      }
      
      this.activeBaselines.set(baseline.id, baseline);
      this.emit('baseline-imported', baseline);
      logger.info(`Imported baseline: ${baseline.id}`);
      return true;
    } catch (error) {
      logger.error('Failed to import baseline:', error);
      this.emit('import-error', error);
      return false;
    }
  }

  isEstablishingBaseline(): boolean {
    return this.isEstablishing;
  }

  getCurrentEstablishmentProgress(): number {
    return this.calculateProgress();
  }

  cancelBaseline(): void {
    if (this.isEstablishing) {
      this.isEstablishing = false;
      this.currentBaseline = null;
      this.dataBuffer.clear();
      this.emit('baseline-cancelled');
      logger.info('Baseline establishment cancelled');
    }
  }

  destroy(): void {
    this.cancelBaseline();
    this.activeBaselines.clear();
    this.removeAllListeners();
  }
}

class BaselineDataBuffer {
  private snapshots: EnvironmentalSnapshot[] = [];
  private maxSize = 10000; // Maximum snapshots to keep

  addSnapshot(snapshot: EnvironmentalSnapshot): void {
    this.snapshots.push(snapshot);
    
    if (this.snapshots.length > this.maxSize) {
      this.snapshots.shift(); // Remove oldest
    }
  }

  getAllSnapshots(): EnvironmentalSnapshot[] {
    return [...this.snapshots];
  }

  getLastSnapshot(): EnvironmentalSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  getCurrentConditions(): any {
    if (this.snapshots.length === 0) return null;
    
    const latest = this.snapshots[this.snapshots.length - 1];
    return {
      temperature: latest.temperature,
      humidity: latest.humidity,
      pressure: latest.pressure,
      motionActivity: latest.motionActivity,
      emfCount: latest.emfReadings.length,
      audioLevel: latest.audioReadings.length > 0 ? 
        latest.audioReadings.reduce((sum, r) => sum + r.amplitude, 0) / latest.audioReadings.length : 0
    };
  }

  clear(): void {
    this.snapshots = [];
  }
}

class StatisticsCalculator {
  calculateStats(values: number[]): { mean: number; std: number; range: [number, number] } {
    if (values.length === 0) {
      return { mean: 0, std: 0, range: [0, 0] };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const sorted = [...values].sort((a, b) => a - b);
    const range: [number, number] = [sorted[0], sorted[sorted.length - 1]];

    return { mean, std, range };
  }
}

class BaselineQualityAnalyzer {
  assessQuality(baseline: EnvironmentalBaseline, dataBuffer: BaselineDataBuffer): BaselineQuality {
    const snapshots = dataBuffer.getAllSnapshots();
    
    const dataCompleteness = this.assessDataCompleteness(snapshots);
    const stability = this.assessStability(baseline);
    const consistency = this.assessConsistency(snapshots);
    const duration = this.assessDuration(baseline);
    
    const overallConfidence = (dataCompleteness + stability + consistency + duration) / 4;
    
    return {
      dataCompleteness,
      stability,
      consistency,
      duration,
      overallConfidence,
      issues: this.identifyIssues(baseline, snapshots)
    };
  }

  private assessDataCompleteness(snapshots: EnvironmentalSnapshot[]): number {
    if (snapshots.length < 10) return 0.1;
    if (snapshots.length < 50) return 0.5;
    if (snapshots.length < 100) return 0.7;
    return 1.0;
  }

  private assessStability(baseline: EnvironmentalBaseline): number {
    // Check coefficient of variation for key measurements
    let stabilityScore = 0;
    let measurementCount = 0;

    // Temperature stability
    if (baseline.conditions.temperature.std > 0) {
      const tempCV = baseline.conditions.temperature.std / Math.abs(baseline.conditions.temperature.mean);
      stabilityScore += Math.max(0, 1 - tempCV * 2); // Penalize high variation
      measurementCount++;
    }

    // Pressure stability
    if (baseline.conditions.pressure.std > 0) {
      const pressureCV = baseline.conditions.pressure.std / baseline.conditions.pressure.mean;
      stabilityScore += Math.max(0, 1 - pressureCV * 10);
      measurementCount++;
    }

    // Audio stability
    if (baseline.conditions.audio.backgroundLevel !== 0) {
      // Assume reasonable stability for audio
      stabilityScore += 0.8;
      measurementCount++;
    }

    return measurementCount > 0 ? stabilityScore / measurementCount : 0.5;
  }

  private assessConsistency(snapshots: EnvironmentalSnapshot[]): number {
    // Check for gaps in data collection
    if (snapshots.length < 2) return 0.5;

    const intervals: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      intervals.push(snapshots[i].timestamp - snapshots[i - 1].timestamp);
    }

    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const maxDeviation = Math.max(...intervals.map(i => Math.abs(i - avgInterval)));
    
    // Good consistency if deviations are small
    const consistencyScore = Math.max(0, 1 - (maxDeviation / avgInterval));
    return Math.min(1, consistencyScore);
  }

  private assessDuration(baseline: EnvironmentalBaseline): number {
    // Longer baselines are generally better
    if (baseline.duration < 60) return 0.3;   // < 1 minute
    if (baseline.duration < 300) return 0.6;  // < 5 minutes
    if (baseline.duration < 900) return 0.8;  // < 15 minutes
    return 1.0; // 15+ minutes
  }

  private identifyIssues(baseline: EnvironmentalBaseline, snapshots: EnvironmentalSnapshot[]): string[] {
    const issues: string[] = [];

    if (snapshots.length < 50) {
      issues.push('Insufficient data points');
    }

    if (baseline.duration < 120) {
      issues.push('Collection duration too short');
    }

    if (baseline.conditions.temperature.std > 2) {
      issues.push('High temperature variation');
    }

    if (baseline.conditions.motion.averageActivity > 5) {
      issues.push('High motion activity during baseline');
    }

    if (Object.keys(baseline.conditions.emf).length < 3) {
      issues.push('Limited EMF frequency coverage');
    }

    return issues;
  }
}

interface EnvironmentalSnapshot {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  emfReadings: EMFReading[];
  audioReadings: AudioReading[];
  motionActivity: number;
  lightLevel: number;
  vibration: number;
  magneticField: number;
}

interface BaselineQuality {
  dataCompleteness: number;
  stability: number;
  consistency: number;
  duration: number;
  overallConfidence: number;
  issues: string[];
}