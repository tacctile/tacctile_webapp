import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Badge,
  Skeleton,
  Alert,
  LinearProgress,
  Paper
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Cemetery as CemeteryIcon,
  Church as ChurchIcon,
  LocalHospital as HospitalIcon,
  AccountBalance as HistoricalIcon,
  Star as StarIcon,
  Explore as CompassIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  MyLocation as MyLocationIcon,
  Map as MapIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { OfflineGeocodingService, GeocodedLocation, LocationSearchOptions } from '../../services/location/OfflineGeocodingService';
import { MagneticAnomalyService, MagneticAnomalyData, LocalMagneticEnvironment } from '../../services/location/MagneticAnomalyService';

interface LocationIntelligencePanelProps {
  currentLocation: { latitude: number; longitude: number; elevation?: number };
  onLocationSelect?: (location: GeocodedLocation) => void;
  onMagneticAnomalySelect?: (anomaly: MagneticAnomalyData) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`location-tabpanel-${index}`}
      aria-labelledby={`location-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const LocationIntelligencePanel: React.FC<LocationIntelligencePanelProps> = ({
  currentLocation,
  onLocationSelect,
  onMagneticAnomalySelect
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRadius, setSearchRadius] = useState(25);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['cemetery', 'historical_site']);
  const [locations, setLocations] = useState<GeocodedLocation[]>([]);
  const [magneticEnvironment, setMagneticEnvironment] = useState<LocalMagneticEnvironment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Service instances
  const [geocodingService] = useState(() => new OfflineGeocodingService());
  const [magneticService] = useState(() => new MagneticAnomalyService());

  const getLocationTypeIcon = (type: string) => {
    switch (type) {
      case 'cemetery': return <CemeteryIcon />;
      case 'church': return <ChurchIcon />;
      case 'hospital': return <HospitalIcon />;
      case 'historical_site': return <HistoricalIcon />;
      case 'prison': return <LocationIcon />;
      case 'battlefield': return <LocationIcon />;
      default: return <LocationIcon />;
    }
  };

  const getParanormalRatingColor = (rating?: number) => {
    if (!rating) return 'default';
    if (rating >= 8) return 'error';
    if (rating >= 6) return 'warning';
    if (rating >= 4) return 'info';
    return 'success';
  };

  const searchNearbyLocations = useCallback(async () => {
    if (!currentLocation) return;

    setLoading(true);
    setError(null);

    try {
      const searchOptions: LocationSearchOptions = {
        types: selectedTypes as any[],
        radius: searchRadius,
        limit: 50,
        includeParanormalRating: true,
        minParanormalRating: 0
      };

      const results = await geocodingService.searchNearbyLocations(
        currentLocation.latitude,
        currentLocation.longitude,
        searchOptions
      );

      setLocations(results);
    } catch (err) {
      console.error('Failed to search nearby locations:', err);
      setError('Failed to search nearby locations');
    } finally {
      setLoading(false);
    }
  }, [currentLocation, selectedTypes, searchRadius, geocodingService]);

  const searchLocationsByName = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const results = geocodingService.searchLocationsByName(searchQuery.trim());
      setLocations(results);
    } catch (err) {
      console.error('Failed to search locations by name:', err);
      setError('Failed to search locations by name');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, geocodingService]);

  const loadMagneticEnvironment = useCallback(async () => {
    if (!currentLocation) return;

    try {
      const environment = magneticService.getLocalMagneticEnvironment(
        currentLocation.latitude,
        currentLocation.longitude,
        searchRadius
      );

      setMagneticEnvironment(environment);
    } catch (err) {
      console.error('Failed to load magnetic environment:', err);
    }
  }, [currentLocation, searchRadius, magneticService]);

  useEffect(() => {
    searchNearbyLocations();
    loadMagneticEnvironment();
  }, [searchNearbyLocations, loadMagneticEnvironment]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleLocationClick = (location: GeocodedLocation) => {
    if (onLocationSelect) {
      onLocationSelect(location);
    }
  };

  const handleAnomalyClick = (anomaly: MagneticAnomalyData) => {
    if (onMagneticAnomalySelect) {
      onMagneticAnomalySelect(anomaly);
    }
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (searchQuery.trim()) {
      searchLocationsByName();
    } else {
      searchNearbyLocations();
    }
  };

  const nearbyHighValue = locations.filter(l => (l.paranormalRating || 0) >= 7).length;
  const totalAnomalies = magneticEnvironment?.anomalies.filter(a => a.anomalyStrength >= 5).length || 0;
  const hotspots = magneticEnvironment?.hotspots.length || 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Location Intelligence</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Badge badgeContent={nearbyHighValue} color="error">
              <Chip icon={<LocationIcon />} label="High Value" size="small" />
            </Badge>
            <Badge badgeContent={totalAnomalies} color="warning">
              <Chip icon={<CompassIcon />} label="Anomalies" size="small" />
            </Badge>
            <IconButton onClick={searchNearbyLocations} size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Search Controls */}
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <form onSubmit={handleSearch}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search locations by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton type="submit" size="small">
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Radius (km)"
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  inputProps={{ min: 1, max: 500 }}
                />
              </Grid>
              
              <Grid item xs={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Types</InputLabel>
                  <Select
                    multiple
                    value={selectedTypes}
                    onChange={(e) => setSelectedTypes(e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="cemetery">Cemetery</MenuItem>
                    <MenuItem value="historical_site">Historical Site</MenuItem>
                    <MenuItem value="church">Church</MenuItem>
                    <MenuItem value="hospital">Hospital</MenuItem>
                    <MenuItem value="prison">Prison</MenuItem>
                    <MenuItem value="battlefield">Battlefield</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </form>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              label={
                <Badge badgeContent={locations.length} color="primary" max={99}>
                  Locations
                </Badge>
              } 
            />
            <Tab 
              label={
                <Badge badgeContent={hotspots} color="warning" max={99}>
                  Magnetic Field
                </Badge>
              }
            />
          </Tabs>
        </Box>

        {loading && <LinearProgress sx={{ mt: 1 }} />}

        {/* Locations Tab */}
        <TabPanel value={tabValue} index={0}>
          {locations.length === 0 && !loading ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
              No locations found. Try adjusting your search criteria.
            </Typography>
          ) : (
            <List dense>
              {(loading ? Array.from({ length: 5 }) : locations).map((location, index) => (
                <ListItem
                  key={loading ? index : location?.id}
                  button={!loading}
                  onClick={() => !loading && location && handleLocationClick(location)}
                  divider
                >
                  <ListItemIcon>
                    {loading ? (
                      <Skeleton variant="circular" width={24} height={24} />
                    ) : (
                      getLocationTypeIcon(location.type)
                    )}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      loading ? (
                        <Skeleton variant="text" width="60%" />
                      ) : (
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight="500">
                            {location.name}
                          </Typography>
                          {location.paranormalRating && (
                            <Chip
                              icon={<StarIcon />}
                              label={location.paranormalRating.toFixed(1)}
                              size="small"
                              color={getParanormalRatingColor(location.paranormalRating) as any}
                            />
                          )}
                        </Box>
                      )
                    }
                    secondary={
                      loading ? (
                        <Skeleton variant="text" width="80%" />
                      ) : (
                        <Box>
                          <Typography variant="caption" display="block">
                            {location.address}, {location.city}
                          </Typography>
                          {location.description && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {location.description.length > 60 
                                ? `${location.description.substring(0, 60)}...`
                                : location.description
                              }
                            </Typography>
                          )}
                          {location.yearEstablished && (
                            <Typography variant="caption" color="primary">
                              Est. {location.yearEstablished}
                            </Typography>
                          )}
                        </Box>
                      )
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Magnetic Field Tab */}
        <TabPanel value={tabValue} index={1}>
          {magneticEnvironment ? (
            <Box>
              {/* Environment Summary */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {magneticEnvironment.averageDeclination > 0 ? '+' : ''}{magneticEnvironment.averageDeclination.toFixed(1)}°
                    </Typography>
                    <Typography variant="caption">Magnetic Declination</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="secondary">
                      {Math.round(magneticEnvironment.averageIntensity).toLocaleString()}
                    </Typography>
                    <Typography variant="caption">Intensity (nT)</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {magneticEnvironment.anomalies.filter(a => a.anomalyStrength >= 5).length}
                    </Typography>
                    <Typography variant="caption">Strong Anomalies</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {magneticEnvironment.hotspots.length}
                    </Typography>
                    <Typography variant="caption">Hotspots</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Hotspots */}
              {magneticEnvironment.hotspots.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>Magnetic Hotspots</Typography>
                  <List dense>
                    {magneticEnvironment.hotspots.slice(0, 5).map((hotspot, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <TrendingUpIcon color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Strength: ${hotspot.strength.toFixed(1)}/10`}
                          secondary={`${hotspot.anomalyCount} anomalies, ${hotspot.radius.toFixed(1)}km radius`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Strong Anomalies List */}
              {magneticEnvironment.anomalies.filter(a => a.anomalyStrength >= 5).length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>Strong Anomalies</Typography>
                  <List dense>
                    {magneticEnvironment.anomalies
                      .filter(a => a.anomalyStrength >= 5)
                      .slice(0, 10)
                      .map((anomaly) => (
                        <ListItem 
                          key={anomaly.id}
                          button
                          onClick={() => handleAnomalyClick(anomaly)}
                        >
                          <ListItemIcon>
                            {anomaly.anomalyType === 'positive' ? (
                              <TrendingUpIcon color="error" />
                            ) : anomaly.anomalyType === 'negative' ? (
                              <TrendingDownIcon color="info" />
                            ) : (
                              <CompassIcon color="warning" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2">
                                  {anomaly.anomalyType} anomaly
                                </Typography>
                                <Chip
                                  label={`${anomaly.anomalyStrength.toFixed(1)}/10`}
                                  size="small"
                                  color={anomaly.anomalyStrength >= 8 ? 'error' : 'warning'}
                                />
                              </Box>
                            }
                            secondary={`${anomaly.intensity.toFixed(0)} nT, ${anomaly.source}`}
                          />
                        </ListItem>
                      ))}
                  </List>
                </Box>
              )}

              {/* Recommendations */}
              {magneticEnvironment.recommendations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Investigation Recommendations</Typography>
                  <List dense>
                    {magneticEnvironment.recommendations.map((recommendation, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <StarIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2">
                              {recommendation}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <Skeleton variant="rectangular" width="100%" height={200} />
              <Typography variant="body2" color="text.secondary" mt={2}>
                Loading magnetic field data...
              </Typography>
            </Box>
          )}
        </TabPanel>
      </CardContent>
    </Card>
  );
};