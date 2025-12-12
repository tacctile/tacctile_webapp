/**
 * StreamingTool Component
 * OBS Studio-inspired streaming and recording tool for live investigations
 */

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';

// Components
import StreamingToolbar from './StreamingToolbar';
import SceneManager from './SceneManager';
import StreamPreview from './StreamPreview';
import SourcePanel from './SourcePanel';
import OutputPanel from './OutputPanel';
import RecordingPanel from './RecordingPanel';
import AudioMixerPanel from './AudioMixerPanel';

// Store
import {
  useStreamingToolStore,
  selectScenes,
  selectActiveSceneId,
  selectPreviewSceneId,
  selectIsStreaming,
  selectStreamStartTime,
  selectIsRecording,
  selectRecordingStartTime,
  selectStreamSettings,
  selectRecordingSettings,
  selectDestinations,
  selectAudioMixer,
  selectAvailableDevices,
  selectStreamingMode,
  selectViewMode,
} from '../../stores/useStreamingToolStore';

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

const MainContent = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const LeftPanel = styled(Box)({
  width: 280,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#141414',
  borderRight: '1px solid #2b2b2b',
  overflow: 'hidden',
});

const CenterArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: 8,
  gap: 8,
});

const PreviewArea = styled(Box)({
  flex: 1,
  display: 'flex',
  gap: 8,
  overflow: 'hidden',
});

const PreviewContainer = styled(Box)<{ isLive?: boolean }>(({ isLive }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 4,
  overflow: 'hidden',
  border: `2px solid ${isLive ? '#f44336' : '#2b2b2b'}`,
  backgroundColor: '#0a0a0a',
}));

const PreviewLabel = styled(Box)<{ isLive?: boolean }>(({ isLive }) => ({
  padding: '4px 12px',
  backgroundColor: isLive ? '#f44336' : '#1a1a1a',
  color: isLive ? '#ffffff' : '#888888',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}));

const RightPanel = styled(Box)({
  width: 320,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#141414',
  borderLeft: '1px solid #2b2b2b',
  overflow: 'hidden',
});

