import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  Tabs,
  Tab
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Brightness3 as MoonIcon,
  Thermostat as TempIcon,
  ElectricBolt as EMFIcon,
  People as TeamIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { AstronomicalCalculations, MoonPhaseData } from '../../services/environment/AstronomicalCalculations';

export interface OverlayElement {
  id: string;
  type: 'location' | 'moon-phase' | 'emf-reading' | 'temperature' | 'team-members' | 'timestamp' | 'custom-text';
  visible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    fontFamily: string;
    padding: number;
    shadow: boolean;
  };
  content?: unknown; // Element-specific content
  zIndex: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  active: boolean;
}

export interface InvestigationData {
  location: {
    name: string;
    coordinates: string;
    elevation: number;
  };
  environmental: {
    emfReading: number;
    temperature: number;
    humidity: number;
    pressure: number;
  };
  team: TeamMember[];
  session: {
    startTime: Date;
    duration: number;
    investigator: string;
  };
}

interface InvestigationOverlayProps {
  data: InvestigationData;
  onDataUpdate?: (data: Partial<InvestigationData>) => void;
  canvasWidth: number;
  canvasHeight: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export const InvestigationOverlay: React.FC<InvestigationOverlayProps> = ({
  data,
  onDataUpdate: _onDataUpdate,
  canvasWidth,
  canvasHeight
}) => {
  const [overlayElements, setOverlayElements] = useState<OverlayElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [moonPhase, setMoonPhase] = useState<MoonPhaseData | null>(null);
  const [astronomicalCalc] = useState(() => new AstronomicalCalculations({ latitude: 40.7128, longitude: -74.0060 }));

  const overlayRef = useRef<HTMLDivElement>(null);

  // Initialize default overlay elements
  useEffect(() => {
    const defaultElements: OverlayElement[] = [
      {
        id: 'location',
        type: 'location',
        visible: true,
        position: { x: 50, y: 50 },
        size: { width: 300, height: 80 },
        style: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          textColor: '#ffffff',
          borderColor: '#bb86fc',
          borderWidth: 2,
          borderRadius: 8,
          opacity: 0.9,
          fontSize: 16,
          fontWeight: 'bold',
          fontFamily: 'Arial, sans-serif',
          padding: 12,
          shadow: true
        },
        zIndex: 100
      },
      {
        id: 'moon-phase',
        type: 'moon-phase',
        visible: true,
        position: { x: canvasWidth - 200, y: 50 },
        size: { width: 150, height: 120 },
        style: {
          backgroundColor: 'rgba(25, 25, 50, 0.9)',
          textColor: '#ffffff',
          borderColor: '#4caf50',
          borderWidth: 1,
          borderRadius: 12,
          opacity: 0.9,
          fontSize: 14,
          fontWeight: 'normal',
          fontFamily: 'Arial, sans-serif',
          padding: 10,
          shadow: true
        },
        zIndex: 101
      },
      {
        id: 'emf-reading',
        type: 'emf-reading',
        visible: true,
        position: { x: 50, y: canvasHeight - 200 },
        size: { width: 200, height: 100 },
        style: {
          backgroundColor: 'rgba(139, 69, 19, 0.9)',
          textColor: '#ffeb3b',
          borderColor: '#ff9800',
          borderWidth: 2,
          borderRadius: 6,
          opacity: 0.95,
          fontSize: 18,
          fontWeight: 'bold',
          fontFamily: 'Courier New, monospace',
          padding: 8,
          shadow: true
        },
        zIndex: 102
      },
      {
        id: 'temperature',
        type: 'temperature',
        visible: true,
        position: { x: 270, y: canvasHeight - 200 },
        size: { width: 180, height: 100 },
        style: {
          backgroundColor: 'rgba(33, 150, 243, 0.9)',
          textColor: '#ffffff',
          borderColor: '#2196f3',
          borderWidth: 1,
          borderRadius: 6,
          opacity: 0.9,
          fontSize: 16,
          fontWeight: 'normal',
          fontFamily: 'Arial, sans-serif',
          padding: 8,
          shadow: true
        },
        zIndex: 103
      },
      {
        id: 'team-members',
        type: 'team-members',
        visible: true,
        position: { x: canvasWidth - 300, y: canvasHeight - 150 },
        size: { width: 250, height: 120 },
        style: {
          backgroundColor: 'rgba(76, 175, 80, 0.9)',
          textColor: '#ffffff',
          borderColor: '#4caf50',
          borderWidth: 1,
          borderRadius: 10,
          opacity: 0.9,
          fontSize: 14,
          fontWeight: 'normal',
          fontFamily: 'Arial, sans-serif',
          padding: 10,
          shadow: true
        },
        zIndex: 104
      },
      {
        id: 'timestamp',
        type: 'timestamp',
        visible: true,
        position: { x: canvasWidth - 200, y: 20 },
        size: { width: 180, height: 60 },
        style: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          textColor: '#ffffff',
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 4,
          opacity: 0.8,
          fontSize: 12,
          fontWeight: 'normal',
          fontFamily: 'Courier New, monospace',
          padding: 6,
          shadow: false
        },
        zIndex: 99
      }
    ];

    setOverlayElements(defaultElements);
  }, [canvasWidth, canvasHeight]);

  // Update moon phase data
  useEffect(() => {
    try {
      const moonData = astronomicalCalc.getMoonPhaseData();
      setMoonPhase(moonData);
    } catch (error) {
      console.error('Failed to get moon phase data:', error);
    }
  }, [astronomicalCalc]);

  const handleElementClick = useCallback((elementId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedElement(elementId);
  }, []);

  const handleMouseDown = useCallback((elementId: string, event: React.MouseEvent) => {
    const element = overlayElements.find(e => e.id === elementId);
    if (!element) return;

    setIsDragging(true);
    setSelectedElement(elementId);
    
    const rect = overlayRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: event.clientX - rect.left - element.position.x,
        y: event.clientY - rect.top - element.position.y
      });
    }
  }, [overlayElements]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging || !selectedElement || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const newX = event.clientX - rect.left - dragOffset.x;
    const newY = event.clientY - rect.top - dragOffset.y;

    setOverlayElements(prev => prev.map(element => 
      element.id === selectedElement
        ? {
            ...element,
            position: {
              x: Math.max(0, Math.min(newX, canvasWidth - element.size.width)),
              y: Math.max(0, Math.min(newY, canvasHeight - element.size.height))
            }
          }
        : element
    ));
  }, [isDragging, selectedElement, dragOffset, canvasWidth, canvasHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const updateElementStyle = useCallback((elementId: string, styleUpdates: Partial<OverlayElement['style']>) => {
    setOverlayElements(prev => prev.map(element =>
      element.id === elementId
        ? { ...element, style: { ...element.style, ...styleUpdates } }
        : element
    ));
  }, []);

  const toggleElementVisibility = useCallback((elementId: string) => {
    setOverlayElements(prev => prev.map(element =>
      element.id === elementId
        ? { ...element, visible: !element.visible }
        : element
    ));
  }, []);

  const renderOverlayElement = useCallback((element: OverlayElement) => {
    if (!element.visible) return null;

    const commonStyles = {
      position: 'absolute' as const,
      left: element.position.x,
      top: element.position.y,
      width: element.size.width,
      height: element.size.height,
      backgroundColor: element.style.backgroundColor,
      color: element.style.textColor,
      border: element.style.borderWidth > 0 ? `${element.style.borderWidth}px solid ${element.style.borderColor}` : 'none',
      borderRadius: element.style.borderRadius,
      opacity: element.style.opacity,
      fontSize: element.style.fontSize,
      fontWeight: element.style.fontWeight,
      fontFamily: element.style.fontFamily,
      padding: element.style.padding,
      boxShadow: element.style.shadow ? '0 4px 8px rgba(0,0,0,0.3)' : 'none',
      zIndex: element.zIndex,
      cursor: 'move',
      userSelect: 'none' as const,
      transition: isDragging && selectedElement === element.id ? 'none' : 'all 0.2s ease'
    };

    const handleElementMouseDown = (event: React.MouseEvent) => {
      handleMouseDown(element.id, event);
    };

    const handleElementClick = (event: React.MouseEvent) => {
      handleElementClick(element.id, event);
    };

    switch (element.type) {
      case 'location':
        return (
          <Box
            key={element.id}
            style={commonStyles}
            onMouseDown={handleElementMouseDown}
            onClick={handleElementClick}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <LocationIcon />
              <Box>
                <Typography variant="body1" fontWeight="bold">
                  {data.location.name}
                </Typography>
                <Typography variant="caption">
                  {data.location.coordinates}
                </Typography>
              </Box>
            </Box>
          </Box>
        );

      case 'moon-phase':
        return (
          <Box
            key={element.id}
            style={commonStyles}
            onMouseDown={handleElementMouseDown}
            onClick={handleElementClick}
          >
            <Box textAlign="center">
              <MoonIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="body2" fontWeight="bold">
                {moonPhase?.phase || 'Unknown'}
              </Typography>
              <Typography variant="caption">
                {moonPhase ? `${Math.round(moonPhase.illumination * 100)}% illuminated` : ''}
              </Typography>
            </Box>
          </Box>
        );

      case 'emf-reading':
        return (
          <Box
            key={element.id}
            style={commonStyles}
            onMouseDown={handleElementMouseDown}
            onClick={handleElementClick}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <EMFIcon sx={{ fontSize: 30 }} />
              <Box textAlign="right">
                <Typography variant="h4" component="div">
                  {data.environmental.emfReading.toFixed(1)}
                </Typography>
                <Typography variant="caption">mG</Typography>
              </Box>
            </Box>
            <Typography variant="caption" display="block" mt={1}>
              EMF Reading
            </Typography>
          </Box>
        );

      case 'temperature':
        return (
          <Box
            key={element.id}
            style={commonStyles}
            onMouseDown={handleElementMouseDown}
            onClick={handleElementClick}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <TempIcon sx={{ fontSize: 30 }} />
              <Box textAlign="right">
                <Typography variant="h4" component="div">
                  {data.environmental.temperature.toFixed(1)}°
                </Typography>
                <Typography variant="caption">
                  {data.environmental.humidity.toFixed(0)}% RH
                </Typography>
              </Box>
            </Box>
            <Typography variant="caption" display="block" mt={1}>
              Temperature / Humidity
            </Typography>
          </Box>
        );

      case 'team-members':
        return (
          <Box
            key={element.id}
            style={commonStyles}
            onMouseDown={handleElementMouseDown}
            onClick={handleElementClick}
          >
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <TeamIcon />
              <Typography variant="body2" fontWeight="bold">
                Investigation Team
              </Typography>
            </Box>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {data.team.filter(member => member.active).map(member => (
                <Chip
                  key={member.id}
                  label={member.name}
                  size="small"
                  avatar={<Avatar sx={{ width: 20, height: 20 }}>{member.name.charAt(0)}</Avatar>}
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
            </Box>
          </Box>
        );

      case 'timestamp':
        return (
          <Box
            key={element.id}
            style={commonStyles}
            onMouseDown={handleElementMouseDown}
            onClick={handleElementClick}
          >
            <Typography variant="body2" textAlign="center">
              {new Date().toLocaleString()}
            </Typography>
            <Typography variant="caption" textAlign="center" display="block">
              Session: {Math.floor((Date.now() - data.session.startTime.getTime()) / 60000)}m
            </Typography>
          </Box>
        );

      case 'custom-text':
        return (
          <Box
            key={element.id}
            style={commonStyles}
            onMouseDown={handleElementMouseDown}
            onClick={handleElementClick}
          >
            <Typography variant="body2">
              {element.content?.text || 'Custom Text'}
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  }, [
    data,
    moonPhase,
    isDragging,
    selectedElement,
    handleMouseDown,
    handleElementClick
  ]);

  const selectedElementData = overlayElements.find(e => e.id === selectedElement);

  return (
    <Box>
      {/* Overlay Canvas */}
      <Box
        ref={overlayRef}
        sx={{
          position: 'relative',
          width: canvasWidth,
          height: canvasHeight,
          overflow: 'hidden',
          border: '1px dashed #ccc',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {overlayElements.map(renderOverlayElement)}
        
        {selectedElement && (
          <Box
            sx={{
              position: 'absolute',
              left: selectedElementData?.position.x,
              top: selectedElementData?.position.y,
              width: selectedElementData?.size.width,
              height: selectedElementData?.size.height,
              border: '2px dashed #2196f3',
              pointerEvents: 'none',
              zIndex: 9999
            }}
          />
        )}
      </Box>

      {/* Control Panel */}
      <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Overlay Elements</Typography>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsOpen(true)}
            disabled={!selectedElement}
          >
            Edit Selected
          </Button>
        </Box>

        <Grid container spacing={2}>
          {overlayElements.map(element => (
            <Grid item xs={6} md={4} key={element.id}>
              <Card 
                variant={selectedElement === element.id ? "elevation" : "outlined"}
                sx={{ cursor: 'pointer' }}
                onClick={() => setSelectedElement(element.id)}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" fontWeight="bold">
                      {element.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleElementVisibility(element.id);
                      }}
                    >
                      {element.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {element.position.x}, {element.position.y}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Settings Dialog */}
      <Dialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit Overlay Element
          {selectedElementData && (
            <Typography variant="subtitle2" color="text.secondary">
              {selectedElementData.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedElementData && (
            <Box mt={2}>
              <Tabs value={0}>
                <Tab label="Style" />
              </Tabs>
              
              <Box mt={3}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Colors</Typography>
                    
                    <Box mb={2}>
                      <Typography variant="body2" gutterBottom>Background Color</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={selectedElementData.style.backgroundColor}
                        onChange={(e) => updateElementStyle(selectedElement ?? '', { backgroundColor: e.target.value })}
                      />
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" gutterBottom>Text Color</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={selectedElementData.style.textColor}
                        onChange={(e) => updateElementStyle(selectedElement ?? '', { textColor: e.target.value })}
                      />
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" gutterBottom>Border Color</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={selectedElementData.style.borderColor}
                        onChange={(e) => updateElementStyle(selectedElement ?? '', { borderColor: e.target.value })}
                      />
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Layout</Typography>
                    
                    <Box mb={2}>
                      <Typography variant="body2" gutterBottom>
                        Opacity: {Math.round(selectedElementData.style.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={selectedElementData.style.opacity}
                        onChange={(_, value) => updateElementStyle(selectedElement ?? '', { opacity: value as number })}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" gutterBottom>
                        Border Width: {selectedElementData.style.borderWidth}px
                      </Typography>
                      <Slider
                        value={selectedElementData.style.borderWidth}
                        onChange={(_, value) => updateElementStyle(selectedElement ?? '', { borderWidth: value as number })}
                        min={0}
                        max={10}
                        step={1}
                      />
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" gutterBottom>
                        Border Radius: {selectedElementData.style.borderRadius}px
                      </Typography>
                      <Slider
                        value={selectedElementData.style.borderRadius}
                        onChange={(_, value) => updateElementStyle(selectedElement ?? '', { borderRadius: value as number })}
                        min={0}
                        max={20}
                        step={1}
                      />
                    </Box>
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={selectedElementData.style.shadow}
                          onChange={(e) => updateElementStyle(selectedElement ?? '', { shadow: e.target.checked })}
                        />
                      }
                      label="Drop Shadow"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};