import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  LinearProgress,
  Typography,
  Box,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  CardActions,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Snackbar,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Download,
  Security,
  Update,
  CheckCircle,
  Error,
  Warning,
  Info,
  Close,
  ExpandMore,
  Refresh,
  History,
  Settings,
  PlayArrow,
  Pause,
  Stop,
  RestartAlt
} from '@mui/icons-material';
import {
  UpdateInfo,
  UpdateProgress,
  UpdateSystemState,
  UpdateError,
  UpdateNotification,
  VersionHistory,
  SubscriptionInfo,
  RollbackInfo,
  UpdatePolicy
} from './types';

interface UpdateUIManagerProps {
  initialState?: UpdateSystemState;
  onCheckForUpdates?: () => Promise<void>;
  onDownloadUpdate?: () => Promise<void>;
  onInstallUpdate?: () => Promise<void>;
  onRollback?: (version?: string) => Promise<void>;
  onUpdatePolicy?: (policy: Partial<UpdatePolicy>) => Promise<void>;
}

export const UpdateUIManager: React.FC<UpdateUIManagerProps> = ({
  initialState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onRollback,
  onUpdatePolicy
}) => {
  const [state, setState] = useState<UpdateSystemState>(initialState || {
    initialized: false,
    checking: false,
    downloading: false,
    installing: false,
    rollingBack: false,
    lastCheck: null,
    currentProgress: null,
    availableUpdate: null,
    pendingUpdate: null,
    error: null,
    subscription: null,
    rollbackVersions: [],
    notifications: []
  });

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [versionHistory, setVersionHistory] = useState<VersionHistory | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Update state when external events occur
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const handleUpdateEvent = (event: any, data: any) => {
        setState(prevState => {
          const newState = { ...prevState };
          
          switch (data.type) {
            case 'checking-for-updates':
              newState.checking = true;
              break;
            case 'update-available':
              newState.availableUpdate = data.data;
              newState.checking = false;
              setShowUpdateDialog(true);
              break;
            case 'update-not-available':
              newState.checking = false;
              showSnackbar('No updates available');
              break;
            case 'download-progress':
              newState.currentProgress = data.data;
              newState.downloading = true;
              break;
            case 'update-downloaded':
              newState.pendingUpdate = data.data;
              newState.downloading = false;
              showSnackbar('Update downloaded and ready to install');
              break;
            case 'update-error':
              newState.error = data.data;
              newState.checking = false;
              newState.downloading = false;
              newState.installing = false;
              break;
            case 'rollback-complete':
              newState.rollingBack = false;
              showSnackbar(`Rollback to ${data.data.version} completed`);
              break;
          }
          
          return newState;
        });
      };

      window.electronAPI.on('update-event', handleUpdateEvent);
      
      return () => {
        window.electronAPI.off('update-event', handleUpdateEvent);
      };
    }
  }, []);

  const showSnackbar = useCallback((message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    try {
      await onCheckForUpdates?.();
    } catch (error) {
      showSnackbar('Failed to check for updates');
    }
  }, [onCheckForUpdates, showSnackbar]);

  const handleDownloadUpdate = useCallback(async () => {
    try {
      await onDownloadUpdate?.();
    } catch (error) {
      showSnackbar('Failed to download update');
    }
  }, [onDownloadUpdate, showSnackbar]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      await onInstallUpdate?.();
    } catch (error) {
      showSnackbar('Failed to install update');
    }
  }, [onInstallUpdate, showSnackbar]);

  const handleRollback = useCallback(async (version?: string) => {
    try {
      await onRollback?.(version);
    } catch (error) {
      showSnackbar('Failed to rollback');
    }
  }, [onRollback, showSnackbar]);

  const getUpdateStage = (): number => {
    if (state.checking) return 0;
    if (state.downloading) return 1;
    if (state.pendingUpdate) return 2;
    if (state.installing) return 3;
    return 0;
  };

  const getStageLabel = (stage: number): string => {
    const stages = ['Checking', 'Downloading', 'Ready to Install', 'Installing'];
    return stages[stage] || 'Unknown';
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getSubscriptionStatusColor = (subscription: SubscriptionInfo | null): 'success' | 'warning' | 'error' => {
    if (!subscription) return 'error';
    if (subscription.status === 'active') {
      const daysRemaining = Math.ceil((subscription.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysRemaining > 30) return 'success';
      if (daysRemaining > 7) return 'warning';
    }
    return 'error';
  };

  return (
    <>
      {/* Main Update Status Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">System Updates</Typography>
            <Box>
              <Tooltip title="Version History">
                <IconButton onClick={() => setShowHistoryDialog(true)}>
                  <History />
                </IconButton>
              </Tooltip>
              <Tooltip title="Update Settings">
                <IconButton onClick={() => setShowSettingsDialog(true)}>
                  <Settings />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Current Status */}
          <Box mb={2}>
            <Typography variant="body2" color="textSecondary">
              Current Version: {process.env.npm_package_version || '1.0.0'}
            </Typography>
            {state.lastCheck && (
              <Typography variant="body2" color="textSecondary">
                Last Checked: {state.lastCheck.toLocaleString()}
              </Typography>
            )}
          </Box>

          {/* Progress Indicator */}
          {(state.checking || state.downloading || state.installing) && (
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2">
                  {state.checking && 'Checking for updates...'}
                  {state.downloading && 'Downloading update...'}
                  {state.installing && 'Installing update...'}
                </Typography>
                {state.currentProgress && (
                  <Typography variant="body2" color="textSecondary">
                    {Math.round(state.currentProgress.percent)}%
                  </Typography>
                )}
              </Box>
              <LinearProgress 
                variant={state.currentProgress ? "determinate" : "indeterminate"}
                value={state.currentProgress?.percent || 0}
                sx={{ mb: 1 }}
              />
              {state.currentProgress && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption">
                    {formatFileSize(state.currentProgress.transferred)} / {formatFileSize(state.currentProgress.total)}
                  </Typography>
                  <Typography variant="caption">
                    {formatFileSize(state.currentProgress.bytesPerSecond)}/s
                    {state.currentProgress.estimatedTimeRemaining && 
                      ` • ${formatDuration(state.currentProgress.estimatedTimeRemaining)} remaining`
                    }
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Error Display */}
          {state.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>{state.error.code}</strong>: {state.error.message}
              </Typography>
            </Alert>
          )}

          {/* Subscription Status */}
          {state.subscription && (
            <Alert 
              severity={getSubscriptionStatusColor(state.subscription)} 
              sx={{ mb: 2 }}
            >
              <Typography variant="body2">
                Subscription: {state.subscription.tier} ({state.subscription.status})
                {state.subscription.status === 'active' && (
                  <>
                    {' • Expires: '}
                    {state.subscription.expiresAt.toLocaleDateString()}
                  </>
                )}
              </Typography>
            </Alert>
          )}

          {/* Available Update Info */}
          {state.availableUpdate && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Update Available:</strong> Version {state.availableUpdate.version}
                {state.availableUpdate.criticalUpdate && ' (Critical Update)'}
              </Typography>
              {state.availableUpdate.releaseNotes && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {state.availableUpdate.releaseNotes}
                </Typography>
              )}
            </Alert>
          )}

          {/* Pending Update Info */}
          {state.pendingUpdate && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Update Ready:</strong> Version {state.pendingUpdate.version} is ready to install
              </Typography>
            </Alert>
          )}
        </CardContent>

        <CardActions>
          <Button
            startIcon={<Refresh />}
            onClick={handleCheckForUpdates}
            disabled={state.checking || state.downloading || state.installing}
          >
            Check for Updates
          </Button>

          {state.availableUpdate && !state.downloading && !state.pendingUpdate && (
            <Button
              startIcon={<Download />}
              onClick={handleDownloadUpdate}
              variant="contained"
              color="primary"
            >
              Download Update
            </Button>
          )}

          {state.pendingUpdate && !state.installing && (
            <Button
              startIcon={<Update />}
              onClick={handleInstallUpdate}
              variant="contained"
              color="success"
            >
              Install & Restart
            </Button>
          )}

          {state.rollbackVersions.length > 0 && (
            <Button
              startIcon={<RestartAlt />}
              onClick={() => handleRollback()}
              variant="outlined"
              color="warning"
            >
              Rollback
            </Button>
          )}
        </CardActions>
      </Card>

      {/* Update Dialog */}
      <Dialog 
        open={showUpdateDialog} 
        onClose={() => setShowUpdateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Update Available
          {state.availableUpdate?.criticalUpdate && (
            <Chip 
              label="Critical" 
              color="error" 
              size="small" 
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {state.availableUpdate && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Version {state.availableUpdate.version}
              </Typography>
              
              <Box display="flex" gap={2} mb={2}>
                <Chip 
                  label={`Size: ${formatFileSize(state.availableUpdate.size)}`} 
                  variant="outlined" 
                />
                <Chip 
                  label={`Channel: ${state.availableUpdate.channel}`} 
                  variant="outlined" 
                />
                {state.availableUpdate.rollbackSupported && (
                  <Chip 
                    label="Rollback Supported" 
                    variant="outlined" 
                    color="success" 
                  />
                )}
              </Box>

              {state.availableUpdate.releaseNotes && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Release Notes:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <div dangerouslySetInnerHTML={{ __html: state.availableUpdate.releaseNotes }} />
                  </Typography>
                </Box>
              )}

              <Stepper activeStep={getUpdateStage()} orientation="vertical">
                {['Checking', 'Downloading', 'Ready to Install', 'Installing'].map((label, index) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        {index === 1 && state.currentProgress && (
                          <>
                            Progress: {Math.round(state.currentProgress.percent)}%
                            <br />
                            Speed: {formatFileSize(state.currentProgress.bytesPerSecond)}/s
                          </>
                        )}
                      </Typography>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUpdateDialog(false)}>
            Later
          </Button>
          {!state.pendingUpdate && (
            <Button onClick={handleDownloadUpdate} variant="contained">
              Download Now
            </Button>
          )}
          {state.pendingUpdate && (
            <Button onClick={handleInstallUpdate} variant="contained" color="success">
              Install & Restart
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog 
        open={showHistoryDialog} 
        onClose={() => setShowHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Version History</DialogTitle>
        <DialogContent>
          <List>
            {state.rollbackVersions.map((version, index) => (
              <React.Fragment key={version.version}>
                <ListItem>
                  <ListItemIcon>
                    {index === 0 ? <CheckCircle color="success" /> : <History />}
                  </ListItemIcon>
                  <ListItemText
                    primary={`Version ${version.version}`}
                    secondary={`Installed: ${version.installDate.toLocaleString()}`}
                  />
                  {version.version !== process.env.npm_package_version && (
                    <Button
                      size="small"
                      onClick={() => handleRollback(version.version)}
                      disabled={state.rollingBack}
                    >
                      Rollback
                    </Button>
                  )}
                </ListItem>
                {index < state.rollbackVersions.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog 
        open={showSettingsDialog} 
        onClose={() => setShowSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Settings</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Automatic Updates</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Enable automatic updates"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Install updates automatically"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Download updates in background"
                />
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Security Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Verify update signatures"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Check certificate validity"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Validate subscription"
                />
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Download Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={<Switch />}
                  label="Download only on WiFi"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Pause downloads on battery"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Resume interrupted downloads"
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>Cancel</Button>
          <Button variant="contained">Save Settings</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={() => setSnackbarOpen(false)}
          >
            <Close fontSize="small" />
          </IconButton>
        }
      />

      {/* Notification Components */}
      {state.notifications.map((notification) => (
        <UpdateNotificationComponent
          key={notification.id}
          notification={notification}
          onClose={() => {
            setState(prevState => ({
              ...prevState,
              notifications: prevState.notifications.filter(n => n.id !== notification.id)
            }));
          }}
        />
      ))}
    </>
  );
};

// Individual notification component
const UpdateNotificationComponent: React.FC<{
  notification: UpdateNotification;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle />;
      case 'warning': return <Warning />;
      case 'error': return <Error />;
      default: return <Info />;
    }
  };

  const getColor = (): 'success' | 'warning' | 'error' | 'info' => {
    return notification.type === 'success' ? 'success' :
           notification.type === 'warning' ? 'warning' :
           notification.type === 'error' ? 'error' : 'info';
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {getIcon()}
          {notification.title}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          {notification.message}
        </Typography>
      </DialogContent>
      <DialogActions>
        {notification.actions?.map((action) => (
          <Button
            key={action.id}
            onClick={action.callback}
            variant={action.style === 'primary' ? 'contained' : 'outlined'}
            color={action.style === 'danger' ? 'error' : 'primary'}
          >
            {action.label}
          </Button>
        ))}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateUIManager;