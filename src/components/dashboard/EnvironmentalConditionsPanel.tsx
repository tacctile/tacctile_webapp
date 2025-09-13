import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Box, 
  Chip, 
  LinearProgress,
  Alert,
  IconButton
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { AstronomicalCalculations, MoonPhaseData, SolarData } from '../../services/environment/AstronomicalCalculations';
import { WeatherEstimationService, WeatherPattern, PressureReading } from '../../services/environment/WeatherEstimation';
import { GeomagneticActivityEstimator, GeomagneticReading, SolarCycleData } from '../../services/environment/GeomagneticActivityEstimator';

interface EnvironmentalConditionsPanelProps {
  location: { latitude: number; longitude: number; elevation?: number };
  onLocationChange?: (location: { latitude: number; longitude: number; elevation?: number }) => void;
  autoRefresh?: boolean;
  refreshInterval?: number; // minutes
}

interface EnvironmentalSummary {
  astronomical: {
    moonPhase: MoonPhaseData;
    solarData: SolarData;
    paranormalOptimal: boolean;
    recommendations: string[];
  };
  weather: {
    currentPressure: PressureReading | null;
    pattern: WeatherPattern;
    forecast: string[];
    stormWarning: boolean;
  };
  geomagnetic: {
    currentReading: GeomagneticReading;
    solarCycle: SolarCycleData;
    stormProbability: number;
    investigationOptimal: boolean;
  };
  overall: {
    investigationScore: number; // 0-100
    readiness: 'poor' | 'fair' | 'good' | 'excellent';
    primaryFactors: string[];
    warnings: string[];
  };
}

