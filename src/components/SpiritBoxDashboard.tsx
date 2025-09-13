import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  Slider,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  Badge
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  FiberManualRecord,
  RadioButtonChecked,
  Settings,
  Download,
  Mic,
  Bookmark,
  Timeline,
  Warning,
  Info,
  Close
} from '@mui/icons-material';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

import { RadioScannerCore, RadioFrequency, ScanSettings, RadioMetrics } from '../services/spirit-box/RadioScannerCore';
import { AudioProcessor, AudioFeatures, NoiseReductionSettings } from '../services/spirit-box/AudioProcessor';
import { WordDetectionEngine, WordMatch, CommunicationEvent, DetectionSettings } from '../services/spirit-box/WordDetectionEngine';
import { SessionRecorder, SessionMetadata, SessionEvent, AudioMarker, SessionAnalytics } from '../services/spirit-box/SessionRecorder';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface SpiritBoxDashboardProps {
  onClose?: () => void;
}

export const SpiritBoxDashboard: React.FC<SpiritBoxDashboardProps> = ({ onClose }) => {
  // Service instances
  const radioScanner = useRef<RadioScannerCore | null>(null);
  const audioProcessor = useRef<AudioProcessor | null>(null);
  const wordDetector = useRef<WordDetectionEngine | null>(null);
  const sessionRecorder = useRef<SessionRecorder | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentFrequency, setCurrentFrequency] = useState(88.1);

  // Settings State
  const [scanSettings, setScanSettings] = useState<Partial<ScanSettings>>({
    startFrequency: 88.1,
    endFrequency: 108.0,
    sweepRate: 200,
    threshold: -50,
    pauseOnSignal: true
  });

  const [detectionSettings, setDetectionSettings] = useState<Partial<DetectionSettings>>({
    confidenceThreshold: 0.3,
    enablePhoneticMatching: true,
    enableSoundexMatching: true,
    realTimeDetection: true
  });

  const [noiseSettings, setNoiseSettings] = useState<Partial<NoiseReductionSettings>>({
    enabled: true,
    aggressiveness: 0.6,
    preserveVoice: true
  });

  // Data State
  const [radioMetrics, setRadioMetrics] = useState<RadioMetrics | null>(null);
  const [_audioFeatures, _setAudioFeatures] = useState<AudioFeatures | null>(null);
  const [detectedWords, setDetectedWords] = useState<WordMatch[]>([]);
  const [communicationEvents, setCommunicationEvents] = useState<CommunicationEvent[]>([]);
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([]);
  const [audioMarkers, setAudioMarkers] = useState<AudioMarker[]>([]);
  const [frequencies, setFrequencies] = useState<RadioFrequency[]>([]);
  const [waveformData, _setWaveformData] = useState<Float32Array[]>([]);
  const [sessionAnalytics, setSessionAnalytics] = useState<SessionAnalytics | null>(null);

  // Dialog State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertOpen, setAlertOpen] = useState(false);

  // Session State
  const [currentSession, setCurrentSession] = useState<SessionMetadata | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize Radio Scanner
        radioScanner.current = new RadioScannerCore(scanSettings);
        
        // Initialize Word Detector
        wordDetector.current = new WordDetectionEngine(detectionSettings);
        
        // Initialize Session Recorder
        sessionRecorder.current = new SessionRecorder();

        // Set up event listeners
        setupEventListeners();

        showAlert('Spirit Box initialized successfully', 'success');
      } catch (error) {
        showAlert(`Failed to initialize Spirit Box: ${error}`, 'error');
      }
    };

    initializeServices();

    return () => {
      cleanup();
    };
  }, []);

  const setupEventListeners = () => {
    if (!radioScanner.current || !wordDetector.current || !sessionRecorder.current) return;

    // Radio Scanner Events
    radioScanner.current.on('scanStarted', () => {
      setIsScanning(true);
      showAlert('Radio scanning started', 'info');
    });

    radioScanner.current.on('scanStopped', () => {
      setIsScanning(false);
      showAlert('Radio scanning stopped', 'info');
    });

    radioScanner.current.on('frequencyChanged', (frequency: number) => {
      setCurrentFrequency(frequency);
    });

    radioScanner.current.on('metrics', (metrics: RadioMetrics) => {
      setRadioMetrics(metrics);
    });

    radioScanner.current.on('frequencyMapGenerated', (freqs: RadioFrequency[]) => {
      setFrequencies(freqs);
    });

    radioScanner.current.on('strongSignalDetected', (data) => {
      sessionRecorder.current?.onFrequencyChange(data.frequency, data.signalStrength);
    });

    // Word Detector Events
    wordDetector.current.on('wordDetected', (word: WordMatch) => {
      setDetectedWords(prev => [...prev.slice(-49), word]); // Keep last 50
      sessionRecorder.current?.onWordDetected(word);
    });

    wordDetector.current.on('communicationEvent', (event: CommunicationEvent) => {
      setCommunicationEvents(prev => [...prev.slice(-24), event]); // Keep last 25
      sessionRecorder.current?.onCommunicationEvent(event);
      showAlert(`Communication detected: "${event.phrase}"`, 'warning');
    });

    wordDetector.current.on('patternDetected', (pattern) => {
      showAlert(`Pattern detected: ${pattern.description}`, 'info');
    });

    // Session Recorder Events
    sessionRecorder.current.on('sessionStarted', (session: SessionMetadata) => {
      setCurrentSession(session);
      showAlert('Recording session started', 'success');
    });

    sessionRecorder.current.on('sessionEnded', () => {
      setCurrentSession(null);
      setIsRecording(false);
      showAlert('Recording session ended', 'info');
    });

    sessionRecorder.current.on('recordingStarted', () => {
      setIsRecording(true);
    });

    sessionRecorder.current.on('recordingStopped', () => {
      setIsRecording(false);
      setIsPaused(false);
    });

    sessionRecorder.current.on('recordingPaused', () => {
      setIsPaused(true);
    });

    sessionRecorder.current.on('recordingResumed', () => {
      setIsPaused(false);
    });

    sessionRecorder.current.on('eventAdded', (event: SessionEvent) => {
      setSessionEvents(prev => [...prev.slice(-99), event]); // Keep last 100
    });

    sessionRecorder.current.on('markerAdded', (marker: AudioMarker) => {
      setAudioMarkers(prev => [...prev, marker]);
    });

    sessionRecorder.current.on('error', (error: string) => {
      showAlert(error, 'error');
    });
  };

  const cleanup = async () => {
    try {
      await radioScanner.current?.cleanup();
      await audioProcessor.current?.cleanup();
      await sessionRecorder.current?.cleanup();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  const showAlert = (message: string, severity: typeof alertSeverity) => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setAlertOpen(true);
  };

  // Control Functions
  const startScanning = async () => {
    if (!radioScanner.current) return;
    
    try {
      await radioScanner.current.startScanning();
    } catch (error) {
      showAlert(`Failed to start scanning: ${error}`, 'error');
    }
  };

  const stopScanning = () => {
    radioScanner.current?.stopScanning();
  };

  const startSession = async (metadata: Partial<SessionMetadata>) => {
    if (!sessionRecorder.current) return;

    try {
      const _sessionId = await sessionRecorder.current.startSession(metadata);
      await sessionRecorder.current.startRecording();
      
      // Start related services
      if (radioScanner.current && !isScanning) {
        await startScanning();
      }
    } catch (error) {
      showAlert(`Failed to start session: ${error}`, 'error');
    }
  };

  const stopSession = async () => {
    if (!sessionRecorder.current) return;

    try {
      await sessionRecorder.current.endSession();
      
      // Stop related services
      if (radioScanner.current && isScanning) {
        stopScanning();
      }
    } catch (error) {
      showAlert(`Failed to stop session: ${error}`, 'error');
    }
  };

  const pauseRecording = () => {
    sessionRecorder.current?.pauseRecording();
  };

  const resumeRecording = () => {
    sessionRecorder.current?.resumeRecording();
  };

  const addManualMarker = () => {
    const label = prompt('Enter marker label:');
    if (label && sessionRecorder.current) {
      sessionRecorder.current.addManualMarker(label);
    }
  };

  // Chart Data
  const frequencyChartData = useMemo(() => {
    if (!frequencies.length) return null;

    return {
      labels: frequencies.map(f => f.frequency.toFixed(1)),
      datasets: [
        {
          label: 'Signal Strength (dBm)',
          data: frequencies.map(f => f.signalStrength),
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          fill: true,
          tension: 0.1
        }
      ]
    };
  }, [frequencies]);

  const _waveformChartData = useMemo(() => {
    if (!waveformData.length) return null;

    const flatData = waveformData.flat();
    const timeLabels = flatData.map((_, i) => (i / 44100).toFixed(3));

    return {
      labels: timeLabels.slice(-1000), // Last 1000 samples
      datasets: [
        {
          label: 'Amplitude',
          data: flatData.slice(-1000),
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.1)',
          fill: true,
          pointRadius: 0,
          tension: 0.1
        }
      ]
    };
  }, [waveformData]);

  const wordsChartData = useMemo(() => {
    if (!detectedWords.length) return null;

    const categoryCount = detectedWords.reduce((acc, word) => {
      const category = word.context || 'unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      labels: Object.keys(categoryCount),
      datasets: [
        {
          label: 'Word Detections by Category',
          data: Object.values(categoryCount),
          backgroundColor: [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#34495e'
          ]
        }
      ]
    };
  }, [detectedWords]);

  const confidenceChartData = useMemo(() => {
    if (!detectedWords.length) return null;

    const last50Words = detectedWords.slice(-50);
    
    return {
      labels: last50Words.map((_, i) => i.toString()),
      datasets: [
        {
          label: 'Confidence',
          data: last50Words.map(w => w.confidence * 100),
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          fill: true,
          tension: 0.1
        }
      ]
    };
  }, [detectedWords]);

  // Update session duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentSession) {
      interval = setInterval(() => {
        setSessionDuration((Date.now() - currentSession.startTime) / 1000);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession]);

  // Update analytics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionRecorder.current && currentSession) {
        const analytics = sessionRecorder.current.generateAnalytics();
        setSessionAnalytics(analytics);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentSession]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid item>
            <Typography variant="h5" component="h1" fontWeight="bold">
              🌟 Spirit Box Dashboard
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Paranormal Investigation Communication System
            </Typography>
          </Grid>
          
          <Grid item>
            <Box display="flex" alignItems="center" gap={1}>
              {/* Session Status */}
              {currentSession && (
                <Chip
                  icon={<FiberManualRecord />}
                  label={`Recording: ${Math.floor(sessionDuration / 60)}:${String(Math.floor(sessionDuration % 60)).padStart(2, '0')}`}
                  color={isRecording ? (isPaused ? 'warning' : 'error') : 'default'}
                  variant="outlined"
                />
              )}
              
              {/* Scanner Status */}
              <Chip
                icon={<RadioButtonChecked />}
                label={isScanning ? `Scanning: ${currentFrequency.toFixed(1)} MHz` : 'Scanner Idle'}
                color={isScanning ? 'primary' : 'default'}
                variant="outlined"
              />

              <IconButton onClick={() => setSettingsOpen(true)}>
                <Settings />
              </IconButton>
              
              {onClose && (
                <IconButton onClick={onClose}>
                  <Close />
                </IconButton>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Control Panel */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Button
              variant="contained"
              startIcon={isScanning ? <Stop /> : <PlayArrow />}
              onClick={isScanning ? stopScanning : startScanning}
              color={isScanning ? 'error' : 'primary'}
            >
              {isScanning ? 'Stop Scan' : 'Start Scan'}
            </Button>
          </Grid>

          <Grid item>
            <Button
              variant="contained"
              startIcon={currentSession ? <Stop /> : <FiberManualRecord />}
              onClick={currentSession ? stopSession : () => setSessionOpen(true)}
              color={currentSession ? 'error' : 'success'}
            >
              {currentSession ? 'End Session' : 'New Session'}
            </Button>
          </Grid>

          {isRecording && (
            <Grid item>
              <Button
                variant="outlined"
                startIcon={isPaused ? <PlayArrow /> : <Pause />}
                onClick={isPaused ? resumeRecording : pauseRecording}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            </Grid>
          )}

          <Grid item>
            <Button
              variant="outlined"
              startIcon={<Bookmark />}
              onClick={addManualMarker}
              disabled={!currentSession}
            >
              Add Marker
            </Button>
          </Grid>

          <Grid item sx={{ ml: 'auto' }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => setExportOpen(true)}
              disabled={!currentSession}
            >
              Export
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1 }}>
        <Paper elevation={1} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Radio Scanner" />
            <Tab label="Word Detection" />
            <Tab label="Communications" />
            <Tab label="Session Data" />
            <Tab label="Analytics" />
          </Tabs>

          {/* Radio Scanner Tab */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Frequency Spectrum" />
                  <CardContent>
                    {frequencyChartData ? (
                      <Line
                        data={frequencyChartData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false }
                          },
                          scales: {
                            y: {
                              title: { display: true, text: 'Signal Strength (dBm)' }
                            },
                            x: {
                              title: { display: true, text: 'Frequency (MHz)' }
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography color="textSecondary" align="center">
                        No frequency data available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Scanner Metrics" />
                  <CardContent>
                    {radioMetrics ? (
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Current Frequency: {radioMetrics.currentFrequency.toFixed(1)} MHz
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Signal Strength: {radioMetrics.signalStrength.toFixed(1)} dBm
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Noise Floor: {radioMetrics.noiseFloor.toFixed(1)} dBm
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Active Stations: {radioMetrics.activeStations}/{radioMetrics.totalStations}
                        </Typography>
                        <Box mt={2}>
                          <Typography variant="body2" gutterBottom>
                            Signal Strength
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={Math.max(0, Math.min(100, (radioMetrics.signalStrength + 100)))}
                            color={radioMetrics.signalStrength > -50 ? 'success' : radioMetrics.signalStrength > -70 ? 'warning' : 'error'}
                          />
                        </Box>
                      </Box>
                    ) : (
                      <Typography color="textSecondary">
                        No scanner data available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardHeader title="Active Frequencies" />
                  <CardContent>
                    <Grid container spacing={1}>
                      {frequencies.filter(f => f.active).map(freq => (
                        <Grid item key={freq.frequency}>
                          <Chip 
                            label={`${freq.frequency.toFixed(1)} MHz`}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                        </Grid>
                      ))}
                      {frequencies.filter(f => f.active).length === 0 && (
                        <Grid item>
                          <Typography color="textSecondary">
                            No active frequencies detected
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Word Detection Tab */}
          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader 
                    title="Recent Word Detections"
                    action={
                      <Badge badgeContent={detectedWords.length} color="primary">
                        <Mic />
                      </Badge>
                    }
                  />
                  <CardContent sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List dense>
                      {detectedWords.slice(-10).reverse().map((word, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            <Chip 
                              size="small" 
                              label={`${(word.confidence * 100).toFixed(0)}%`}
                              color={word.confidence > 0.7 ? 'success' : word.confidence > 0.4 ? 'warning' : 'error'}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={word.word}
                            secondary={`${word.matchType} | ${word.context || 'unknown'} | ${new Date(word.timestamp).toLocaleTimeString()}`}
                          />
                        </ListItem>
                      ))}
                      {detectedWords.length === 0 && (
                        <Typography color="textSecondary" align="center">
                          No words detected yet
                        </Typography>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Word Categories" />
                  <CardContent>
                    {wordsChartData ? (
                      <Bar
                        data={wordsChartData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false }
                          }
                        }}
                      />
                    ) : (
                      <Typography color="textSecondary" align="center">
                        No category data available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardHeader title="Confidence Trend" />
                  <CardContent>
                    {confidenceChartData ? (
                      <Line
                        data={confidenceChartData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false }
                          },
                          scales: {
                            y: {
                              title: { display: true, text: 'Confidence (%)' },
                              min: 0,
                              max: 100
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography color="textSecondary" align="center">
                        No confidence data available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Communications Tab */}
          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardHeader 
                    title="Communication Events"
                    action={
                      <Badge badgeContent={communicationEvents.length} color="secondary">
                        <Timeline />
                      </Badge>
                    }
                  />
                  <CardContent sx={{ maxHeight: 500, overflow: 'auto' }}>
                    <List>
                      {communicationEvents.slice().reverse().map((event, _index) => (
                        <ListItem key={event.id} divider>
                          <ListItemIcon>
                            <Box display="flex" flexDirection="column" alignItems="center">
                              <Chip
                                size="small"
                                label={event.classification}
                                color={
                                  event.classification === 'potential_evp' ? 'error' :
                                  event.classification === 'ambient_speech' ? 'warning' :
                                  'default'
                                }
                              />
                              <Typography variant="caption" color="textSecondary">
                                {(event.significance * 100).toFixed(0)}%
                              </Typography>
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={`"${event.phrase}"`}
                            secondary={
                              <Box>
                                <Typography variant="body2" component="span">
                                  Confidence: {(event.confidence * 100).toFixed(1)}% | 
                                  Duration: {event.duration.toFixed(0)}ms | 
                                  Words: {event.words.length}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="textSecondary">
                                  {new Date(event.timestamp).toLocaleString()}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                      {communicationEvents.length === 0 && (
                        <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                          No communication events detected yet
                        </Typography>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Session Data Tab */}
          <TabPanel value={activeTab} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Session Events" />
                  <CardContent sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List dense>
                      {sessionEvents.slice(-20).reverse().map((event, _index) => (
                        <ListItem key={event.id} divider>
                          <ListItemIcon>
                            {event.type === 'word_detected' && <Mic />}
                            {event.type === 'communication_event' && <Timeline />}
                            {event.type === 'anomaly_detected' && <Warning />}
                            {event.type === 'marker_added' && <Bookmark />}
                            {event.type === 'user_action' && <Info />}
                          </ListItemIcon>
                          <ListItemText
                            primary={event.description}
                            secondary={`${event.type} | ${new Date(event.timestamp).toLocaleTimeString()}`}
                          />
                          {event.confidence && (
                            <Chip
                              size="small"
                              label={`${(event.confidence * 100).toFixed(0)}%`}
                              color={event.confidence > 0.7 ? 'success' : 'default'}
                            />
                          )}
                        </ListItem>
                      ))}
                      {sessionEvents.length === 0 && (
                        <Typography color="textSecondary" align="center">
                          No session events yet
                        </Typography>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Audio Markers" />
                  <CardContent sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List dense>
                      {audioMarkers.slice().reverse().map((marker, _index) => (
                        <ListItem key={marker.id} divider>
                          <ListItemIcon>
                            <Box 
                              sx={{ 
                                width: 12, 
                                height: 12, 
                                borderRadius: '50%', 
                                backgroundColor: marker.color 
                              }} 
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={marker.label}
                            secondary={
                              <Box>
                                <Typography variant="body2">
                                  {marker.description}
                                </Typography>
                                <Typography variant="caption">
                                  {marker.type} | {new Date(marker.timestamp).toLocaleTimeString()}
                                </Typography>
                              </Box>
                            }
                          />
                          <Chip
                            size="small"
                            label={`${(marker.significance * 100).toFixed(0)}%`}
                            color={marker.significance > 1.0 ? 'error' : marker.significance > 0.5 ? 'warning' : 'default'}
                          />
                        </ListItem>
                      ))}
                      {audioMarkers.length === 0 && (
                        <Typography color="textSecondary" align="center">
                          No markers added yet
                        </Typography>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {currentSession && (
                <Grid item xs={12}>
                  <Card>
                    <CardHeader title="Current Session Info" />
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" gutterBottom>
                            <strong>Name:</strong> {currentSession.name}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Location:</strong> {currentSession.location}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Duration:</strong> {Math.floor(sessionDuration / 60)}:{String(Math.floor(sessionDuration % 60)).padStart(2, '0')}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" gutterBottom>
                            <strong>Temperature:</strong> {currentSession.temperature}°C
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Moon Phase:</strong> {currentSession.moonPhase}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Investigators:</strong> {currentSession.investigatorNames.join(', ')}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          {/* Analytics Tab */}
          <TabPanel value={activeTab} index={4}>
            <Grid container spacing={3}>
              {sessionAnalytics && (
                <>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="primary">
                          {sessionAnalytics.totalEvents}
                        </Typography>
                        <Typography color="textSecondary">
                          Total Events
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="success.main">
                          {sessionAnalytics.wordDetections}
                        </Typography>
                        <Typography color="textSecondary">
                          Word Detections
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="warning.main">
                          {sessionAnalytics.communicationEvents}
                        </Typography>
                        <Typography color="textSecondary">
                          Communications
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="error.main">
                          {(sessionAnalytics.averageConfidence * 100).toFixed(1)}%
                        </Typography>
                        <Typography color="textSecondary">
                          Avg Confidence
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardHeader title="Significance Distribution" />
                      <CardContent>
                        <Box mb={2}>
                          <Typography variant="body2" gutterBottom>
                            High Significance: {sessionAnalytics.significanceDistribution.high}
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={(sessionAnalytics.significanceDistribution.high / sessionAnalytics.totalEvents) * 100}
                            color="error"
                          />
                        </Box>
                        <Box mb={2}>
                          <Typography variant="body2" gutterBottom>
                            Medium Significance: {sessionAnalytics.significanceDistribution.medium}
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={(sessionAnalytics.significanceDistribution.medium / sessionAnalytics.totalEvents) * 100}
                            color="warning"
                          />
                        </Box>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            Low Significance: {sessionAnalytics.significanceDistribution.low}
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={(sessionAnalytics.significanceDistribution.low / sessionAnalytics.totalEvents) * 100}
                            color="success"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardHeader title="Audio Quality Metrics" />
                      <CardContent>
                        <Typography variant="body2" gutterBottom>
                          Average SNR: {sessionAnalytics.audioQualityMetrics.averageSNR.toFixed(1)} dB
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Peak Amplitude: {sessionAnalytics.audioQualityMetrics.peakAmplitude.toFixed(3)}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Dynamic Range: {sessionAnalytics.audioQualityMetrics.dynamicRange.toFixed(1)} dB
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Silence Periods: {sessionAnalytics.audioQualityMetrics.silencePeriods}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              )}
            </Grid>
          </TabPanel>
        </Paper>
      </Box>

      {/* Dialogs */}
      <SessionStartDialog 
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onStart={startSession}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        scanSettings={scanSettings}
        detectionSettings={detectionSettings}
        noiseSettings={noiseSettings}
        onScanSettingsChange={setScanSettings}
        onDetectionSettingsChange={setDetectionSettings}
        onNoiseSettingsChange={setNoiseSettings}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        sessionRecorder={sessionRecorder.current}
      />

      {/* Alert Snackbar */}
      <Snackbar
        open={alertOpen}
        autoHideDuration={6000}
        onClose={() => setAlertOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setAlertOpen(false)}
          severity={alertSeverity}
          variant="filled"
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Session Start Dialog Component
interface SessionStartDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: (metadata: Partial<SessionMetadata>) => void;
}

const SessionStartDialog: React.FC<SessionStartDialogProps> = ({ open, onClose, onStart }) => {
  const [metadata, setMetadata] = useState<Partial<SessionMetadata>>({
    name: '',
    location: '',
    description: '',
    investigatorNames: [],
    temperature: 20,
    moonPhase: 'Unknown'
  });

  const handleStart = () => {
    onStart(metadata);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Start New Investigation Session</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Session Name"
              value={metadata.name}
              onChange={(e) => setMetadata(prev => ({ ...prev, name: e.target.value }))}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Location"
              value={metadata.location}
              onChange={(e) => setMetadata(prev => ({ ...prev, location: e.target.value }))}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={metadata.description}
              onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Investigators (comma separated)"
              value={metadata.investigatorNames?.join(', ')}
              onChange={(e) => setMetadata(prev => ({ 
                ...prev, 
                investigatorNames: e.target.value.split(',').map(name => name.trim())
              }))}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Temperature (°C)"
              value={metadata.temperature}
              onChange={(e) => setMetadata(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              margin="normal"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleStart} variant="contained">
          Start Session
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Settings Dialog Component
interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  scanSettings: Partial<ScanSettings>;
  detectionSettings: Partial<DetectionSettings>;
  noiseSettings: Partial<NoiseReductionSettings>;
  onScanSettingsChange: (settings: Partial<ScanSettings>) => void;
  onDetectionSettingsChange: (settings: Partial<DetectionSettings>) => void;
  onNoiseSettingsChange: (settings: Partial<NoiseReductionSettings>) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open, onClose, scanSettings, detectionSettings, noiseSettings,
  onScanSettingsChange, onDetectionSettingsChange, onNoiseSettingsChange
}) => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Spirit Box Settings</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Scanner" />
          <Tab label="Detection" />
          <Tab label="Audio" />
        </Tabs>

        {/* Scanner Settings */}
        {tabValue === 0 && (
          <Box mt={2}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Start Frequency (MHz)"
                  value={scanSettings.startFrequency}
                  onChange={(e) => onScanSettingsChange({ ...scanSettings, startFrequency: parseFloat(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="End Frequency (MHz)"
                  value={scanSettings.endFrequency}
                  onChange={(e) => onScanSettingsChange({ ...scanSettings, endFrequency: parseFloat(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Sweep Rate (ms)"
                  value={scanSettings.sweepRate}
                  onChange={(e) => onScanSettingsChange({ ...scanSettings, sweepRate: parseInt(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Signal Threshold (dBm)"
                  value={scanSettings.threshold}
                  onChange={(e) => onScanSettingsChange({ ...scanSettings, threshold: parseFloat(e.target.value) })}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={scanSettings.pauseOnSignal}
                      onChange={(e) => onScanSettingsChange({ ...scanSettings, pauseOnSignal: e.target.checked })}
                    />
                  }
                  label="Pause on Strong Signal"
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Detection Settings */}
        {tabValue === 1 && (
          <Box mt={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography gutterBottom>Confidence Threshold</Typography>
                <Slider
                  value={detectionSettings.confidenceThreshold || 0.3}
                  onChange={(_, value) => onDetectionSettingsChange({ ...detectionSettings, confidenceThreshold: value as number })}
                  min={0}
                  max={1}
                  step={0.1}
                  marks
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={detectionSettings.enablePhoneticMatching}
                      onChange={(e) => onDetectionSettingsChange({ ...detectionSettings, enablePhoneticMatching: e.target.checked })}
                    />
                  }
                  label="Enable Phonetic Matching"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={detectionSettings.enableSoundexMatching}
                      onChange={(e) => onDetectionSettingsChange({ ...detectionSettings, enableSoundexMatching: e.target.checked })}
                    />
                  }
                  label="Enable Soundex Matching"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={detectionSettings.realTimeDetection}
                      onChange={(e) => onDetectionSettingsChange({ ...detectionSettings, realTimeDetection: e.target.checked })}
                    />
                  }
                  label="Real-time Detection"
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Audio Settings */}
        {tabValue === 2 && (
          <Box mt={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={noiseSettings.enabled}
                      onChange={(e) => onNoiseSettingsChange({ ...noiseSettings, enabled: e.target.checked })}
                    />
                  }
                  label="Enable Noise Reduction"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography gutterBottom>Noise Reduction Aggressiveness</Typography>
                <Slider
                  value={noiseSettings.aggressiveness || 0.6}
                  onChange={(_, value) => onNoiseSettingsChange({ ...noiseSettings, aggressiveness: value as number })}
                  min={0}
                  max={1}
                  step={0.1}
                  marks
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={noiseSettings.preserveVoice}
                      onChange={(e) => onNoiseSettingsChange({ ...noiseSettings, preserveVoice: e.target.checked })}
                    />
                  }
                  label="Preserve Voice Frequencies"
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// Export Dialog Component
interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  sessionRecorder: SessionRecorder | null;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, sessionRecorder }) => {
  const [format, setFormat] = useState<'json' | 'csv' | 'wav' | 'txt' | 'xml'>('json');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includeMarkers, setIncludeMarkers] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);

  const handleExport = async () => {
    if (!sessionRecorder) return;

    try {
      const blob = await sessionRecorder.exportSession({
        format,
        includeAudio,
        includeMetadata,
        includeEvents,
        includeMarkers,
        includeAnalytics
      });

      // Create download link
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spirit_box_session_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Session Data</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
              >
                <MenuItem value="json">JSON</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="txt">Text</MenuItem>
                <MenuItem value="xml">XML</MenuItem>
                <MenuItem value="wav">WAV Audio</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {format !== 'wav' && (
            <>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeMetadata}
                      onChange={(e) => setIncludeMetadata(e.target.checked)}
                    />
                  }
                  label="Include Metadata"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeEvents}
                      onChange={(e) => setIncludeEvents(e.target.checked)}
                    />
                  }
                  label="Include Events"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeMarkers}
                      onChange={(e) => setIncludeMarkers(e.target.checked)}
                    />
                  }
                  label="Include Markers"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeAnalytics}
                      onChange={(e) => setIncludeAnalytics(e.target.checked)}
                    />
                  }
                  label="Include Analytics"
                />
              </Grid>
            </>
          )}
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                />
              }
              label="Include Audio Data"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleExport} variant="contained">
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SpiritBoxDashboard;