import { EventEmitter } from 'events';
import {
  ThermalFrame,
  ThermalExportFormat,
  ThermalExportOptions,
  ThermalExportJob,
  ThermalExportResult,
  ThermalDataExportSettings,
  ThermalMetadata,
  TemperatureStatistics
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('ThermalDataExporter');

export class ThermalDataExporter extends EventEmitter {
  private activeJobs: Map<string, ThermalExportJob>;
  private settings: ThermalDataExportSettings;
  private jobCounter: number;

  constructor(settings?: Partial<ThermalDataExportSettings>) {
    super();
    this.activeJobs = new Map();
    this.jobCounter = 0;
    this.settings = {
      defaultFormat: ThermalExportFormat.CSV,
      compression: true,
      includeMetadata: true,
      temperatureUnit: 'celsius',
      precision: 2,
      batchSize: 1000,
      maxConcurrentJobs: 3,
      outputDirectory: './thermal_exports',
      ...settings
    };
  }

  async exportFrames(frames: ThermalFrame[], options: ThermalExportOptions): Promise<ThermalExportJob> {
    if (this.activeJobs.size >= this.settings.maxConcurrentJobs) {
      throw new Error('Maximum concurrent export jobs reached');
    }

    const jobId = `export_${++this.jobCounter}_${Date.now()}`;
    const job: ThermalExportJob = {
      id: jobId,
      status: 'pending',
      format: options.format || this.settings.defaultFormat,
      startTime: new Date(),
      totalFrames: frames.length,
      processedFrames: 0,
      outputPath: options.outputPath || this.generateOutputPath(options.format || this.settings.defaultFormat),
      options: { ...options },
      progress: 0
    };

    this.activeJobs.set(jobId, job);
    this.emit('job-started', job);

    try {
      job.status = 'processing';
      this.emit('job-status-changed', job);

      const result = await this.processExport(frames, job);
      
      job.status = 'completed';
      job.endTime = new Date();
      job.result = result;
      job.progress = 100;
      
      this.emit('job-completed', job);
      logger.info(`Export job completed: ${jobId}`);

      return job;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();
      
      this.emit('job-failed', job);
      logger.error(`Export job failed: ${jobId}`, error);
      
      throw error;
    } finally {
      setTimeout(() => this.activeJobs.delete(jobId), 60000); // Clean up after 1 minute
    }
  }

  private async processExport(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    switch (job.format) {
      case ThermalExportFormat.CSV:
        return await this.exportToCSV(frames, job);
      case ThermalExportFormat.JSON:
        return await this.exportToJSON(frames, job);
      case ThermalExportFormat.XLSX:
        return await this.exportToXLSX(frames, job);
      case ThermalExportFormat.MAT:
        return await this.exportToMAT(frames, job);
      case ThermalExportFormat.HDF5:
        return await this.exportToHDF5(frames, job);
      case ThermalExportFormat.NETCDF:
        return await this.exportToNetCDF(frames, job);
      case ThermalExportFormat.GEOTIFF:
        return await this.exportToGeoTIFF(frames, job);
      case ThermalExportFormat.RADIOMETRIC_TIFF:
        return await this.exportToRadiometricTIFF(frames, job);
      default:
        throw new Error(`Unsupported export format: ${job.format}`);
    }
  }

  private async exportToCSV(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    const fs = await import('fs').then(m => m.promises);
    let csvContent = '';

    // Header
    if (job.options.includeHeaders !== false) {
      csvContent += this.generateCSVHeader(frames[0]);
    }

    // Process frames in batches
    for (let i = 0; i < frames.length; i += this.settings.batchSize) {
      const batch = frames.slice(i, i + this.settings.batchSize);
      
      for (const frame of batch) {
        csvContent += this.frameToCSV(frame, job.options);
        job.processedFrames++;
        job.progress = (job.processedFrames / job.totalFrames) * 100;
        this.emit('job-progress', job);
      }

      // Write batch to file
      if (i === 0) {
        await fs.writeFile(job.outputPath, csvContent, 'utf8');
      } else {
        await fs.appendFile(job.outputPath, csvContent.substring(csvContent.indexOf('\n') + 1), 'utf8');
      }
      
      csvContent = ''; // Reset for next batch
    }

    const stats = await fs.stat(job.outputPath);
    return {
      success: true,
      outputPath: job.outputPath,
      fileSize: stats.size,
      format: job.format,
      framesExported: job.processedFrames,
      metadata: this.generateExportMetadata(frames, job)
    };
  }

  private generateCSVHeader(sampleFrame: ThermalFrame): string {
    const headers = ['timestamp', 'frameNumber', 'x', 'y', 'temperature'];
    
    if (this.settings.includeMetadata) {
      headers.push('minTemp', 'maxTemp', 'avgTemp', 'emissivity', 'reflectedTemp', 'ambientTemp');
    }
    
    return headers.join(',') + '\n';
  }

  private frameToCSV(frame: ThermalFrame, options: ThermalExportOptions): string {
    const precision = this.settings.precision;
    let csv = '';

    // Export pixel-by-pixel data or statistical summary
    if (options.exportMode === 'pixels') {
      for (let i = 0; i < frame.temperatureData.length; i++) {
        const x = i % frame.width;
        const y = Math.floor(i / frame.width);
        const temp = frame.temperatureData[i].toFixed(precision);

        let row = `${frame.timestamp},${frame.frameNumber},${x},${y},${temp}`;
        
        if (this.settings.includeMetadata) {
          row += `,${frame.minTemp.toFixed(precision)},${frame.maxTemp.toFixed(precision)},${frame.avgTemp.toFixed(precision)}`;
          row += `,${frame.emissivity},${frame.reflectedTemp.toFixed(precision)},${frame.ambientTemp.toFixed(precision)}`;
        }
        
        csv += row + '\n';
      }
    } else {
      // Statistical summary only
      let row = `${frame.timestamp},${frame.frameNumber},-1,-1,${frame.avgTemp.toFixed(precision)}`;
      
      if (this.settings.includeMetadata) {
        row += `,${frame.minTemp.toFixed(precision)},${frame.maxTemp.toFixed(precision)},${frame.avgTemp.toFixed(precision)}`;
        row += `,${frame.emissivity},${frame.reflectedTemp.toFixed(precision)},${frame.ambientTemp.toFixed(precision)}`;
      }
      
      csv += row + '\n';
    }

    return csv;
  }

  private async exportToJSON(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    const fs = await import('fs').then(m => m.promises);

    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        format: 'JSON',
        version: '1.0',
        frameCount: frames.length,
        settings: this.settings
      },
      frames: frames.map(frame => this.frameToJSON(frame, job.options))
    };

    const jsonString = JSON.stringify(exportData, null, job.options.prettyPrint ? 2 : 0);
    await fs.writeFile(job.outputPath, jsonString, 'utf8');

    job.processedFrames = job.totalFrames;
    job.progress = 100;
    this.emit('job-progress', job);

    const stats = await fs.stat(job.outputPath);
    return {
      success: true,
      outputPath: job.outputPath,
      fileSize: stats.size,
      format: job.format,
      framesExported: frames.length,
      metadata: this.generateExportMetadata(frames, job)
    };
  }

  private frameToJSON(frame: ThermalFrame, options: ThermalExportOptions): any {
    const frameData: any = {
      timestamp: frame.timestamp,
      frameNumber: frame.frameNumber,
      dimensions: {
        width: frame.width,
        height: frame.height
      },
      statistics: {
        minTemp: +frame.minTemp.toFixed(this.settings.precision),
        maxTemp: +frame.maxTemp.toFixed(this.settings.precision),
        avgTemp: +frame.avgTemp.toFixed(this.settings.precision)
      }
    };

    if (options.exportMode === 'pixels') {
      frameData.temperatureData = Array.from(frame.temperatureData).map(temp => 
        +temp.toFixed(this.settings.precision)
      );
    }

    if (this.settings.includeMetadata) {
      frameData.metadata = {
        emissivity: frame.emissivity,
        reflectedTemp: +frame.reflectedTemp.toFixed(this.settings.precision),
        ambientTemp: +frame.ambientTemp.toFixed(this.settings.precision),
        ...frame.metadata
      };
    }

    return frameData;
  }

  private async exportToXLSX(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    // This would require a library like xlsx or exceljs
    // For now, return a placeholder implementation
    logger.warn('XLSX export not fully implemented - requires xlsx library');
    
    // Fallback to CSV for now
    return await this.exportToCSV(frames, job);
  }

  private async exportToMAT(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    // MATLAB .mat file export would require a specialized library
    logger.warn('MAT export not fully implemented - requires matlab file library');
    
    // Create a JSON structure suitable for MATLAB import
    const matData = {
      frames: frames.map(frame => ({
        timestamp: frame.timestamp,
        frameNumber: frame.frameNumber,
        width: frame.width,
        height: frame.height,
        temperatureData: Array.from(frame.temperatureData),
        minTemp: frame.minTemp,
        maxTemp: frame.maxTemp,
        avgTemp: frame.avgTemp,
        emissivity: frame.emissivity,
        reflectedTemp: frame.reflectedTemp,
        ambientTemp: frame.ambientTemp
      }))
    };

    const fs = await import('fs').then(m => m.promises);
    const jsonPath = job.outputPath.replace('.mat', '_for_matlab.json');
    await fs.writeFile(jsonPath, JSON.stringify(matData, null, 2), 'utf8');

    job.processedFrames = job.totalFrames;
    job.progress = 100;
    this.emit('job-progress', job);

    const stats = await fs.stat(jsonPath);
    return {
      success: true,
      outputPath: jsonPath,
      fileSize: stats.size,
      format: job.format,
      framesExported: frames.length,
      metadata: this.generateExportMetadata(frames, job)
    };
  }

  private async exportToHDF5(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    // HDF5 export would require a specialized library like hdf5.js or similar
    logger.warn('HDF5 export not fully implemented - requires HDF5 library');
    
    // Fallback to JSON with HDF5-like structure
    return await this.exportToJSON(frames, job);
  }

  private async exportToNetCDF(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    // NetCDF export would require netcdf4-js or similar
    logger.warn('NetCDF export not fully implemented - requires NetCDF library');
    
    // Fallback to JSON with NetCDF-like structure
    return await this.exportToJSON(frames, job);
  }

  private async exportToGeoTIFF(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    // GeoTIFF export would require geotiff or gdal-js
    logger.warn('GeoTIFF export not fully implemented - requires GeoTIFF library');
    
    // For now, export as TIFF-like structure
    return await this.exportToRadiometricTIFF(frames, job);
  }

  private async exportToRadiometricTIFF(frames: ThermalFrame[], job: ThermalExportJob): Promise<ThermalExportResult> {
    // Radiometric TIFF would preserve temperature data in specialized format
    // This requires a specialized TIFF library with radiometric support
    logger.warn('Radiometric TIFF export not fully implemented - requires specialized TIFF library');
    
    const fs = await import('fs').then(m => m.promises);
    
    // Create a text-based TIFF description with temperature data
    const tiffData = {
      description: 'Radiometric Thermal Data',
      imageWidth: frames[0].width,
      imageLength: frames[0].height,
      framesCount: frames.length,
      temperatureUnit: this.settings.temperatureUnit,
      precision: this.settings.precision,
      frames: frames.map(frame => ({
        timestamp: frame.timestamp,
        frameNumber: frame.frameNumber,
        temperatureData: Array.from(frame.temperatureData),
        calibration: {
          emissivity: frame.emissivity,
          reflectedTemp: frame.reflectedTemp,
          ambientTemp: frame.ambientTemp
        },
        statistics: {
          minTemp: frame.minTemp,
          maxTemp: frame.maxTemp,
          avgTemp: frame.avgTemp
        }
      }))
    };

    const outputPath = job.outputPath.replace('.tiff', '_radiometric.json');
    await fs.writeFile(outputPath, JSON.stringify(tiffData, null, 2), 'utf8');

    job.processedFrames = job.totalFrames;
    job.progress = 100;
    this.emit('job-progress', job);

    const stats = await fs.stat(outputPath);
    return {
      success: true,
      outputPath: outputPath,
      fileSize: stats.size,
      format: job.format,
      framesExported: frames.length,
      metadata: this.generateExportMetadata(frames, job)
    };
  }

  private generateOutputPath(format: ThermalExportFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = this.getFileExtension(format);
    return `${this.settings.outputDirectory}/thermal_export_${timestamp}.${extension}`;
  }

  private getFileExtension(format: ThermalExportFormat): string {
    const extensions: Record<ThermalExportFormat, string> = {
      [ThermalExportFormat.CSV]: 'csv',
      [ThermalExportFormat.JSON]: 'json',
      [ThermalExportFormat.XLSX]: 'xlsx',
      [ThermalExportFormat.MAT]: 'mat',
      [ThermalExportFormat.HDF5]: 'h5',
      [ThermalExportFormat.NETCDF]: 'nc',
      [ThermalExportFormat.GEOTIFF]: 'tif',
      [ThermalExportFormat.RADIOMETRIC_TIFF]: 'tif'
    };
    return extensions[format] || 'dat';
  }

  private generateExportMetadata(frames: ThermalFrame[], job: ThermalExportJob): ThermalMetadata {
    const temperatures = frames.flatMap(frame => Array.from(frame.temperatureData));
    const statistics = this.calculateStatistics(temperatures);

    return {
      exportDate: new Date().toISOString(),
      totalFrames: frames.length,
      totalPixels: frames.reduce((sum, frame) => sum + frame.temperatureData.length, 0),
      timeRange: {
        start: Math.min(...frames.map(f => f.timestamp)),
        end: Math.max(...frames.map(f => f.timestamp))
      },
      temperatureRange: {
        min: Math.min(...frames.map(f => f.minTemp)),
        max: Math.max(...frames.map(f => f.maxTemp)),
        avg: statistics.mean
      },
      settings: this.settings,
      format: job.format,
      compressionUsed: this.settings.compression,
      exportOptions: job.options
    };
  }

  private calculateStatistics(data: number[]): TemperatureStatistics {
    if (data.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, percentiles: {} };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / data.length;
    
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev,
      percentiles: {
        p5: sorted[Math.floor(sorted.length * 0.05)],
        p25: sorted[Math.floor(sorted.length * 0.25)],
        p75: sorted[Math.floor(sorted.length * 0.75)],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      }
    };
  }

  getActiveJobs(): ThermalExportJob[] {
    return Array.from(this.activeJobs.values());
  }

  getJobStatus(jobId: string): ThermalExportJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    job.status = 'cancelled';
    job.endTime = new Date();
    this.emit('job-cancelled', job);
    this.activeJobs.delete(jobId);
    
    logger.info(`Export job cancelled: ${jobId}`);
    return true;
  }

  updateSettings(newSettings: Partial<ThermalDataExportSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settings-updated', this.settings);
  }

  getSettings(): ThermalDataExportSettings {
    return { ...this.settings };
  }

  getSupportedFormats(): ThermalExportFormat[] {
    return Object.values(ThermalExportFormat);
  }

  destroy(): void {
    // Cancel all active jobs
    for (const jobId of this.activeJobs.keys()) {
      this.cancelJob(jobId);
    }
    this.removeAllListeners();
  }
}