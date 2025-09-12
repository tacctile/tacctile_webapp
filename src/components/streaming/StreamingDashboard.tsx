import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Button,
  IconButton,
  Chip,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Badge,
  Alert,
  Divider,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Chat as ChatIcon,
  Visibility as ViewersIcon,
  Signal as SignalIcon,
  Error as ErrorIcon,
  CheckCircle as ConnectedIcon,
  Pending as PendingIcon,
  Refresh as RefreshIcon,
  VideoSettings as VideoSettingsIcon,
  Stream as StreamIcon,
  Security as KeyIcon,
  Assessment as StatsIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import StreamingCore, { StreamPlatform, StreamHealth, StreamStats } from '../../services/streaming/StreamingCore';
import ChatManager, { ChatMessage, ChatStats } from '../../services/streaming/ChatManager';

interface StreamingDashboardProps {
  onOverlayOpen?: () => void;
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
      id={`streaming-tabpanel-${index}`}
      aria-labelledby={`streaming-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const StreamingDashboard: React.FC<StreamingDashboardProps> = ({ onOverlayOpen }) => {
  const [streamingCore] = useState(() => new StreamingCore());
  const [chatManager] = useState(() => new ChatManager());
  
  const [tabValue, setTabValue] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [platforms, setPlatforms] = useState<StreamPlatform[]>([]);
  const [streamHealth, setStreamHealth] = useState<StreamHealth[]>([]);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState('');

  // Initialize streaming services
  useEffect(() => {
    const initialize = async () => {
      try {
        await streamingCore.startServer();
        setPlatforms(streamingCore.getPlatforms());
        setStreamHealth(streamingCore.getStreamHealth());
      } catch (error) {
        console.error('Failed to initialize streaming server:', error);
      }
    };

    initialize();

    // Setup event listeners
    streamingCore.on('streamStarted', () => {
      setIsStreaming(true);
    });

    streamingCore.on('streamEnded', () => {
      setIsStreaming(false);
    });

    streamingCore.on('streamHealthUpdate', ({ platformId, health }) => {
      setStreamHealth(prev => {
        const updated = prev.filter(h => h.platform !== health.platform);
        return [...updated, health];
      });
    });

    streamingCore.on('platformUpdated', ({ platformId, platform }) => {
      setPlatforms(prev => prev.map(p => p.id === platformId ? platform : p));
    });

    chatManager.on('newMessage', (message: ChatMessage) => {
      setRecentMessages(prev => [message, ...prev.slice(0, 49)]);
    });

    chatManager.on('platformConnected', ({ platform }) => {
      console.log(`Connected to ${platform} chat`);
    });

    // Update stats periodically
    const statsInterval = setInterval(() => {
      if (isStreaming) {
        setStreamStats(streamingCore.getStreamStats());
      }
      setChatStats(chatManager.getChatStats());
    }, 5000);

    return () => {
      clearInterval(statsInterval);
      streamingCore.removeAllListeners();
      chatManager.removeAllListeners();
      streamingCore.stopServer();
      chatManager.disconnectFromPlatforms();
    };
  }, [streamingCore, chatManager, isStreaming]);

  const handleStartStream = useCallback(async () => {
    try {
      // The actual streaming would be initiated by OBS or similar software
      // connecting to our local RTMP server
      console.log('Stream server ready at:', streamingCore.getLocalRtmpUrl());
      await chatManager.connectToPlatforms();
    } catch (error) {
      console.error('Failed to start stream:', error);
    }
  }, [streamingCore, chatManager]);

  const handleStopStream = useCallback(async () => {
    try {
      await chatManager.disconnectFromPlatforms();
      setIsStreaming(false);
    } catch (error) {
      console.error('Failed to stop stream:', error);
    }
  }, [chatManager]);

  const handlePlatformToggle = useCallback((platformId: string, enabled: boolean) => {
    streamingCore.updatePlatform(platformId, { enabled });
    
    // Update chat manager as well
    const chatPlatforms = chatManager.getPlatformConfigs();
    const chatPlatform = chatPlatforms.find(p => p.id === platformId);
    if (chatPlatform) {
      chatManager.updatePlatformConfig(platformId, { enabled });
    }
  }, [streamingCore, chatManager]);

  const handleStreamKeyUpdate = useCallback((platformId: string, key: string) => {
    streamingCore.updatePlatform(platformId, { streamKey: key });
  }, [streamingCore]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'connecting': return 'info';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <ConnectedIcon />;
      case 'connecting': return <PendingIcon />;
      case 'error': return <ErrorIcon />;
      default: return <ErrorIcon />;
    }
  };

  const formatBitrate = (bitrate: number) => {
    if (bitrate >= 1000) {
      return `${(bitrate / 1000).toFixed(1)}k`;
    }
    return `${bitrate}`;
  };

  const formatUptime = (uptime: number) => {
    if (uptime === 0) return '0s';
    
    const seconds = Math.floor((Date.now() - uptime) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const openPlatformSettings = (platform: StreamPlatform) => {
    setSelectedPlatform(platform.id);
    setStreamKey(platform.streamKey);
    setSettingsOpen(true);
  };

  const savePlatformSettings = () => {
    if (selectedPlatform) {
      handleStreamKeyUpdate(selectedPlatform, streamKey);
    }
    setSettingsOpen(false);
    setSelectedPlatform(null);
    setStreamKey('');
  };

  const totalViewers = streamStats?.totalViewers || 0;
  const totalMessages = chatStats?.totalMessages || 0;
  const messagesPerMinute = chatStats?.messagesPerMinute || 0;

  return (
    <Box>
      {/* Main Control Header */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item>
            <Box display="flex" alignItems="center" gap={2}>
              <StreamIcon sx={{ fontSize: 40, color: isStreaming ? '#4caf50' : '#757575' }} />
              <Box>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Live Streaming
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  {isStreaming ? 'Broadcasting Live' : 'Ready to Stream'}
                </Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs />
          
          <Grid item>
            <Box display="flex" alignItems="center" gap={2}>
              {isStreaming && (
                <>
                  <Box textAlign="center">
                    <Typography variant="h4" sx={{ color: '#4caf50' }}>
                      {totalViewers.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Viewers
                    </Typography>
                  </Box>
                  
                  <Box textAlign="center">
                    <Typography variant="h4" sx={{ color: '#2196f3' }}>
                      {messagesPerMinute}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Msg/Min
                    </Typography>
                  </Box>
                </>
              )}
              
              <Button
                variant="contained"
                size="large"
                startIcon={isStreaming ? <StopIcon /> : <PlayIcon />}
                color={isStreaming ? 'error' : 'success'}
                onClick={isStreaming ? handleStopStream : handleStartStream}
              >
                {isStreaming ? 'Stop Stream' : 'Start Stream'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Stream URL Info */}
      {!isStreaming && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Stream URL: <code>{streamingCore.getLocalRtmpUrl()}/your-stream-key</code>
          </Typography>
          <Typography variant="caption">
            Use this URL in OBS Studio or your streaming software to broadcast to multiple platforms.
          </Typography>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab 
            label={
              <Badge badgeContent={platforms.filter(p => p.enabled).length} color="primary">
                Platforms
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={totalMessages} color="secondary" max={999}>
                Chat
              </Badge>
            }
          />
          <Tab label="Analytics" />
          <Tab label="Settings" />
        </Tabs>
      </Box>

      {/* Platforms Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {platforms.map((platform) => {
            const health = streamHealth.find(h => h.platform === platform.name);
            const isConnected = health?.status === 'connected';
            
            return (
              <Grid item xs={12} md={6} key={platform.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: isConnected ? 'success.main' : 'grey.500' }}>
                          {platform.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{platform.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {platform.rtmpUrl}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box display="flex" alignItems="center" gap={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={platform.enabled}
                              onChange={(e) => handlePlatformToggle(platform.id, e.target.checked)}
                            />
                          }
                          label=""
                        />
                        <IconButton onClick={() => openPlatformSettings(platform)}>
                          <SettingsIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    {platform.enabled && (
                      <Box>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Chip
                            icon={getHealthStatusIcon(health?.status || 'disconnected')}
                            label={health?.status || 'disconnected'}
                            color={getHealthStatusColor(health?.status || 'disconnected') as any}
                            size="small"
                          />
                          {health?.status === 'connected' && (
                            <Typography variant="caption" color="text.secondary">
                              {formatUptime(health.uptime)}
                            </Typography>
                          )}
                        </Box>

                        {health?.status === 'connected' && (
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Bitrate</Typography>
                              <Typography variant="body2">
                                {formatBitrate(health.bitrate)} kbps
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">FPS</Typography>
                              <Typography variant="body2">{health.fps}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Dropped</Typography>
                              <Typography variant="body2">
                                {health.droppedFrames}/{health.totalFrames}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Ping</Typography>
                              <Typography variant="body2">{health.ping}ms</Typography>
                            </Grid>
                          </Grid>
                        )}

                        {health?.lastError && (
                          <Alert severity="error" sx={{ mt: 2 }}>
                            {health.lastError}
                          </Alert>
                        )}

                        {!platform.streamKey && platform.enabled && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                            Stream key not configured
                          </Alert>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </TabPanel>

      {/* Chat Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Live Chat</Typography>
                  <IconButton onClick={() => setRecentMessages([])}>
                    <RefreshIcon />
                  </IconButton>
                </Box>
                
                <Box sx={{ height: 400, overflowY: 'auto' }}>
                  <List dense>
                    {recentMessages.length === 0 ? (
                      <Box p={4} textAlign="center">
                        <Typography variant="body2" color="text.secondary">
                          No messages yet. Start streaming to see live chat.
                        </Typography>
                      </Box>
                    ) : (
                      recentMessages.map((message) => (
                        <ListItem key={message.id} divider>
                          <ListItemIcon>
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                              {message.platform.charAt(0)}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography
                                  variant="body2"
                                  fontWeight={message.isModerator ? 'bold' : 'normal'}
                                  color={message.color || 'text.primary'}
                                >
                                  {message.displayName}
                                </Typography>
                                {message.badges.map((badge, i) => (
                                  <Chip key={i} label={badge} size="small" variant="outlined" />
                                ))}
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2">{message.message}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {message.timestamp.toLocaleTimeString()}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Chat Statistics</Typography>
                
                {chatStats && (
                  <Box>
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">Total Messages</Typography>
                      <Typography variant="h4">{chatStats.totalMessages.toLocaleString()}</Typography>
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">Messages/Min</Typography>
                      <Typography variant="h4">{chatStats.messagesPerMinute}</Typography>
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">Unique Users</Typography>
                      <Typography variant="h4">{chatStats.uniqueUsers.toLocaleString()}</Typography>
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>Top Chatters</Typography>
                    <List dense>
                      {chatStats.topChatters.slice(0, 5).map((chatter, index) => (
                        <ListItem key={chatter.username}>
                          <ListItemText
                            primary={chatter.username}
                            secondary={`${chatter.messageCount} messages`}
                          />
                          <ListItemSecondaryAction>
                            <Chip label={`#${index + 1}`} size="small" />
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Stream Quality</Typography>
                
                {streamStats && (
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="body2">Overall Quality</Typography>
                      <Chip
                        label={streamStats.quality}
                        color={
                          streamStats.quality === 'excellent' ? 'success' :
                          streamStats.quality === 'good' ? 'info' :
                          streamStats.quality === 'fair' ? 'warning' : 'error'
                        }
                      />
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">Total Bandwidth</Typography>
                      <Typography variant="h4">{formatBitrate(streamStats.bandwidth)} kbps</Typography>
                    </Box>
                    
                    {streamStats.warnings.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Warnings</Typography>
                        {streamStats.warnings.map((warning, index) => (
                          <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                            {warning}
                          </Alert>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Platform Breakdown</Typography>
                
                {streamStats && Object.entries(streamStats.platformViewers).length > 0 ? (
                  <List>
                    {Object.entries(streamStats.platformViewers).map(([platform, viewers]) => (
                      <ListItem key={platform}>
                        <ListItemText
                          primary={platform}
                          secondary={`${viewers.toLocaleString()} viewers`}
                        />
                        <ListItemSecondaryAction>
                          <Typography variant="h6" color="primary">
                            {Math.round((viewers / totalViewers) * 100)}%
                          </Typography>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No viewer data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Stream Settings</Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure your streaming preferences and platform settings
                </Typography>
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    startIcon={<VideoSettingsIcon />}
                    onClick={onOverlayOpen}
                  >
                    Configure Overlays
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Platform Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Platform Settings
          {selectedPlatform && (
            <Typography variant="subtitle2" color="text.secondary">
              {platforms.find(p => p.id === selectedPlatform)?.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Stream Key"
            type="password"
            value={streamKey}
            onChange={(e) => setStreamKey(e.target.value)}
            margin="normal"
            helperText="Enter your platform-specific stream key"
            InputProps={{
              startAdornment: <KeyIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button onClick={savePlatformSettings} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};