export const EnvironmentalConditionsPanel: React.FC<EnvironmentalConditionsPanelProps> = ({
  location,
  onLocationChange: __onLocationChange,
  autoRefresh = true,
  refreshInterval = 15
}) => {
  const [conditions, setConditions] = useState<EnvironmentalSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  // const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  // Service instances
  const [astronomicalCalc] = useState(() => new AstronomicalCalculations(location));
  const [weatherService] = useState(() => new WeatherEstimationService());
  const [geomagneticEstimator] = useState(() => new GeomagneticActivityEstimator(location));

  const updateConditions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Update all services with current location
      astronomicalCalc.setLocation(location);
      geomagneticEstimator.setLocation(location);

      // Get current data from all services
      const moonPhase = astronomicalCalc.getMoonPhaseData();
      const solarData = astronomicalCalc.getSolarData();
      const astronomicalInfluences = astronomicalCalc.getParanormalInfluences();

      const weatherPattern = await weatherService.getCurrentWeatherPattern();
      const currentPressure = weatherService.getCurrentPressure();
      const weatherInfluences = weatherService.getParanormalWeatherInfluence();

      const geomagneticReading = geomagneticEstimator.estimateKIndex();
      const solarCycle = geomagneticEstimator.getCurrentSolarCycle();
      const geomagneticForecast = geomagneticEstimator.generateForecast(168); // 7 days
      const geomagneticInfluences = geomagneticEstimator.getParanormalInfluence();

      // Calculate overall investigation readiness
      const investigationScore = calculateInvestigationScore(
        astronomicalInfluences,
        weatherInfluences,
        geomagneticInfluences,
        moonPhase,
        weatherPattern,
        geomagneticReading
      );

      const readiness = getReadinessLevel(investigationScore);
      const primaryFactors = getPrimaryFactors(moonPhase, weatherPattern, geomagneticReading);
      const warnings = getWarnings(weatherPattern, geomagneticReading, solarCycle);

      const summary: EnvironmentalSummary = {
        astronomical: {
          moonPhase,
          solarData,
          paranormalOptimal: astronomicalInfluences.overallInfluence > 0.6,
          recommendations: astronomicalInfluences.recommendations
        },
        weather: {
          currentPressure,
          pattern: weatherPattern,
          forecast: weatherInfluences.recommendations,
          stormWarning: weatherPattern.severity === 'severe' || weatherPattern.severity === 'extreme'
        },
        geomagnetic: {
          currentReading: geomagneticReading,
          solarCycle,
          stormProbability: geomagneticForecast.stormProbability,
          investigationOptimal: geomagneticInfluences.investigationOptimal
        },
        overall: {
          investigationScore,
          readiness,
          primaryFactors,
          warnings
        }
      };

      setConditions(summary);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to update environmental conditions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [location, astronomicalCalc, weatherService, geomagneticEstimator]);

  // Auto-refresh effect
  useEffect(() => {
    updateConditions();

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(updateConditions, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [updateConditions, autoRefresh, refreshInterval]);

  const calculateInvestigationScore = (
    astroInfluences: Record<string, unknown>,
    weatherInfluences: Record<string, unknown>,
    geoInfluences: Record<string, unknown>,
    moonPhase: MoonPhaseData,
    weatherPattern: WeatherPattern,
    geoReading: GeomagneticReading
  ): number => {
    let score = 50; // Base score

    // Astronomical factors (30% weight)
    score += astroInfluences.overallInfluence * 30;
    if (moonPhase.phase === 'New' || moonPhase.phase === 'Full') {
      score += 10;
    }

    // Weather factors (25% weight)
    score += weatherInfluences.anomalyProbability * 15;
    if (weatherPattern.trend === 'falling' || weatherPattern.trend === 'volatile') {
      score += 10;
    }

    // Geomagnetic factors (35% weight)
    score += geoInfluences.anomalyProbability * 25;
    if (geoReading.kIndex >= 3 && geoReading.kIndex <= 6) {
      score += 10;
    }

    // Penalty for extreme conditions
    if (geoReading.kIndex > 7 || weatherPattern.severity === 'extreme') {
      score -= 20;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getReadinessLevel = (score: number): 'poor' | 'fair' | 'good' | 'excellent' => {
    if (score < 30) return 'poor';
    if (score < 55) return 'fair';
    if (score < 80) return 'good';
    return 'excellent';
  };

  const getPrimaryFactors = (
    moonPhase: MoonPhaseData,
    weatherPattern: WeatherPattern,
    geoReading: GeomagneticReading
  ): string[] => {
    const factors: string[] = [];

    if (moonPhase.phase === 'New' || moonPhase.phase === 'Full') {
      factors.push(`${moonPhase.phase} Moon (${Math.round(moonPhase.illumination * 100)}% illuminated)`);
    }

    if (weatherPattern.trend !== 'stable') {
      factors.push(`${weatherPattern.trend.charAt(0).toUpperCase() + weatherPattern.trend.slice(1)} Pressure Trend`);
    }

    factors.push(`K-Index: ${geoReading.kIndex} (${geoReading.stormLevel})`);

    if (geoReading.kIndex >= 5) {
      factors.push('Enhanced Electromagnetic Activity');
    }

    return factors;
  };

  const getWarnings = (
    weatherPattern: WeatherPattern,
    geoReading: GeomagneticReading,
    solarCycle: SolarCycleData
  ): string[] => {
    const warnings: string[] = [];

    if (weatherPattern.severity === 'severe' || weatherPattern.severity === 'extreme') {
      warnings.push('Severe weather conditions detected - exercise caution');
    }

    if (geoReading.kIndex > 7) {
      warnings.push('Extreme geomagnetic activity - equipment may malfunction');
    }

    if (geoReading.confidence < 0.5) {
      warnings.push('Low confidence in geomagnetic readings');
    }

    if (solarCycle.cyclePhase === 'maximum' && geoReading.kIndex > 5) {
      warnings.push('Solar maximum period - increased geomagnetic volatility expected');
    }

    return warnings;
  };

  const getReadinessColor = (readiness: string) => {
    switch (readiness) {
      case 'poor': return 'error';
      case 'fair': return 'warning';
      case 'good': return 'info';
      case 'excellent': return 'success';
      default: return 'info';
    }
  };

  const getReadinessIcon = (readiness: string) => {
    switch (readiness) {
      case 'poor': return <ErrorIcon />;
      case 'fair': return <WarningIcon />;
      case 'good': return <InfoIcon />;
      case 'excellent': return <CheckCircleIcon />;
      default: return <InfoIcon />;
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Box display="flex" justifyContent="center">
            <IconButton onClick={updateConditions} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Environmental Conditions</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {lastUpdate && (
              <Typography variant="caption" color="text.secondary">
                Updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            )}
            <IconButton onClick={updateConditions} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={() => setDetailsExpanded(!detailsExpanded)}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {conditions && (
          <Grid container spacing={3}>
            {/* Overall Readiness */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6">Investigation Readiness</Typography>
                    <Chip
                      icon={getReadinessIcon(conditions.overall.readiness)}
                      label={`${conditions.overall.investigationScore}/100 - ${conditions.overall.readiness.toUpperCase()}`}
                      color={getReadinessColor(conditions.overall.readiness) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                      variant="outlined"
                    />
                  </Box>
                  
                  <LinearProgress
                    variant="determinate"
                    value={conditions.overall.investigationScore}
                    sx={{ mb: 2, height: 8, borderRadius: 4 }}
                  />

                  {conditions.overall.primaryFactors.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>Primary Factors:</Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {conditions.overall.primaryFactors.map((factor, index) => (
                          <Chip key={index} label={factor} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {conditions.overall.warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="subtitle2">Warnings:</Typography>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {conditions.overall.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Astronomical Conditions */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Astronomical</Typography>
                  
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">Moon Phase</Typography>
                    <Typography variant="body1">{conditions.astronomical.moonPhase.phase}</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={conditions.astronomical.moonPhase.illumination * 100}
                      sx={{ mt: 1, height: 6 }}
                    />
                    <Typography variant="caption">
                      {Math.round(conditions.astronomical.moonPhase.illumination * 100)}% illuminated
                    </Typography>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">Solar Position</Typography>
                    <Typography variant="body1">
                      Alt: {Math.round(conditions.astronomical.solarData.position.altitude)}°
                    </Typography>
                    <Typography variant="body1">
                      Az: {Math.round(conditions.astronomical.solarData.position.azimuth)}°
                    </Typography>
                  </Box>

                  <Chip
                    label={conditions.astronomical.paranormalOptimal ? 'Optimal' : 'Standard'}
                    color={conditions.astronomical.paranormalOptimal ? 'success' : 'default'}
                    size="small"
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Weather Conditions */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Weather</Typography>
                  
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">Barometric Pressure</Typography>
                    <Typography variant="body1">
                      {conditions.weather.currentPressure 
                        ? `${conditions.weather.currentPressure.pressure.toFixed(1)} hPa`
                        : 'No data'
                      }
                    </Typography>
                    <Chip
                      label={conditions.weather.pattern.trend}
                      size="small"
                      color={conditions.weather.pattern.trend === 'falling' ? 'warning' : 'default'}
                    />
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">Pattern</Typography>
                    <Typography variant="body1">{conditions.weather.pattern.type}</Typography>
                    <Typography variant="caption">
                      Confidence: {Math.round(conditions.weather.pattern.confidence * 100)}%
                    </Typography>
                  </Box>

                  {conditions.weather.stormWarning && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Storm conditions detected
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Geomagnetic Conditions */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Geomagnetic</Typography>
                  
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">K-Index</Typography>
                    <Typography variant="h4">{conditions.geomagnetic.currentReading.kIndex}</Typography>
                    <Chip
                      label={conditions.geomagnetic.currentReading.stormLevel}
                      size="small"
                      color={conditions.geomagnetic.currentReading.kIndex >= 5 ? 'warning' : 'default'}
                    />
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">Solar Cycle</Typography>
                    <Typography variant="body1">
                      Cycle {conditions.geomagnetic.solarCycle.cycleNumber} - {conditions.geomagnetic.solarCycle.cyclePhase}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={conditions.geomagnetic.solarCycle.solarActivity * 100}
                      sx={{ mt: 1, height: 6 }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">Storm Probability</Typography>
                    <Typography variant="body1">
                      {Math.round(conditions.geomagnetic.stormProbability * 100)}%
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Detailed Recommendations */}
            {detailsExpanded && (
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Detailed Recommendations</Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>Astronomical</Typography>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {conditions.astronomical.recommendations.map((rec, index) => (
                            <li key={index}><Typography variant="body2">{rec}</Typography></li>
                          ))}
                        </ul>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>Weather</Typography>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {conditions.weather.forecast.map((rec, index) => (
                            <li key={index}><Typography variant="body2">{rec}</Typography></li>
                          ))}
                        </ul>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>Geomagnetic</Typography>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {conditions.geomagnetic.currentReading && (
                            geomagneticEstimator.getParanormalInfluence(conditions.geomagnetic.currentReading)
                              .recommendations.map((rec, index) => (
                                <li key={index}><Typography variant="body2">{rec}</Typography></li>
                              ))
                          )}
                        </ul>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};