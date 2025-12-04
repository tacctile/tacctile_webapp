/**
 * AudioTool Component
 * Main container for the iZotope RX 11-inspired audio analysis tool
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import RepeatIcon from '@mui/icons-material/Repeat';
import RepeatOneIcon from '@mui/icons-material/RepeatOne';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import TimelineIcon from '@mui/icons-material/Timeline';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import SpeedIcon from '@mui/icons-material/Speed';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import LoopIcon from '@mui/icons-material/Loop';
import SettingsIcon from '@mui/icons-material/Settings';

// Components
import WaveformView from './WaveformView';
import SpectrogramView from './SpectrogramView';
import FilterPanel from './FilterPanel';
import RecipePanel from './RecipePanel';
import FindingsPanel from './FindingsPanel';

// Store
import { useAudioToolStore } from '../../stores/useAudioToolStore';
import type { AudioViewMode, LoopRegion, AudioFinding } from '../../types/audio';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const ToolContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#121212',
  color: '#e1e1e1',
  overflow: 'hidden',
});

const Toolbar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  gap: 8,
  flexWrap: 'wrap',
});

const ToolbarGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const ToolbarDivider = styled(Divider)({
  height: 24,
  borderColor: '#2b2b2b',
  margin: '0 8px',
});

const MainContent = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const VisualizationArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: 8,
  gap: 8,
});

const SidePanel = styled(Box)({
  width: 300,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#141414',
  borderLeft: '1px solid #2b2b2b',
  overflow: 'hidden',
});

const SidePanelSection = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 8,
  borderBottom: '1px solid #2b2b2b',
  '&:last-child': {
    borderBottom: 'none',
  },
});

const TransportBar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #2b2b2b',
  gap: 16,
});

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 14,
  color: '#19abb5',
  minWidth: 100,
  textAlign: 'center',
});

const StyledToggleButton = styled(ToggleButton)({
  border: 'none',
  padding: '4px 8px',
  color: '#888888',
  '&.Mui-selected': {
    backgroundColor: 'rgba(25, 171, 181, 0.2)',
    color: '#19abb5',
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.3)',
    },
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const TransportButton = styled(IconButton)({
  backgroundColor: '#252525',
  color: '#e1e1e1',
  '&:hover': {
    backgroundColor: '#333333',
  },
  '&.Mui-disabled': {
    color: '#555555',
  },
});

const PlayButton = styled(IconButton)({
  backgroundColor: '#19abb5',
  color: '#ffffff',
  width: 48,
  height: 48,
  '&:hover': {
    backgroundColor: '#36d1da',
  },
});

const VolumeSlider = styled(Slider)({
  width: 80,
  '& .MuiSlider-thumb': {
    backgroundColor: '#19abb5',
    width: 12,
    height: 12,
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#404040',
  },
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface AudioToolProps {
  /** Evidence ID to load */
  evidenceId?: string;
  /** Investigation ID */
  investigationId?: string;
  /** Audio file URL */
  audioUrl?: string;
  /** Audio buffer (alternative to URL) */
  audioBuffer?: AudioBuffer;
  /** Callback when audio is loaded */
  onAudioLoaded?: (duration: number) => void;
  /** Callback when a finding is synced to evidence flag */
  onSyncFinding?: (finding: AudioFinding) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AudioTool: React.FC<AudioToolProps> = ({
  evidenceId,
  investigationId,
  audioUrl,
  audioBuffer: externalAudioBuffer,
  onAudioLoaded,
  onSyncFinding,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Store state
  const {
    audioBuffer,
    viewMode,
    playback,
    currentSelection,
    selections,
    loopRegions,
    activeLoopId,
    filterSettings,
    filtersBypassed,
    recipes,
    iterations,
    activeIterationId,
    findings,
    spectrogramSettings,
    waveformSettings,
    zoom,
    scrollPosition,
  } = useAudioToolStore();

  // Store actions
  const {
    loadAudio,
    setAudioBuffer,
    setViewMode,
    play,
    pause,
    stop,
    seek,
    setPlaybackRate,
    setVolume,
    toggleMute,
    toggleLooping,
    updatePlaybackTime,
    setDuration,
    startSelection,
    updateSelection,
    finishSelection,
    cancelSelection,
    addLoopRegion,
    removeLoopRegion,
    setActiveLoop,
    updateLoopRegion,
    createLoopFromSelection,
    setFilterSettings,
    setEQBand,
    setNoiseReduction,
    setGain,
    resetFilters,
    toggleFiltersBypass,
    applyRecipe,
    saveRecipe,
    deleteRecipe,
    createIteration,
    deleteIteration,
    setActiveIteration,
    createFindingFromSelection,
    updateFinding,
    deleteFinding,
    setFindingVisibility,
    setZoom,
  } = useAudioToolStore();

  // Initialize audio element and Web Audio API
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNodeRef.current = gainNode;

    // Audio event listeners
    audio.addEventListener('timeupdate', () => {
      updatePlaybackTime(audio.currentTime);
    });

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      onAudioLoaded?.(audio.duration);
    });

    audio.addEventListener('ended', () => {
      if (playback.looping && !activeLoopId) {
        audio.currentTime = 0;
        audio.play();
      } else {
        pause();
      }
    });

    return () => {
      audio.pause();
      audio.src = '';
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
      audioContext.close();
    };
  }, []);

  // Load audio from URL
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (evidenceId && investigationId) {
      loadAudio(evidenceId, investigationId, audioUrl);
    }

    audio.src = audioUrl;
    audio.load();

    // Connect to Web Audio API for processing
    const audioContext = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    if (audioContext && gainNode && !sourceNodeRef.current) {
      const source = audioContext.createMediaElementSource(audio);
      source.connect(gainNode);
      sourceNodeRef.current = source;
    }

    // Decode audio for spectrogram
    fetch(audioUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => audioContext?.decodeAudioData(buffer))
      .then((decodedBuffer) => {
        if (decodedBuffer) {
          setAudioBuffer(decodedBuffer);
        }
      })
      .catch(console.error);
  }, [audioUrl, evidenceId, investigationId]);

  // Use external audio buffer if provided
  useEffect(() => {
    if (externalAudioBuffer) {
      setAudioBuffer(externalAudioBuffer);
    }
  }, [externalAudioBuffer]);

  // Sync playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playback.isPlaying && audio.paused) {
      audioContextRef.current?.resume();
      audio.play().catch(console.error);
    } else if (!playback.isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [playback.isPlaying]);

  // Sync volume
  useEffect(() => {
    const gainNode = gainNodeRef.current;
    if (gainNode) {
      gainNode.gain.value = playback.muted ? 0 : playback.volume;
    }
  }, [playback.volume, playback.muted]);

  // Sync playback rate
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playback.playbackRate;
    }
  }, [playback.playbackRate]);

  // Handle loop regions
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeLoopId) return;

    const activeLoop = loopRegions.find((r) => r.id === activeLoopId);
    if (!activeLoop) return;

    const handleTimeUpdate = () => {
      if (audio.currentTime >= activeLoop.endTime) {
        audio.currentTime = activeLoop.startTime;
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [activeLoopId, loopRegions]);

  // Handlers
  const handlePlayPause = useCallback(() => {
    if (playback.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [playback.isPlaying, play, pause]);

  const handleStop = useCallback(() => {
    stop();
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
    }
  }, [stop]);

  const handleSeek = useCallback(
    (time: number) => {
      seek(time);
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
      }
    },
    [seek]
  );

  const handleSkip = useCallback(
    (seconds: number) => {
      const newTime = Math.max(0, Math.min(playback.currentTime + seconds, playback.duration));
      handleSeek(newTime);
    },
    [playback.currentTime, playback.duration, handleSeek]
  );

  const handleViewModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMode: AudioViewMode | null) => {
      if (newMode) {
        setViewMode(newMode);
      }
    },
    [setViewMode]
  );

  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(zoom * 1.2, 1000));
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(zoom / 1.2, 10));
  }, [zoom, setZoom]);

  const handleSelectionStart = useCallback(
    (startTime: number, lowFreq: number) => {
      startSelection(0, 0, startTime, lowFreq);
    },
    [startSelection]
  );

  const handleCreateFinding = useCallback(
    (title: string, notes?: string, confidence?: AudioFinding['confidence']) => {
      createFindingFromSelection(title, notes, confidence);
    },
    [createFindingFromSelection]
  );

  const handleSeekToFinding = useCallback(
    (finding: AudioFinding) => {
      handleSeek(finding.selection.startTime);
    },
    [handleSeek]
  );

  const handleSyncFinding = useCallback(
    (findingId: string) => {
      const finding = findings.find((f) => f.id === findingId);
      if (finding && onSyncFinding) {
        onSyncFinding(finding);
      }
    },
    [findings, onSyncFinding]
  );

  const handleRegionCreate = useCallback(
    (region: Omit<LoopRegion, 'id'>) => {
      addLoopRegion(region);
    },
    [addLoopRegion]
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <ToolContainer>
      {/* Toolbar */}
      <Toolbar>
        {/* View Mode */}
        <ToolbarGroup>
          <Typography variant="caption" sx={{ color: '#888888', mr: 1 }}>
            View:
          </Typography>
          <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
            <StyledToggleButton value="waveform">
              <Tooltip title="Waveform">
                <TimelineIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </StyledToggleButton>
            <StyledToggleButton value="spectrogram">
              <Tooltip title="Spectrogram">
                <GraphicEqIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </StyledToggleButton>
            <StyledToggleButton value="split">
              <Tooltip title="Split View">
                <ViewStreamIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </StyledToggleButton>
          </ToggleButtonGroup>
        </ToolbarGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Zoom */}
        <ToolbarGroup>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={handleZoomOut}>
              <ZoomOutIcon sx={{ fontSize: 18, color: '#888888' }} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ color: '#888888', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom)}%
          </Typography>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={handleZoomIn}>
              <ZoomInIcon sx={{ fontSize: 18, color: '#888888' }} />
            </IconButton>
          </Tooltip>
        </ToolbarGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Selection Tools */}
        <ToolbarGroup>
          <Tooltip title="Spectral Selection Tool">
            <IconButton size="small" sx={{ color: '#19abb5' }}>
              <HighlightAltIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Create Loop from Selection">
            <IconButton size="small" onClick={createLoopFromSelection} disabled={!currentSelection}>
              <LoopIcon sx={{ fontSize: 18, color: currentSelection ? '#ffc107' : '#555555' }} />
            </IconButton>
          </Tooltip>
        </ToolbarGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Playback Rate */}
        <ToolbarGroup>
          <Tooltip title="Playback Speed">
            <SpeedIcon sx={{ fontSize: 18, color: '#888888' }} />
          </Tooltip>
          <Slider
            value={playback.playbackRate}
            min={0.25}
            max={2}
            step={0.25}
            onChange={(_, v) => setPlaybackRate(v as number)}
            sx={{ width: 80, mx: 1 }}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}x`}
          />
        </ToolbarGroup>

        <Box sx={{ flex: 1 }} />

        {/* Settings */}
        <Tooltip title="Settings">
          <IconButton size="small" onClick={() => setShowSettings(!showSettings)}>
            <SettingsIcon sx={{ fontSize: 18, color: showSettings ? '#19abb5' : '#888888' }} />
          </IconButton>
        </Tooltip>
      </Toolbar>

      {/* Main Content */}
      <MainContent>
        {/* Visualization Area */}
        <VisualizationArea>
          {(viewMode === 'waveform' || viewMode === 'split') && (
            <Box sx={{ flex: viewMode === 'split' ? '0 0 30%' : 1, minHeight: 100 }}>
              <WaveformView
                audioUrl={audioUrl || null}
                audioBuffer={audioBuffer}
                isPlaying={playback.isPlaying}
                currentTime={playback.currentTime}
                playbackRate={playback.playbackRate}
                volume={playback.volume}
                muted={playback.muted}
                loopRegions={loopRegions}
                activeLoopId={activeLoopId}
                settings={waveformSettings}
                zoom={zoom}
                onPlayPause={(isPlaying) => (isPlaying ? play() : pause())}
                onSeek={handleSeek}
                onTimeUpdate={updatePlaybackTime}
                onReady={setDuration}
                onRegionCreate={handleRegionCreate}
                onRegionUpdate={updateLoopRegion}
                onRegionRemove={removeLoopRegion}
                onRegionClick={setActiveLoop}
              />
            </Box>
          )}
          {(viewMode === 'spectrogram' || viewMode === 'split') && (
            <Box sx={{ flex: 1, minHeight: 200 }}>
              <SpectrogramView
                audioBuffer={audioBuffer}
                settings={spectrogramSettings}
                currentTime={playback.currentTime}
                duration={playback.duration}
                zoom={zoom}
                scrollPosition={scrollPosition}
                currentSelection={currentSelection}
                selections={selections}
                loopRegions={loopRegions}
                activeLoopId={activeLoopId}
                findings={findings}
                selectionEnabled={true}
                onSelectionStart={handleSelectionStart}
                onSelectionUpdate={updateSelection}
                onSelectionEnd={finishSelection}
                onSelectionCancel={cancelSelection}
                onSeek={handleSeek}
                onFindingClick={setSelectedFindingId}
                onZoomChange={setZoom}
              />
            </Box>
          )}
        </VisualizationArea>

        {/* Side Panel */}
        <SidePanel>
          <SidePanelSection sx={{ flex: '0 0 auto', maxHeight: '50%' }}>
            <FilterPanel
              settings={filterSettings}
              bypassed={filtersBypassed}
              onSettingsChange={setFilterSettings}
              onEQBandChange={setEQBand}
              onNoiseReductionChange={setNoiseReduction}
              onGainChange={setGain}
              onReset={resetFilters}
              onBypassToggle={toggleFiltersBypass}
            />
          </SidePanelSection>
          <SidePanelSection sx={{ flex: '0 0 auto', maxHeight: '25%' }}>
            <RecipePanel
              recipes={recipes}
              iterations={iterations}
              activeIterationId={activeIterationId}
              onApplyRecipe={applyRecipe}
              onSaveRecipe={saveRecipe}
              onDeleteRecipe={deleteRecipe}
              onCreateIteration={createIteration}
              onDeleteIteration={deleteIteration}
              onActivateIteration={setActiveIteration}
            />
          </SidePanelSection>
          <SidePanelSection>
            <FindingsPanel
              findings={findings}
              currentSelection={currentSelection}
              selectedFindingId={selectedFindingId}
              onCreateFinding={handleCreateFinding}
              onUpdateFinding={updateFinding}
              onDeleteFinding={deleteFinding}
              onToggleVisibility={setFindingVisibility}
              onFindingSelect={setSelectedFindingId}
              onSeekToFinding={handleSeekToFinding}
              onSyncToFlag={onSyncFinding ? handleSyncFinding : undefined}
            />
          </SidePanelSection>
        </SidePanel>
      </MainContent>

      {/* Transport Bar */}
      <TransportBar>
        {/* Time Display */}
        <TimeDisplay>{formatTime(playback.currentTime)}</TimeDisplay>

        {/* Transport Controls */}
        <ToolbarGroup>
          <Tooltip title="Skip Back 5s">
            <TransportButton size="small" onClick={() => handleSkip(-5)}>
              <SkipPreviousIcon />
            </TransportButton>
          </Tooltip>
          <Tooltip title={playback.isPlaying ? 'Pause' : 'Play'}>
            <PlayButton onClick={handlePlayPause}>
              {playback.isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </PlayButton>
          </Tooltip>
          <Tooltip title="Stop">
            <TransportButton size="small" onClick={handleStop}>
              <StopIcon />
            </TransportButton>
          </Tooltip>
          <Tooltip title="Skip Forward 5s">
            <TransportButton size="small" onClick={() => handleSkip(5)}>
              <SkipNextIcon />
            </TransportButton>
          </Tooltip>
        </ToolbarGroup>

        {/* Duration Display */}
        <TimeDisplay>{formatTime(playback.duration)}</TimeDisplay>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Loop Toggle */}
        <Tooltip title={playback.looping ? 'Disable Loop' : 'Enable Loop'}>
          <IconButton size="small" onClick={toggleLooping}>
            {activeLoopId ? (
              <RepeatOneIcon sx={{ color: '#ffc107' }} />
            ) : (
              <RepeatIcon sx={{ color: playback.looping ? '#19abb5' : '#555555' }} />
            )}
          </IconButton>
        </Tooltip>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Volume */}
        <ToolbarGroup>
          <Tooltip title={playback.muted ? 'Unmute' : 'Mute'}>
            <IconButton size="small" onClick={toggleMute}>
              {playback.muted ? (
                <VolumeOffIcon sx={{ color: '#ff5722' }} />
              ) : (
                <VolumeUpIcon sx={{ color: '#19abb5' }} />
              )}
            </IconButton>
          </Tooltip>
          <VolumeSlider
            value={playback.muted ? 0 : playback.volume}
            min={0}
            max={1}
            step={0.01}
            onChange={(_, v) => setVolume(v as number)}
          />
        </ToolbarGroup>
      </TransportBar>
    </ToolContainer>
  );
};

export default AudioTool;
