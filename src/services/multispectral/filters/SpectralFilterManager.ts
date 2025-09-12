import { EventEmitter } from 'events';
import {
  SpectralFilter,
  SpectralFilterType,
  SpectralBand,
  PolarizationState,
  FilterWheel,
  MultiSpectralEvent,
  SPECTRAL_BAND_INFO
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('SpectralFilterManager');

export class SpectralFilterManager extends EventEmitter {
  private filterWheel?: FilterWheel;
  private availableFilters: Map<string, SpectralFilter>;
  private filterLibrary: Map<string, SpectralFilter[]>;
  private calibrationData: Map<string, FilterCalibrationData>;
  private currentFilter?: SpectralFilter;
  private isMoving: boolean;

  constructor() {
    super();
    this.availableFilters = new Map();
    this.filterLibrary = new Map();
    this.calibrationData = new Map();
    this.isMoving = false;
    
    this.initializeStandardFilters();
  }

  private initializeStandardFilters(): void {
    // UV Filters
    const uvFilters = this.createUVFilters();
    this.filterLibrary.set('uv', uvFilters);
    
    // Visible Light Filters  
    const visibleFilters = this.createVisibleFilters();
    this.filterLibrary.set('visible', visibleFilters);
    
    // IR Filters
    const irFilters = this.createIRFilters();
    this.filterLibrary.set('ir', irFilters);
    
    // Polarizing Filters
    const polarizingFilters = this.createPolarizingFilters();
    this.filterLibrary.set('polarizing', polarizingFilters);
    
    // Neutral Density Filters
    const ndFilters = this.createNeutralDensityFilters();
    this.filterLibrary.set('nd', ndFilters);
    
    // Add all filters to available filters map
    this.filterLibrary.forEach(filters => {
      filters.forEach(filter => {
        this.availableFilters.set(filter.id, filter);
      });
    });
    
    logger.info(`Initialized ${this.availableFilters.size} standard filters`);
  }

  private createUVFilters(): SpectralFilter[] {
    return [
      {
        id: 'uv-pass-365',
        name: 'UV Pass 365nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.UV_A,
        centerWavelength: 365,
        bandwidth: 40,
        transmittance: 0.85,
        manufacturer: 'Chroma Technology',
        partNumber: 'ET365/40x',
        isActive: false
      },
      {
        id: 'uv-pass-310',
        name: 'UV Pass 310nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.UV_B,
        centerWavelength: 310,
        bandwidth: 25,
        transmittance: 0.80,
        manufacturer: 'Thorlabs',
        partNumber: 'FB310-25',
        isActive: false
      },
      {
        id: 'uv-pass-280',
        name: 'UV Pass 280nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.UV_B,
        centerWavelength: 280,
        bandwidth: 20,
        transmittance: 0.75,
        manufacturer: 'Edmund Optics',
        partNumber: '65-125',
        isActive: false
      },
      {
        id: 'uv-longpass-300',
        name: 'UV Longpass 300nm',
        type: SpectralFilterType.LONGPASS,
        spectralBand: SpectralBand.UV_A,
        centerWavelength: 300,
        bandwidth: 200,
        transmittance: 0.90,
        manufacturer: 'Semrock',
        partNumber: 'LP02-300RU',
        isActive: false
      },
      {
        id: 'uv-shortpass-400',
        name: 'UV Shortpass 400nm',
        type: SpectralFilterType.SHORTPASS,
        spectralBand: SpectralBand.UV_A,
        centerWavelength: 350,
        bandwidth: 150,
        transmittance: 0.88,
        manufacturer: 'Omega Optical',
        partNumber: '3RD400SP',
        isActive: false
      }
    ];
  }

  private createVisibleFilters(): SpectralFilter[] {
    return [
      {
        id: 'red-pass-650',
        name: 'Red Pass 650nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.RED,
        centerWavelength: 650,
        bandwidth: 50,
        transmittance: 0.92,
        manufacturer: 'Chroma Technology',
        partNumber: 'ET650/50m',
        isActive: false
      },
      {
        id: 'green-pass-525',
        name: 'Green Pass 525nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.GREEN,
        centerWavelength: 525,
        bandwidth: 45,
        transmittance: 0.94,
        manufacturer: 'Semrock',
        partNumber: 'FF01-525/45',
        isActive: false
      },
      {
        id: 'blue-pass-470',
        name: 'Blue Pass 470nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.BLUE,
        centerWavelength: 470,
        bandwidth: 40,
        transmittance: 0.90,
        manufacturer: 'Thorlabs',
        partNumber: 'FB470-40',
        isActive: false
      },
      {
        id: 'visible-longpass-400',
        name: 'Visible Longpass 400nm',
        type: SpectralFilterType.LONGPASS,
        spectralBand: SpectralBand.VISIBLE,
        centerWavelength: 550,
        bandwidth: 300,
        transmittance: 0.95,
        manufacturer: 'Edmund Optics',
        partNumber: '84-755',
        isActive: false
      }
    ];
  }

  private createIRFilters(): SpectralFilter[] {
    return [
      {
        id: 'nir-pass-850',
        name: 'NIR Pass 850nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.NIR,
        centerWavelength: 850,
        bandwidth: 40,
        transmittance: 0.88,
        manufacturer: 'Chroma Technology',
        partNumber: 'ET850/40m',
        isActive: false
      },
      {
        id: 'nir-longpass-700',
        name: 'NIR Longpass 700nm',
        type: SpectralFilterType.LONGPASS,
        spectralBand: SpectralBand.NIR,
        centerWavelength: 850,
        bandwidth: 300,
        transmittance: 0.92,
        manufacturer: 'Thorlabs',
        partNumber: 'FEL0700',
        isActive: false
      },
      {
        id: 'swir-pass-1550',
        name: 'SWIR Pass 1550nm',
        type: SpectralFilterType.BANDPASS,
        spectralBand: SpectralBand.SWIR,
        centerWavelength: 1550,
        bandwidth: 100,
        transmittance: 0.85,
        manufacturer: 'Semrock',
        partNumber: 'FF01-1550/100',
        isActive: false
      },
      {
        id: 'ir-cut-700',
        name: 'IR Cut 700nm',
        type: SpectralFilterType.SHORTPASS,
        spectralBand: SpectralBand.VISIBLE,
        centerWavelength: 600,
        bandwidth: 400,
        transmittance: 0.96,
        manufacturer: 'Edmund Optics',
        partNumber: '46-098',
        isActive: false
      }
    ];
  }

  private createPolarizingFilters(): SpectralFilter[] {
    return [
      {
        id: 'linear-pol-0',
        name: 'Linear Polarizer 0°',
        type: SpectralFilterType.POLARIZING,
        spectralBand: SpectralBand.VISIBLE,
        centerWavelength: 550,
        bandwidth: 500,
        transmittance: 0.45,
        polarization: PolarizationState.LINEAR_0,
        manufacturer: 'Thorlabs',
        partNumber: 'LPVIS050',
        isActive: false
      },
      {
        id: 'linear-pol-45',
        name: 'Linear Polarizer 45°',
        type: SpectralFilterType.POLARIZING,
        spectralBand: SpectralBand.VISIBLE,
        centerWavelength: 550,
        bandwidth: 500,
        transmittance: 0.45,
        polarization: PolarizationState.LINEAR_45,
        manufacturer: 'Thorlabs',
        partNumber: 'LPVIS050-45',
        isActive: false
      },
      {
        id: 'linear-pol-90',
        name: 'Linear Polarizer 90°',
        type: SpectralFilterType.POLARIZING,
        spectralBand: SpectralBand.VISIBLE,
        centerWavelength: 550,
        bandwidth: 500,
        transmittance: 0.45,
        polarization: PolarizationState.LINEAR_90,
        manufacturer: 'Thorlabs',
        partNumber: 'LPVIS050-90',
        isActive: false
      },
      {
        id: 'circular-pol-left',
        name: 'Circular Polarizer Left',
        type: SpectralFilterType.POLARIZING,
        spectralBand: SpectralBand.VISIBLE,
        centerWavelength: 550,
        bandwidth: 500,
        transmittance: 0.40,
        polarization: PolarizationState.CIRCULAR_LEFT,
        manufacturer: 'Edmund Optics',
        partNumber: '62-532',
        isActive: false
      }
    ];
  }

  private createNeutralDensityFilters(): SpectralFilter[] {
    return [
      {
        id: 'nd-03',
        name: 'ND 0.3 (50% Trans)',
        type: SpectralFilterType.NEUTRAL_DENSITY,
        spectralBand: SpectralBand.FULL_SPECTRUM,
        centerWavelength: 550,
        bandwidth: 1000,
        transmittance: 0.50,
        manufacturer: 'Thorlabs',
        partNumber: 'NE03A',
        isActive: false
      },
      {
        id: 'nd-06',
        name: 'ND 0.6 (25% Trans)',
        type: SpectralFilterType.NEUTRAL_DENSITY,
        spectralBand: SpectralBand.FULL_SPECTRUM,
        centerWavelength: 550,
        bandwidth: 1000,
        transmittance: 0.25,
        manufacturer: 'Thorlabs',
        partNumber: 'NE06A',
        isActive: false
      },
      {
        id: 'nd-10',
        name: 'ND 1.0 (10% Trans)',
        type: SpectralFilterType.NEUTRAL_DENSITY,
        spectralBand: SpectralBand.FULL_SPECTRUM,
        centerWavelength: 550,
        bandwidth: 1000,
        transmittance: 0.10,
        manufacturer: 'Thorlabs',
        partNumber: 'NE10A',
        isActive: false
      },
      {
        id: 'nd-20',
        name: 'ND 2.0 (1% Trans)',
        type: SpectralFilterType.NEUTRAL_DENSITY,
        spectralBand: SpectralBand.FULL_SPECTRUM,
        centerWavelength: 550,
        bandwidth: 1000,
        transmittance: 0.01,
        manufacturer: 'Thorlabs',
        partNumber: 'NE20A',
        isActive: false
      }
    ];
  }

  async initializeFilterWheel(wheelConfig: Partial<FilterWheel>): Promise<boolean> {
    try {
      this.filterWheel = {
        id: wheelConfig.id || 'fw-default',
        name: wheelConfig.name || 'Default Filter Wheel',
        positions: wheelConfig.positions || 8,
        currentPosition: 0,
        filters: new Array(wheelConfig.positions || 8).fill(null),
        isMoving: false,
        homePosition: 0,
        speed: wheelConfig.speed || 2.0
      };

      // Initialize filter wheel hardware connection
      await this.connectFilterWheel();
      
      // Home the filter wheel
      await this.homeFilterWheel();
      
      this.emit('filter-wheel-initialized', this.filterWheel);
      logger.info(`Filter wheel initialized: ${this.filterWheel.name}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize filter wheel:', error);
      this.emit('error', error);
      return false;
    }
  }

  private async connectFilterWheel(): Promise<void> {
    // Simulate hardware connection
    logger.info('Connecting to filter wheel...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    logger.info('Filter wheel connected successfully');
  }

  private async homeFilterWheel(): Promise<void> {
    if (!this.filterWheel) throw new Error('Filter wheel not initialized');
    
    logger.info('Homing filter wheel...');
    this.filterWheel.isMoving = true;
    this.emit('wheel-moving', true);
    
    // Simulate homing movement
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.filterWheel.currentPosition = this.filterWheel.homePosition;
    this.filterWheel.isMoving = false;
    this.emit('wheel-moved', this.filterWheel.currentPosition);
    this.emit('wheel-moving', false);
    
    logger.info('Filter wheel homed to position 0');
  }

  async installFilter(filterId: string, position: number): Promise<boolean> {
    if (!this.filterWheel) {
      throw new Error('Filter wheel not initialized');
    }

    if (position < 0 || position >= this.filterWheel.positions) {
      throw new Error(`Invalid position: ${position}. Valid range: 0-${this.filterWheel.positions - 1}`);
    }

    const filter = this.availableFilters.get(filterId);
    if (!filter) {
      throw new Error(`Filter not found: ${filterId}`);
    }

    try {
      // Update filter position
      filter.position = position;
      this.filterWheel.filters[position] = { ...filter };
      
      logger.info(`Installed filter ${filter.name} at position ${position}`);
      this.emit('filter-installed', { filter, position });
      
      return true;
    } catch (error) {
      logger.error(`Failed to install filter ${filterId} at position ${position}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  async removeFilter(position: number): Promise<boolean> {
    if (!this.filterWheel) {
      throw new Error('Filter wheel not initialized');
    }

    if (position < 0 || position >= this.filterWheel.positions) {
      throw new Error(`Invalid position: ${position}`);
    }

    try {
      const removedFilter = this.filterWheel.filters[position];
      this.filterWheel.filters[position] = null;
      
      if (removedFilter) {
        removedFilter.position = undefined;
        logger.info(`Removed filter ${removedFilter.name} from position ${position}`);
        this.emit('filter-removed', { filter: removedFilter, position });
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to remove filter from position ${position}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  async selectFilter(filterId: string): Promise<boolean> {
    const filter = this.availableFilters.get(filterId);
    if (!filter) {
      throw new Error(`Filter not found: ${filterId}`);
    }

    if (filter.position === undefined) {
      throw new Error(`Filter ${filter.name} is not installed in filter wheel`);
    }

    return await this.moveToPosition(filter.position);
  }

  async moveToPosition(position: number): Promise<boolean> {
    if (!this.filterWheel) {
      throw new Error('Filter wheel not initialized');
    }

    if (this.filterWheel.isMoving) {
      throw new Error('Filter wheel is already moving');
    }

    if (position < 0 || position >= this.filterWheel.positions) {
      throw new Error(`Invalid position: ${position}`);
    }

    if (position === this.filterWheel.currentPosition) {
      logger.debug(`Already at position ${position}`);
      return true;
    }

    try {
      logger.info(`Moving filter wheel from position ${this.filterWheel.currentPosition} to ${position}`);
      
      this.filterWheel.isMoving = true;
      this.isMoving = true;
      this.emit('wheel-moving', true);
      
      // Calculate movement time based on distance and speed
      const distance = Math.abs(position - this.filterWheel.currentPosition);
      const movementTime = (distance / this.filterWheel.speed) * 1000;
      
      // Simulate movement
      await new Promise(resolve => setTimeout(resolve, Math.max(movementTime, 200)));
      
      // Update position
      this.filterWheel.currentPosition = position;
      this.filterWheel.isMoving = false;
      this.isMoving = false;
      
      // Update current filter
      const newFilter = this.filterWheel.filters[position];
      if (this.currentFilter) {
        this.currentFilter.isActive = false;
      }
      
      this.currentFilter = newFilter || undefined;
      if (this.currentFilter) {
        this.currentFilter.isActive = true;
      }
      
      this.emit('wheel-moved', position);
      this.emit('wheel-moving', false);
      this.emit('filter-changed', this.currentFilter);
      
      logger.info(`Filter wheel moved to position ${position}. Current filter: ${this.currentFilter?.name || 'none'}`);
      return true;
    } catch (error) {
      this.filterWheel.isMoving = false;
      this.isMoving = false;
      this.emit('wheel-moving', false);
      this.emit('error', error);
      logger.error(`Failed to move filter wheel to position ${position}:`, error);
      return false;
    }
  }

  async calibrateFilter(filterId: string, calibrationData: FilterCalibrationData): Promise<boolean> {
    const filter = this.availableFilters.get(filterId);
    if (!filter) {
      throw new Error(`Filter not found: ${filterId}`);
    }

    try {
      // Store calibration data
      this.calibrationData.set(filterId, calibrationData);
      
      // Update filter transmittance with calibrated value if provided
      if (calibrationData.measuredTransmittance !== undefined) {
        filter.transmittance = calibrationData.measuredTransmittance;
      }

      logger.info(`Filter ${filter.name} calibrated successfully`);
      this.emit('filter-calibrated', { filter, calibrationData });
      
      return true;
    } catch (error) {
      logger.error(`Failed to calibrate filter ${filterId}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  getOptimalFilterForBand(band: SpectralBand): SpectralFilter[] {
    const suitableFilters: SpectralFilter[] = [];
    
    for (const filter of this.availableFilters.values()) {
      if (filter.spectralBand === band || filter.spectralBand === SpectralBand.FULL_SPECTRUM) {
        const bandInfo = SPECTRAL_BAND_INFO[band];
        const centerWavelength = (bandInfo.wavelengthRange.min + bandInfo.wavelengthRange.max) / 2;
        
        // Check if filter wavelength range overlaps with band
        const filterMin = filter.centerWavelength - filter.bandwidth / 2;
        const filterMax = filter.centerWavelength + filter.bandwidth / 2;
        
        if (filterMin <= bandInfo.wavelengthRange.max && filterMax >= bandInfo.wavelengthRange.min) {
          suitableFilters.push(filter);
        }
      }
    }
    
    // Sort by transmittance (higher is better) and bandwidth match
    return suitableFilters.sort((a, b) => {
      const aMatch = this.calculateBandMatch(a, band);
      const bMatch = this.calculateBandMatch(b, band);
      return bMatch - aMatch;
    });
  }

  private calculateBandMatch(filter: SpectralFilter, band: SpectralBand): number {
    const bandInfo = SPECTRAL_BAND_INFO[band];
    const bandCenter = (bandInfo.wavelengthRange.min + bandInfo.wavelengthRange.max) / 2;
    const bandWidth = bandInfo.wavelengthRange.max - bandInfo.wavelengthRange.min;
    
    // Calculate wavelength center difference
    const centerDiff = Math.abs(filter.centerWavelength - bandCenter);
    const centerScore = Math.max(0, 1 - (centerDiff / bandCenter));
    
    // Calculate bandwidth match
    const widthDiff = Math.abs(filter.bandwidth - bandWidth);
    const widthScore = Math.max(0, 1 - (widthDiff / bandWidth));
    
    // Calculate transmittance score
    const transScore = filter.transmittance;
    
    // Combined score
    return (centerScore * 0.4 + widthScore * 0.3 + transScore * 0.3);
  }

  getFilterSequenceForBands(bands: SpectralBand[]): SpectralFilter[] {
    const sequence: SpectralFilter[] = [];
    
    for (const band of bands) {
      const optimalFilters = this.getOptimalFilterForBand(band);
      if (optimalFilters.length > 0) {
        const bestFilter = optimalFilters[0];
        // Check if filter is installed in wheel
        if (bestFilter.position !== undefined) {
          sequence.push(bestFilter);
        } else {
          logger.warn(`Optimal filter for ${band} (${bestFilter.name}) is not installed`);
          // Try to find an installed alternative
          const installedFilter = optimalFilters.find(f => f.position !== undefined);
          if (installedFilter) {
            sequence.push(installedFilter);
          } else {
            logger.warn(`No installed filter found for ${band}`);
          }
        }
      } else {
        logger.warn(`No suitable filter found for ${band}`);
      }
    }
    
    return sequence;
  }

  addCustomFilter(filter: Omit<SpectralFilter, 'isActive'>): boolean {
    try {
      const completeFilter: SpectralFilter = {
        ...filter,
        isActive: false
      };
      
      this.availableFilters.set(filter.id, completeFilter);
      
      // Add to appropriate library category
      const category = this.getCategoryForFilter(completeFilter);
      if (!this.filterLibrary.has(category)) {
        this.filterLibrary.set(category, []);
      }
      this.filterLibrary.get(category)!.push(completeFilter);
      
      this.emit('filter-added', completeFilter);
      logger.info(`Added custom filter: ${filter.name}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to add custom filter:`, error);
      this.emit('error', error);
      return false;
    }
  }

  private getCategoryForFilter(filter: SpectralFilter): string {
    switch (filter.type) {
      case SpectralFilterType.POLARIZING:
        return 'polarizing';
      case SpectralFilterType.NEUTRAL_DENSITY:
        return 'nd';
      default:
        if ([SpectralBand.UV_A, SpectralBand.UV_B, SpectralBand.UV_C].includes(filter.spectralBand)) {
          return 'uv';
        } else if ([SpectralBand.NIR, SpectralBand.SWIR, SpectralBand.MWIR, SpectralBand.LWIR].includes(filter.spectralBand)) {
          return 'ir';
        } else {
          return 'visible';
        }
    }
  }

  getCurrentFilter(): SpectralFilter | null {
    return this.currentFilter || null;
  }

  getAvailableFilters(category?: string): SpectralFilter[] {
    if (category && this.filterLibrary.has(category)) {
      return [...this.filterLibrary.get(category)!];
    }
    return Array.from(this.availableFilters.values());
  }

  getInstalledFilters(): (SpectralFilter | null)[] {
    return this.filterWheel ? [...this.filterWheel.filters] : [];
  }

  getFilterWheelStatus(): FilterWheel | null {
    return this.filterWheel ? { ...this.filterWheel } : null;
  }

  getFilterCalibration(filterId: string): FilterCalibrationData | null {
    return this.calibrationData.get(filterId) || null;
  }

  isWheelMoving(): boolean {
    return this.isMoving;
  }

  async emergencyStop(): Promise<void> {
    if (this.filterWheel && this.filterWheel.isMoving) {
      logger.warn('Emergency stop triggered for filter wheel');
      
      this.filterWheel.isMoving = false;
      this.isMoving = false;
      this.emit('wheel-moving', false);
      this.emit('emergency-stop');
    }
  }

  destroy(): void {
    if (this.filterWheel) {
      this.filterWheel.isMoving = false;
    }
    
    this.availableFilters.clear();
    this.filterLibrary.clear();
    this.calibrationData.clear();
    this.currentFilter = undefined;
    this.isMoving = false;
    
    this.removeAllListeners();
  }
}

interface FilterCalibrationData {
  timestamp: Date;
  measuredTransmittance?: number;
  spectralResponse?: number[];
  temperatureCoefficient?: number;
  uniformity?: {
    center: number;
    edge: number;
    variation: number;
  };
  quality: {
    opticalDensity: number;
    surfaceQuality: string;
    parallelism: number;
  };
  notes?: string;
}