// Note: PanelSection and ControlsBar styled components are reserved for future use

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface StreamingToolProps {
  /** Investigation ID */
  investigationId?: string;
  /** File ID */
  fileId?: string;
  /** Callback when streaming starts */
  onStreamStart?: () => void;
  /** Callback when streaming stops */
  onStreamStop?: () => void;
  /** Callback when recording starts */
  onRecordingStart?: () => void;
  /** Callback when recording stops */
  onRecordingStop?: (recordingId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const StreamingTool: React.FC<StreamingToolProps> = ({
  investigationId: _investigationId,
  fileId: _fileId,
  onStreamStart,
  onStreamStop,
  onRecordingStart,
  onRecordingStop,
}) => {
  // Refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const programCanvasRef = useRef<HTMLCanvasElement>(null);

  // Local state
  const [activePanelTab, setActivePanelTab] = useState<'sources' | 'output' | 'recording'>('sources');

  // Store state - use selectors for stable references
  const mode = useStreamingToolStore(selectStreamingMode);
  const viewMode = useStreamingToolStore(selectViewMode);
  const scenes = useStreamingToolStore(selectScenes);
  const activeSceneId = useStreamingToolStore(selectActiveSceneId);
  const previewSceneId = useStreamingToolStore(selectPreviewSceneId);
  const isStreaming = useStreamingToolStore(selectIsStreaming);
  const streamStartTime = useStreamingToolStore(selectStreamStartTime);
  const isRecording = useStreamingToolStore(selectIsRecording);
  const recordingStartTime = useStreamingToolStore(selectRecordingStartTime);
  const streamSettings = useStreamingToolStore(selectStreamSettings);
  const recordingSettings = useStreamingToolStore(selectRecordingSettings);
  const destinations = useStreamingToolStore(selectDestinations);
  const audioMixer = useStreamingToolStore(selectAudioMixer);
  const availableDevices = useStreamingToolStore(selectAvailableDevices);

  // Store actions - use useShallow to get stable references
  const {
    createScene,
    deleteScene,
    duplicateScene,
    renameScene,
    setActiveScene,
    setPreviewScene,
    addSource,
    removeSource,
    updateSource,
    updateSourceTransform,
    selectSource,
    executeTransition,
    startStreaming,
    stopStreaming,
    updateStreamSettings,
    addDestination,
    removeDestination,
    updateDestination,
    toggleDestination,
    testDestination,
    startRecording,
    stopRecording,
    updateRecordingSettings,
    setMode,
    setViewMode,
    refreshDevices,
  } = useStreamingToolStore(
    useShallow((state) => ({
      createScene: state.createScene,
      deleteScene: state.deleteScene,
      duplicateScene: state.duplicateScene,
      renameScene: state.renameScene,
      setActiveScene: state.setActiveScene,
      setPreviewScene: state.setPreviewScene,
      addSource: state.addSource,
      removeSource: state.removeSource,
      updateSource: state.updateSource,
      updateSourceTransform: state.updateSourceTransform,
      selectSource: state.selectSource,
      executeTransition: state.executeTransition,
      startStreaming: state.startStreaming,
      stopStreaming: state.stopStreaming,
      updateStreamSettings: state.updateStreamSettings,
      addDestination: state.addDestination,
      removeDestination: state.removeDestination,
      updateDestination: state.updateDestination,
      toggleDestination: state.toggleDestination,
      testDestination: state.testDestination,
      startRecording: state.startRecording,
      stopRecording: state.stopRecording,
      updateRecordingSettings: state.updateRecordingSettings,
      setMode: state.setMode,
      setViewMode: state.setViewMode,
      refreshDevices: state.refreshDevices,
    }))
  );

  // Initialize devices on mount
  useEffect(() => {
    refreshDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  // Create default scene if none exist
  useEffect(() => {
    if (scenes.length === 0) {
      createScene('Scene 1');
    }
  }, [scenes.length, createScene]);

  // Handle streaming start/stop
  const handleStartStreaming = useCallback(async () => {
    try {
      await startStreaming();
      onStreamStart?.();
    } catch (error) {
      console.error('Failed to start streaming:', error);
    }
  }, [startStreaming, onStreamStart]);

  const handleStopStreaming = useCallback(() => {
    stopStreaming();
    onStreamStop?.();
  }, [stopStreaming, onStreamStop]);

  // Handle recording start/stop
  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
      onRecordingStart?.();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [startRecording, onRecordingStart]);

  const handleStopRecording = useCallback(async () => {
    const recording = await stopRecording();
    if (recording) {
      onRecordingStop?.(recording.id);
    }
  }, [stopRecording, onRecordingStop]);

  // Handle transition (swap preview to program)
  const handleTransition = useCallback(() => {
    if (previewSceneId && previewSceneId !== activeSceneId) {
      executeTransition();
    }
  }, [previewSceneId, activeSceneId, executeTransition]);

  // Get active scenes
  const activeScene = scenes.find((s) => s.id === activeSceneId);
  const previewScene = scenes.find((s) => s.id === previewSceneId);

  // Determine if we're in studio mode (show both preview and program)
  const showDualView = viewMode === 'studio' && mode !== 'setup';

  return (
    <ToolContainer>
      {/* Toolbar */}
      <StreamingToolbar
        mode={mode}
        viewMode={viewMode}
        isStreaming={isStreaming}
        isRecording={isRecording}
        streamStartTime={streamStartTime}
        recordingStartTime={recordingStartTime}
        onModeChange={setMode}
        onViewModeChange={setViewMode}
        onStartStreaming={handleStartStreaming}
        onStopStreaming={handleStopStreaming}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onTransition={handleTransition}
      />

      {/* Main Content */}
      <MainContent>
        {/* Left Panel - Scene Manager */}
        <LeftPanel>
          <SceneManager
            scenes={scenes}
            activeSceneId={activeSceneId}
            previewSceneId={previewSceneId}
            onCreateScene={createScene}
            onDeleteScene={deleteScene}
            onDuplicateScene={duplicateScene}
            onRenameScene={renameScene}
            onSelectScene={showDualView ? setPreviewScene : setActiveScene}
            onActivateScene={setActiveScene}
          />
        </LeftPanel>

        {/* Center Area - Preview(s) */}
        <CenterArea>
          <PreviewArea>
            {showDualView ? (
              <>
                {/* Preview (Next Scene) */}
                <PreviewContainer>
                  <PreviewLabel>Preview</PreviewLabel>
                  <StreamPreview
                    scene={previewScene || null}
                    isLive={false}
                    canvasRef={previewCanvasRef}
                    availableDevices={availableDevices}
                  />
                </PreviewContainer>

                {/* Program (Live Scene) */}
                <PreviewContainer isLive={isStreaming}>
                  <PreviewLabel isLive={isStreaming}>
                    {isStreaming && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          animation: 'pulse 1s infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                          },
                        }}
                      />
                    )}
                    Program {isStreaming && '• LIVE'}
                  </PreviewLabel>
                  <StreamPreview
                    scene={activeScene || null}
                    isLive={isStreaming}
                    canvasRef={programCanvasRef}
                    availableDevices={availableDevices}
                  />
                </PreviewContainer>
              </>
            ) : (
              /* Single Preview */
              <PreviewContainer isLive={isStreaming}>
                <PreviewLabel isLive={isStreaming}>
                  {isStreaming && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        animation: 'pulse 1s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.5 },
                        },
                      }}
                    />
                  )}
                  {isStreaming ? 'LIVE' : 'Preview'}
                </PreviewLabel>
                <StreamPreview
                  scene={activeScene || null}
                  isLive={isStreaming}
                  canvasRef={previewCanvasRef}
                  availableDevices={availableDevices}
                />
              </PreviewContainer>
            )}
          </PreviewArea>

          {/* Audio Mixer */}
          <AudioMixerPanel
            audioMixer={audioMixer}
            availableDevices={availableDevices}
          />
        </CenterArea>

        {/* Right Panel - Sources, Output, Recording */}
        <RightPanel>
          {/* Tab Buttons */}
          <Box
            sx={{
              display: 'flex',
              borderBottom: '1px solid #2b2b2b',
            }}
          >
            {(['sources', 'output', 'recording'] as const).map((tab) => (
              <Box
                key={tab}
                onClick={() => setActivePanelTab(tab)}
                sx={{
                  flex: 1,
                  padding: '10px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontSize: 13,
                  fontWeight: activePanelTab === tab ? 600 : 400,
                  color: activePanelTab === tab ? '#19abb5' : '#888888',
                  backgroundColor: activePanelTab === tab ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
                  borderBottom: activePanelTab === tab ? '2px solid #19abb5' : '2px solid transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                {tab}
              </Box>
            ))}
          </Box>

          {/* Tab Content */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {activePanelTab === 'sources' && (
              <SourcePanel
                scene={activeScene || null}
                availableDevices={availableDevices}
                onAddSource={(source) => {
                  if (activeSceneId) return addSource(activeSceneId, source);
                  return undefined;
                }}
                onRemoveSource={(sourceId) => {
                  if (activeSceneId) removeSource(activeSceneId, sourceId);
                }}
                onUpdateSource={(sourceId, updates) => {
                  if (activeSceneId) updateSource(activeSceneId, sourceId, updates);
                }}
                onUpdateTransform={(sourceId, transform) => {
                  if (activeSceneId) updateSourceTransform(activeSceneId, sourceId, transform);
                }}
                onSelectSource={selectSource}
              />
            )}

            {activePanelTab === 'output' && (
              <OutputPanel
                destinations={destinations}
                streamSettings={streamSettings}
                isStreaming={isStreaming}
                onAddDestination={addDestination}
                onRemoveDestination={removeDestination}
                onUpdateDestination={updateDestination}
                onToggleDestination={toggleDestination}
                onTestDestination={testDestination}
                onUpdateSettings={updateStreamSettings}
              />
            )}

            {activePanelTab === 'recording' && (
              <RecordingPanel
                recordingSettings={recordingSettings}
                isRecording={isRecording}
                recordingStartTime={recordingStartTime}
                onUpdateSettings={updateRecordingSettings}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
              />
            )}
          </Box>
        </RightPanel>
      </MainContent>
    </ToolContainer>
  );
};

export default StreamingTool;
