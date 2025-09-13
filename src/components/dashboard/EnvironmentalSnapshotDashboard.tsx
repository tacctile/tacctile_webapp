import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
  IconButton,
  Paper,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Skeleton
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  WbSunny as SunIcon,
  Brightness3 as MoonIcon,
  Thermostat as PressureIcon,
  Explore as CompassIcon,
  Assessment as TrendIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as OptimalIcon,
  Error as PoorIcon,
  Info as GoodIcon
} from '@mui/icons-material';
import { AstronomicalCalculations, MoonPhaseData, SolarData } from '../../services/environment/AstronomicalCalculations';
import { WeatherEstimationService, PressureReading } from '../../services/environment/WeatherEstimation';
import { GeomagneticActivityEstimator, GeomagneticReading } from '../../services/environment/GeomagneticActivityEstimator';

interface EnvironmentalSnapshotProps {
  location: { latitude: number; longitude: number; elevation?: number };
  onLocationChange?: (location: { latitude: number; longitude: number; elevation?: number }) => void;
  autoRefresh?: boolean;
  refreshInterval?: number; // minutes
}

interface SnapshotData {
  moonPhase: MoonPhaseData;
  solarData: SolarData;
  pressure: PressureReading | null;
  pressureTrend: string;
  geomagneticReading: GeomagneticReading;
  magneticDeclination: number; // degrees
  investigationScore: number; // 0-100
  investigationLevel: 'poor' | 'good' | 'optimal';
  recommendations: string[];
  nextOptimalTime?: Date;
}

