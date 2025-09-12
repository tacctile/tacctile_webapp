// Environmental monitoring services
export { 
  AstronomicalCalculations,
  type MoonPhaseData,
  type SolarData,
  type PlanetaryData,
  type AstronomicalInfluences,
  type Location
} from '../environment/AstronomicalCalculations';

export {
  WeatherEstimationService,
  type PressureReading,
  type WeatherTrend,
  type WeatherPattern,
  type ParanormalWeatherInfluence
} from '../environment/WeatherEstimation';

export {
  GeomagneticActivityEstimator,
  type GeomagneticReading,
  type SolarCycleData,
  type GeomagneticForecast,
  type ParanormalGeomagneticInfluence
} from '../environment/GeomagneticActivityEstimator';

// Location intelligence services
export {
  OfflineGeocodingService,
  createOfflineGeocodingService,
  type GeocodedLocation,
  type LocationSearchOptions,
  type LocationImportData
} from './OfflineGeocodingService';

export {
  MagneticAnomalyService,
  createMagneticAnomalyService,
  type MagneticAnomalyData,
  type MagneticFieldGrid,
  type AnomalySearchOptions,
  type LocalMagneticEnvironment
} from './MagneticAnomalyService';

// Dashboard components
export { EnvironmentalSnapshotDashboard } from '../../components/dashboard/EnvironmentalSnapshotDashboard';
export { EnvironmentalConditionsPanel } from '../../components/dashboard/EnvironmentalConditionsPanel';
export { LocationIntelligencePanel } from '../../components/dashboard/LocationIntelligencePanel';