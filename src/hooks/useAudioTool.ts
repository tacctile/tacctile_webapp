/**
 * useAudioTool Hook
 * Audio processing and analysis logic for the Audio Tool
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioToolStore } from '../stores/useAudioToolStore';
import type { FilterSettings, AudioFinding } from '../types/audio';

// ============================================================================
// TYPES
// ============================================================================

interface AudioProcessingChain {
  audioContext: AudioContext;
  sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode | null;
  gainNode: GainNode;
  eqNodes: BiquadFilterNode[];
  highPassNode: BiquadFilterNode;
  lowPassNode: BiquadFilterNode;
  analyserNode: AnalyserNode;
  destinationNode: AudioDestinationNode;
}

interface UseAudioToolOptions {
  /** File ID */
  fileId?: string;
  /** Investigation ID */
  investigationId?: string;
  /** Callback when a finding should be synced to FileFlag */
  onSyncFinding?: (finding: AudioFinding, flagData: CreateFlagData) => Promise<void>;
}

interface CreateFlagData {
  type: 'audio_anomaly' | 'audio_artifact' | 'anomaly';
  timestamp: number;
  endTimestamp: number;
  title: string;
  description?: string;
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// HOOK
// ============================================================================

export function useAudioTool(options: UseAudioToolOptions = {}) {
  const { onSyncFinding } = options;

  // Store state and actions
  const store = useAudioToolStore();
  const {
    audioBuffer,
    filterSettings,
    currentSelection,
    findings,
  } = store;

  // Local state
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [processedAudioUrl] = useState<string | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize audio context
  const initAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Create audio processing chain
  const createProcessingChain = useCallback(
    async (settings: FilterSettings): Promise<AudioProcessingChain | null> => {
      const audioContext = await initAudioContext();
      if (!audioContext) return null;

      // Create nodes
      const gainNode = audioContext.createGain();
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;

      // Create EQ nodes
      const eqNodes: BiquadFilterNode[] = settings.eq.map((band) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.Q.value = band.q;
        filter.gain.value = band.enabled ? band.gain : 0;
        return filter;
      });

      // Create high/low pass filters
      const highPassNode = audioContext.createBiquadFilter();
      highPassNode.type = 'highpass';
      highPassNode.frequency.value = settings.highPassEnabled ? settings.highPassCutoff : 20;
      highPassNode.Q.value = 0.7;

      const lowPassNode = audioContext.createBiquadFilter();
      lowPassNode.type = 'lowpass';
      lowPassNode.frequency.value = settings.lowPassEnabled ? settings.lowPassCutoff : 20000;
      lowPassNode.Q.value = 0.7;

      // Set gain
      gainNode.gain.value = settings.gain.enabled ? Math.pow(10, settings.gain.value / 20) : 1;

      // Connect chain
      let lastNode: AudioNode = highPassNode;
      eqNodes.forEach((eq) => {
        lastNode.connect(eq);
        lastNode = eq;
      });
      lastNode.connect(lowPassNode);
      lowPassNode.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);

      return {
        audioContext,
        sourceNode: null,
        gainNode,
        eqNodes,
        highPassNode,
        lowPassNode,
        analyserNode,
        destinationNode: audioContext.destination,
      };
    },
    [initAudioContext]
  );

  // Update processing chain with new settings
  const updateProcessingChain = useCallback(
    (chain: AudioProcessingChain, settings: FilterSettings, bypassed: boolean) => {
      if (bypassed) {
        // Bypass all processing
        chain.gainNode.gain.value = 1;
        chain.eqNodes.forEach((eq) => (eq.gain.value = 0));
        chain.highPassNode.frequency.value = 20;
        chain.lowPassNode.frequency.value = 20000;
        return;
      }

      // Update EQ
      settings.eq.forEach((band, index) => {
        const eqNode = chain.eqNodes[index];
        if (eqNode) {
          eqNode.type = band.type;
          eqNode.frequency.value = band.frequency;
          eqNode.Q.value = band.q;
          eqNode.gain.value = band.enabled ? band.gain : 0;
        }
      });

      // Update high/low pass
      chain.highPassNode.frequency.value = settings.highPassEnabled ? settings.highPassCutoff : 20;
      chain.lowPassNode.frequency.value = settings.lowPassEnabled ? settings.lowPassCutoff : 20000;

      // Update gain
      chain.gainNode.gain.value = settings.gain.enabled ? Math.pow(10, settings.gain.value / 20) : 1;
    },
    []
  );

  // Process audio buffer with filters (offline rendering)
  const processAudioOffline = useCallback(
    async (buffer: AudioBuffer, settings: FilterSettings): Promise<AudioBuffer> => {
      const offlineContext = new OfflineAudioContext(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
      );

      const source = offlineContext.createBufferSource();
      source.buffer = buffer;

      // Create processing chain in offline context
      const gainNode = offlineContext.createGain();
      const eqNodes: BiquadFilterNode[] = settings.eq.map((band) => {
        const filter = offlineContext.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.Q.value = band.q;
        filter.gain.value = band.enabled ? band.gain : 0;
        return filter;
      });

      const highPassNode = offlineContext.createBiquadFilter();
      highPassNode.type = 'highpass';
      highPassNode.frequency.value = settings.highPassEnabled ? settings.highPassCutoff : 20;

      const lowPassNode = offlineContext.createBiquadFilter();
      lowPassNode.type = 'lowpass';
      lowPassNode.frequency.value = settings.lowPassEnabled ? settings.lowPassCutoff : 20000;

      gainNode.gain.value = settings.gain.enabled ? Math.pow(10, settings.gain.value / 20) : 1;

      // Connect chain
      source.connect(highPassNode);
      let lastNode: AudioNode = highPassNode;
      eqNodes.forEach((eq) => {
        lastNode.connect(eq);
        lastNode = eq;
      });
      lastNode.connect(lowPassNode);
      lowPassNode.connect(gainNode);
      gainNode.connect(offlineContext.destination);

      source.start(0);
      return await offlineContext.startRendering();
    },
    []
  );

  // Export processed audio as WAV
  const exportProcessedAudio = useCallback(
    async (_format: 'wav' | 'mp3' = 'wav'): Promise<Blob | null> => {
      // Note: _format parameter reserved for future MP3 export support
      if (!audioBuffer) return null;

      setIsProcessingAudio(true);
      try {
        const processedBuffer = await processAudioOffline(audioBuffer, filterSettings);
        const blob = await audioBufferToWav(processedBuffer);
        return blob;
      } catch (error) {
        console.error('[useAudioTool] Failed to export audio:', error);
        return null;
      } finally {
        setIsProcessingAudio(false);
      }
    },
    [audioBuffer, filterSettings, processAudioOffline]
  );

  // Get audio analysis data for current playback position
  const getAnalysisAtTime = useCallback(
    (time: number): { frequency: number; magnitude: number }[] | null => {
      if (!audioBuffer) return null;

      const sampleIndex = Math.floor(time * audioBuffer.sampleRate);
      const fftSize = 2048; // Standard FFT size for audio analysis
      const channelData = audioBuffer.getChannelData(0);

      // Extract frame around the time
      const frameStart = Math.max(0, sampleIndex - fftSize / 2);
      const frameData = new Float32Array(fftSize);

      for (let i = 0; i < fftSize; i++) {
        const idx = frameStart + i;
        if (idx < channelData.length) {
          // Apply Hann window
          const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
          frameData[i] = channelData[idx] * window;
        }
      }

      // Compute FFT (simple DFT for analysis)
      const result: { frequency: number; magnitude: number }[] = [];

      for (let k = 0; k < fftSize / 2; k++) {
        let real = 0;
        let imag = 0;

        for (let n = 0; n < fftSize; n++) {
          const angle = (2 * Math.PI * k * n) / fftSize;
          real += frameData[n] * Math.cos(angle);
          imag -= frameData[n] * Math.sin(angle);
        }

        const magnitude = Math.sqrt(real * real + imag * imag) / fftSize;
        const frequency = (k * audioBuffer.sampleRate) / fftSize;

        result.push({
          frequency,
          magnitude: 20 * Math.log10(Math.max(magnitude, 1e-10)),
        });
      }

      return result;
    },
    [audioBuffer]
  );

  // Sync finding to evidence flagging service
  const syncFindingToFlag = useCallback(
    async (findingId: string) => {
      const finding = findings.find((f) => f.id === findingId);
      if (!finding || !onSyncFinding) return;

      const flagData: CreateFlagData = {
        type: 'audio_anomaly', // Default to Audio Anomaly for audio findings
        timestamp: finding.selection.startTime,
        endTimestamp: finding.selection.endTime,
        title: finding.title,
        description: finding.notes,
        confidence: finding.confidence,
      };

      await onSyncFinding(finding, flagData);
    },
    [findings, onSyncFinding]
  );

  // Extract audio segment for selection
  const extractSelectionAudio = useCallback(
    async (): Promise<AudioBuffer | null> => {
      if (!audioBuffer || !currentSelection) return null;

      const startSample = Math.floor(currentSelection.startTime * audioBuffer.sampleRate);
      const endSample = Math.floor(currentSelection.endTime * audioBuffer.sampleRate);
      const length = endSample - startSample;

      if (length <= 0) return null;

      const audioContext = await initAudioContext();
      const newBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        length,
        audioBuffer.sampleRate
      );

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const destData = newBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const sampleValue = sourceData[startSample + i];
          destData[i] = sampleValue !== undefined ? sampleValue : 0;
        }
      }

      return newBuffer;
    },
    [audioBuffer, currentSelection, initAudioContext]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl);
      }
    };
  }, [processedAudioUrl]);

  return {
    // State
    isProcessingAudio,
    processedAudioUrl,

    // Audio processing
    initAudioContext,
    createProcessingChain,
    updateProcessingChain,
    processAudioOffline,
    exportProcessedAudio,

    // Analysis
    getAnalysisAtTime,

    // Selection operations
    extractSelectionAudio,

    // Integration
    syncFindingToFlag,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default useAudioTool;