export const EnvironmentalSnapshotDashboard: React.FC<EnvironmentalSnapshotProps> = ({
  location,
  autoRefresh = true,
  refreshInterval = 15
}) => {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Service instances
  const [astronomicalCalc] = useState(() => new AstronomicalCalculations(location));
  const [weatherService] = useState(() => new WeatherEstimationService());
  const [geomagneticEstimator] = useState(() => new GeomagneticActivityEstimator(location));

  const calculateMagneticDeclination = useCallback((lat: number, lon: number, date: Date = new Date()): number => {
    // Simplified magnetic declination calculation using World Magnetic Model approximation
    // This is a rough approximation - in reality you'd use IGRF coefficients
    const year = date.getFullYear();
    const baseYear = 2020;
    const yearDiff = year - baseYear;
    
    // Rough approximation based on location
    let declination = 0;
    
    // North America approximation
    if (lat > 25 && lat < 70 && lon > -170 && lon < -50) {
      declination = -15 + (lat - 45) * 0.5 + (lon + 100) * 0.3;
    }
    // Europe approximation  
    else if (lat > 35 && lat < 70 && lon > -10 && lon < 40) {
      declination = 2 + (lat - 50) * 0.2 + (lon - 15) * 0.1;
    }
    // General world approximation
    else {
      declination = (lat / 10) + (lon / 50);
    }
    
    // Secular variation (approximate change over time)
    declination += yearDiff * 0.1;
    
    return Math.round(declination * 10) / 10; // Round to 1 decimal place
  }, []);

  const calculateInvestigationScore = useCallback((
    moonPhase: MoonPhaseData,
    solarData: SolarData,
    pressureTrend: string,
    geoReading: GeomagneticReading
  ): number => {
    let score = 40; // Base score

    // Moon phase influence (25 points max)
    if (moonPhase.phase === 'New' || moonPhase.phase === 'Full') {
      score += 25;
    } else if (moonPhase.phase === 'Waxing Crescent' || moonPhase.phase === 'Waning Crescent') {
      score += 15;
    } else {
      score += 5;
    }

    // Solar influence (15 points max)
    const now = new Date();
    const isNight = now.getHours() < 6 || now.getHours() > 20;
    if (isNight) {
      score += 15;
    } else if (now.getHours() < 8 || now.getHours() > 18) {
      score += 10; // Twilight hours
    }

    // Pressure trend influence (15 points max)
    if (pressureTrend === 'falling' || pressureTrend === 'volatile') {
      score += 15;
    } else if (pressureTrend === 'rising') {
      score += 8;
    } else {
      score += 5;
    }

    // Geomagnetic influence (15 points max)
    if (geoReading.kIndex >= 3 && geoReading.kIndex <= 6) {
      score += 15; // Optimal range
    } else if (geoReading.kIndex > 6) {
      score += 8; // High activity but potentially disruptive
    } else {
      score += 3; // Low activity
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }, []);

  const getInvestigationLevel = (score: number): 'poor' | 'good' | 'optimal' => {
    if (score < 40) return 'poor';
    if (score < 75) return 'good';
    return 'optimal';
  };

  const generateRecommendations = useCallback((data: Omit<SnapshotData, 'recommendations' | 'nextOptimalTime'>): string[] => {
    const recommendations: string[] = [];

    // Moon phase recommendations
    if (data.moonPhase.phase === 'New') {
      recommendations.push('New moon: Excellent for shadow work and spirit communication');
    } else if (data.moonPhase.phase === 'Full') {
      recommendations.push('Full moon: Peak paranormal activity expected');
    }

    // Time-based recommendations
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 3 && hour <= 6) {
      recommendations.push('3-6 AM: Optimal investigation hours - "witching hour" period');
    }

    // Weather recommendations
    if (data.pressureTrend === 'falling') {
      recommendations.push('Falling pressure: Increased paranormal activity likelihood');
    }

    // Geomagnetic recommendations
    if (data.geomagneticReading.kIndex >= 4) {
      recommendations.push('Elevated K-index: Enhanced EMF detection sensitivity');
    }

    // Overall score recommendations
    if (data.investigationScore >= 75) {
      recommendations.push('Excellent conditions: Deploy all investigation equipment');
    } else if (data.investigationScore >= 50) {
      recommendations.push('Good conditions: Standard investigation protocols recommended');
    } else {
      recommendations.push('Suboptimal conditions: Consider baseline readings or equipment testing');
    }

    return recommendations;
  }, []);

  const updateSnapshot = useCallback(async () => {
    setLoading(true);

    try {
      // Update service locations
      astronomicalCalc.setLocation(location);
      geomagneticEstimator.setLocation(location);

      // Get current data
      const moonPhase = astronomicalCalc.getMoonPhaseData();
      const solarData = astronomicalCalc.getSolarData();
      const pressure = weatherService.getCurrentPressure();
      const weatherPattern = await weatherService.getCurrentWeatherPattern();
      const geomagneticReading = geomagneticEstimator.estimateKIndex();
      const magneticDeclination = calculateMagneticDeclination(location.latitude, location.longitude);

      // Calculate investigation metrics
      const investigationScore = calculateInvestigationScore(
        moonPhase,
        solarData,
        weatherPattern.trend,
        geomagneticReading
      );
      const investigationLevel = getInvestigationLevel(investigationScore);

      const snapshotData: Omit<SnapshotData, 'recommendations' | 'nextOptimalTime'> = {
        moonPhase,
        solarData,
        pressure,
        pressureTrend: weatherPattern.trend,
        geomagneticReading,
        magneticDeclination,
        investigationScore,
        investigationLevel
      };

      const recommendations = generateRecommendations(snapshotData);

      // Calculate next optimal time (simplified - next new/full moon or midnight)
      const nextOptimalTime = new Date();
      if (nextOptimalTime.getHours() < 23) {
        nextOptimalTime.setHours(0, 0, 0, 0);
        nextOptimalTime.setDate(nextOptimalTime.getDate() + 1);
      }

      const finalSnapshot: SnapshotData = {
        ...snapshotData,
        recommendations,
        nextOptimalTime
      };

      setSnapshot(finalSnapshot);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to update environmental snapshot:', error);
    } finally {
      setLoading(false);
    }
  }, [location, astronomicalCalc, weatherService, geomagneticEstimator, calculateMagneticDeclination, calculateInvestigationScore, generateRecommendations]);

  // Auto-refresh effect
  useEffect(() => {
    updateSnapshot();

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(updateSnapshot, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [updateSnapshot, autoRefresh, refreshInterval]);

  const getMoonPhaseIcon = (phase: string, illumination: number) => {
    const style = {
      width: 60,
      height: 60,
      fontSize: '2rem',
      background: `linear-gradient(90deg, #ffd700 ${illumination * 100}%, #333 ${illumination * 100}%)`
    };
    
    if (phase === 'New') return <Avatar sx={style}>🌑</Avatar>;
    if (phase === 'Waxing Crescent') return <Avatar sx={style}>🌒</Avatar>;
    if (phase === 'First Quarter') return <Avatar sx={style}>🌓</Avatar>;
    if (phase === 'Waxing Gibbous') return <Avatar sx={style}>🌔</Avatar>;
    if (phase === 'Full') return <Avatar sx={style}>🌕</Avatar>;
    if (phase === 'Waning Gibbous') return <Avatar sx={style}>🌖</Avatar>;
    if (phase === 'Last Quarter') return <Avatar sx={style}>🌗</Avatar>;
    if (phase === 'Waning Crescent') return <Avatar sx={style}>🌘</Avatar>;
    return <Avatar sx={style}><MoonIcon /></Avatar>;
  };

  const getInvestigationIcon = (level: string) => {
    switch (level) {
      case 'poor': return <PoorIcon color="error" />;
      case 'good': return <GoodIcon color="info" />;
      case 'optimal': return <OptimalIcon color="success" />;
      default: return <GoodIcon />;
    }
  };

  const getInvestigationColor = (level: string) => {
    switch (level) {
      case 'poor': return 'error';
      case 'good': return 'info';
      case 'optimal': return 'success';
      default: return 'info';
    }
  };

  if (loading && !snapshot) {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Skeleton variant="rectangular" height={200} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rectangular" height={150} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rectangular" height={150} />
        </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* Investigation Conditions Header */}
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 3, background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
              Investigation Conditions
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              {lastUpdate && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </Typography>
              )}
              <IconButton onClick={updateSnapshot} disabled={loading} sx={{ color: 'white' }}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>

          {snapshot && (
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <Box textAlign="center">
                <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={1}>
                  {getInvestigationIcon(snapshot.investigationLevel)}
                  <Chip
                    label={`${snapshot.investigationScore}/100 - ${snapshot.investigationLevel.toUpperCase()}`}
                    color={getInvestigationColor(snapshot.investigationLevel) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                    size="large"
                    sx={{ fontSize: '1rem', padding: '8px 16px' }}
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={snapshot.investigationScore}
                  sx={{
                    width: 300,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: snapshot.investigationLevel === 'optimal' ? '#4caf50' :
                                     snapshot.investigationLevel === 'good' ? '#2196f3' : '#f44336'
                    }
                  }}
                />
              </Box>
            </Box>
          )}
        </Paper>
      </Grid>

      {/* Moon Phase Card */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <MoonIcon sx={{ color: 'white' }} />
              <Typography variant="h6" sx={{ color: 'white' }}>Moon Phase</Typography>
            </Box>
            
            {snapshot ? (
              <Box textAlign="center">
                <Box mb={2}>
                  {getMoonPhaseIcon(snapshot.moonPhase.phase, snapshot.moonPhase.illumination)}
                </Box>
                <Typography variant="h6" sx={{ color: 'white' }}>
                  {snapshot.moonPhase.phase}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {Math.round(snapshot.moonPhase.illumination * 100)}% illuminated
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Distance: {Math.round(snapshot.moonPhase.distance).toLocaleString()} km
                </Typography>
              </Box>
            ) : (
              <Skeleton variant="rectangular" height={120} />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Sun Times Card */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f57c00 0%, #ff9800 100%)' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <SunIcon sx={{ color: 'white' }} />
              <Typography variant="h6" sx={{ color: 'white' }}>Sun Times</Typography>
            </Box>
            
            {snapshot ? (
              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Sunrise:
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {snapshot.solarData.times.sunrise?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'N/A'}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Sunset:
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {snapshot.solarData.times.sunset?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'N/A'}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Solar Altitude:
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {Math.round(snapshot.solarData.position.altitude)}°
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Azimuth:
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {Math.round(snapshot.solarData.position.azimuth)}°
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Skeleton variant="rectangular" height={120} />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Atmospheric Pressure Card */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <PressureIcon sx={{ color: 'white' }} />
              <Typography variant="h6" sx={{ color: 'white' }}>Pressure</Typography>
            </Box>
            
            {snapshot ? (
              <Box textAlign="center">
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {snapshot.pressure ? `${snapshot.pressure.pressure.toFixed(1)}` : '---'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  hPa
                </Typography>
                <Box mt={2}>
                  <Chip
                    icon={<TrendIcon />}
                    label={snapshot.pressureTrend}
                    size="small"
                    sx={{
                      color: 'white',
                      backgroundColor: snapshot.pressureTrend === 'falling' ? 'rgba(255,193,7,0.8)' :
                                     snapshot.pressureTrend === 'rising' ? 'rgba(76,175,80,0.8)' :
                                     'rgba(158,158,158,0.8)'
                    }}
                  />
                </Box>
              </Box>
            ) : (
              <Skeleton variant="rectangular" height={120} />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Magnetic Declination Card */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%)' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <CompassIcon sx={{ color: 'white' }} />
              <Typography variant="h6" sx={{ color: 'white' }}>Magnetic Declination</Typography>
            </Box>
            
            {snapshot ? (
              <Box textAlign="center">
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {snapshot.magneticDeclination > 0 ? '+' : ''}{snapshot.magneticDeclination}°
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {snapshot.magneticDeclination > 0 ? 'East' : 'West'} of True North
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mt: 1 }}>
                  Geomagnetic K-Index: {snapshot.geomagneticReading.kIndex}
                </Typography>
                <Chip
                  label={snapshot.geomagneticReading.stormLevel}
                  size="small"
                  sx={{
                    mt: 1,
                    color: 'white',
                    backgroundColor: snapshot.geomagneticReading.kIndex >= 5 ? 'rgba(244,67,54,0.8)' :
                                   snapshot.geomagneticReading.kIndex >= 3 ? 'rgba(255,193,7,0.8)' :
                                   'rgba(76,175,80,0.8)'
                  }}
                />
              </Box>
            ) : (
              <Skeleton variant="rectangular" height={120} />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Recommendations Card */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <StarIcon color="primary" />
              <Typography variant="h6">Investigation Recommendations</Typography>
            </Box>
            
            {snapshot ? (
              <List dense>
                {snapshot.recommendations.map((recommendation, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {index === 0 ? <StarIcon color="primary" /> : 
                         recommendation.includes('warning') || recommendation.includes('caution') ?
                         <WarningIcon color="warning" /> : <StarIcon color="action" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={recommendation}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                    {index < snapshot.recommendations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box>
                <Skeleton variant="text" height={30} />
                <Skeleton variant="text" height={30} />
                <Skeleton variant="text" height={30} />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};