/**
 * AudioTool Component
 * Main container for the iZotope RX 11-inspired audio analysis tool
 */

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank } from '@/components/evidence-bank';

// Store
import {
  useAudioToolStore,
  selectAudioUrl,
  selectPlayback,
  selectViewMode,
  selectSelections,
  selectCurrentSelection,
  selectLoopRegions,
  selectFilterSettings,
  selectRecipes,
  selectIterations,
  selectFindings,
  selectSpectrogramSettings,
  selectWaveformSettings,
  selectFiltersBypassed,
} from '../../stores/useAudioToolStore';
import type { AudioViewMode, LoopRegion, AudioFinding } from '../../types/audio';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

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

const VisualizationArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: 8,
  gap: 8,
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
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);

  // Mock audio evidence data
  const audioEvidence = [
    {
      id: 'a1',
      type: 'audio' as const,
      fileName: 'recorder_01_evp_session.wav',
      duration: 1834,
      capturedAt: Date.now() - 6500000,
      user: 'Sarah',
      deviceInfo: 'Zoom H6',
      flagCount: 7,
      hasFindings: true,
    },
    {
      id: 'a2',
      type: 'audio' as const,
      fileName: 'spirit_box_session.wav',
      duration: 923,
      capturedAt: Date.now() - 5800000,
      user: 'Jen',
      deviceInfo: 'Tascam DR-40X',
      flagCount: 2,
      hasFindings: true,
    },
    {
      id: 'a3',
      type: 'audio' as const,
      fileName: 'ambient_baseline.wav',
      duration: 600,
      capturedAt: Date.now() - 7000000,
      user: 'Mike',
      deviceInfo: 'Zoom H6',
      flagCount: 0,
      hasFindings: false,
    },
  ];

  // Store state - use selectors for stable references
  const audioBuffer = useAudioToolStore((state) => state.audioBuffer);
  const viewMode = useAudioToolStore(selectViewMode);
  const playback = useAudioToolStore(selectPlayback);
  const currentSelection = useAudioToolStore(selectCurrentSelection);
  const selections = useAudioToolStore(selectSelections);
  const loopRegions = useAudioToolStore(selectLoopRegions);
  const activeLoopId = useAudioToolStore((state) => state.activeLoopId);
  const filterSettings = useAudioToolStore(selectFilterSettings);
  const filtersBypassed = useAudioToolStore(selectFiltersBypassed);
  const recipes = useAudioToolStore(selectRecipes);
  const iterations = useAudioToolStore(selectIterations);
  const activeIterationId = useAudioToolStore((state) => state.activeIterationId);
  const findings = useAudioToolStore(selectFindings);
  const spectrogramSettings = useAudioToolStore(selectSpectrogramSettings);
  const waveformSettings = useAudioToolStore(selectWaveformSettings);
  const zoom = useAudioToolStore((state) => state.zoom);
  const scrollPosition = useAudioToolStore((state) => state.scrollPosition);

  // Store actions - use useShallow to get stable references
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
  } = useAudioToolStore(
    useShallow((state) => ({
      loadAudio: state.loadAudio,
      setAudioBuffer: state.setAudioBuffer,
      setViewMode: state.setViewMode,
      play: state.play,
      pause: state.pause,
      stop: state.stop,
      seek: state.seek,
      setPlaybackRate: state.setPlaybackRate,
      setVolume: state.setVolume,
      toggleMute: state.toggleMute,
      toggleLooping: state.toggleLooping,
      updatePlaybackTime: state.updatePlaybackTime,
      setDuration: state.setDuration,
      startSelection: state.startSelection,
      updateSelection: state.updateSelection,
      finishSelection: state.finishSelection,
      cancelSelection: state.cancelSelection,
      addLoopRegion: state.addLoopRegion,
      removeLoopRegion: state.removeLoopRegion,
      setActiveLoop: state.setActiveLoop,
      updateLoopRegion: state.updateLoopRegion,
      createLoopFromSelection: state.createLoopFromSelection,
      setFilterSettings: state.setFilterSettings,
      setEQBand: state.setEQBand,
      setNoiseReduction: state.setNoiseReduction,
      setGain: state.setGain,
      resetFilters: state.resetFilters,
      toggleFiltersBypass: state.toggleFiltersBypass,
      applyRecipe: state.applyRecipe,
      saveRecipe: state.saveRecipe,
      deleteRecipe: state.deleteRecipe,
      createIteration: state.createIteration,
      deleteIteration: state.deleteIteration,
      setActiveIteration: state.setActiveIteration,
      createFindingFromSelection: state.createFindingFromSelection,
      updateFinding: state.updateFinding,
      deleteFinding: state.deleteFinding,
      setFindingVisibility: state.setFindingVisibility,
      setZoom: state.setZoom,
    }))
  );

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

    return () => {
      audio.pause();
      audio.src = '';
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
      audioContext.close();
    };
  }, []);

  // Setup audio event listeners with proper dependencies
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      updatePlaybackTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      onAudioLoaded?.(audio.duration);
    };

    const handleEnded = () => {
      if (playback.looping && !activeLoopId) {
        audio.currentTime = 0;
        audio.play();
      } else {
        pause();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [updatePlaybackTime, setDuration, onAudioLoaded, playback.looping, activeLoopId, pause]);

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
  }, [audioUrl, evidenceId, investigationId, loadAudio, setAudioBuffer]);

  // Use external audio buffer if provided
  useEffect(() => {
    if (externalAudioBuffer) {
      setAudioBuffer(externalAudioBuffer);
    }
  }, [externalAudioBuffer, setAudioBuffer]);

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
      // Ensure findings is an array
      const safeFindings = Array.isArray(findings) ? findings : [];
      const finding = safeFindings.find((f) => f.id === findingId);
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
    <WorkspaceLayout
      evidencePanel={
        <EvidenceBank
          items={audioEvidence}
          selectedId={selectedEvidence?.id}
          onSelect={(item) => setSelectedEvidence(item)}
          onDoubleClick={(item) => {
            console.log('Load audio file:', item.fileName);
            // TODO: Load the audio file into the viewer
          }}
          filterByType="audio"
        />
      }
      inspectorPanel={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
          <Box sx={{ flex: '0 0 auto', maxHeight: '50%', overflow: 'auto', padding: 1 }}>
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
          </Box>
          <Box sx={{ flex: '0 0 auto', maxHeight: '25%', overflow: 'auto', padding: 1, borderTop: '1px solid #2b2b2b' }}>
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
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', padding: 1, borderTop: '1px solid #2b2b2b' }}>
            <FindingsPanel
              findings={Array.isArray(findings) ? findings : []}
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
          </Box>
        </Box>
      }
      mainContent={
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#121212' }}>
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
                  loopRegions={Array.isArray(loopRegions) ? loopRegions : []}
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
                  selections={Array.isArray(selections) ? selections : []}
                  loopRegions={Array.isArray(loopRegions) ? loopRegions : []}
                  activeLoopId={activeLoopId}
                  findings={Array.isArray(findings) ? findings : []}
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
        </Box>
      }
      evidenceTitle="Audio Files"
      inspectorTitle="Filters"
      showTransport={true}
    />
  );
};

export default AudioTool;
