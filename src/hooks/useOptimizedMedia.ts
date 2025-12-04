/**
 * useOptimizedMedia Hook
 * Provides optimized video playback (60fps) and low-latency audio
 */

import { useRef, useCallback, useEffect, useState } from 'react';

interface VideoPlaybackOptions {
  /** Target frame rate for playback (default: 60) */
  targetFps?: number;
  /** Enable hardware acceleration hints */
  hardwareAcceleration?: boolean;
  /** Preload strategy */
  preload?: 'none' | 'metadata' | 'auto';
  /** Buffer size in seconds */
  bufferSize?: number;
}

interface AudioPlaybackOptions {
  /** Audio latency mode */
  latencyHint?: 'interactive' | 'balanced' | 'playback';
  /** Sample rate (default: 48000) */
  sampleRate?: number;
  /** Enable echo cancellation */
  echoCancellation?: boolean;
  /** Enable noise suppression */
  noiseSuppression?: boolean;
}

interface MediaStats {
  droppedFrames: number;
  totalFrames: number;
  fps: number;
  bufferHealth: number;
  audioLatency: number;
}

/**
 * Hook for optimized video playback targeting 60fps
 */
export function useOptimizedVideo(options: VideoPlaybackOptions = {}) {
  const {
    targetFps = 60,
    hardwareAcceleration = true,
    preload = 'auto',
    bufferSize = 5,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const [stats, setStats] = useState<MediaStats>({
    droppedFrames: 0,
    totalFrames: 0,
    fps: 0,
    bufferHealth: 0,
    audioLatency: 0,
  });
  const [isPlaying, setIsPlaying] = useState(false);

  // Configure video element for optimal playback
  const configureVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Set optimal attributes
    video.preload = preload;
    video.playsInline = true;
    video.disablePictureInPicture = false;

    // Hint for hardware acceleration
    if (hardwareAcceleration) {
      // Use CSS transform to hint GPU compositing
      video.style.transform = 'translateZ(0)';
      video.style.willChange = 'transform';
    }

    // Set buffer hint via SourceBuffer if using MSE
    if ('mediaSource' in window && video.src.startsWith('blob:')) {
      // MSE buffer management is handled automatically
    }

    // Enable smooth playback
    video.defaultPlaybackRate = 1.0;

    // Monitor playback quality
    const updateStats = () => {
      const quality = (video as HTMLVideoElement & {
        getVideoPlaybackQuality?: () => VideoPlaybackQuality;
      }).getVideoPlaybackQuality?.();

      if (quality) {
        const now = performance.now();
        const elapsed = now - lastFrameTimeRef.current;

        if (elapsed >= 1000) {
          const currentFps = Math.round((frameCountRef.current / elapsed) * 1000);
          setStats({
            droppedFrames: quality.droppedVideoFrames,
            totalFrames: quality.totalVideoFrames,
            fps: currentFps,
            bufferHealth: getBufferHealth(video),
            audioLatency: 0,
          });
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }

        frameCountRef.current++;
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateStats);
      }
    };

    video.addEventListener('play', () => {
      setIsPlaying(true);
      lastFrameTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updateStats);
    });

    video.addEventListener('pause', () => {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    });

    video.addEventListener('ended', () => {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    });

    return video;
  }, [preload, hardwareAcceleration, isPlaying]);

  // Get buffer health (0-1)
  const getBufferHealth = (video: HTMLVideoElement): number => {
    if (video.buffered.length === 0) return 0;

    const currentTime = video.currentTime;
    let bufferedEnd = 0;

    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= currentTime && video.buffered.end(i) >= currentTime) {
        bufferedEnd = video.buffered.end(i);
        break;
      }
    }

    const bufferedAhead = bufferedEnd - currentTime;
    return Math.min(bufferedAhead / bufferSize, 1);
  };

  // Frame-accurate seeking
  const seekToFrame = useCallback((frameNumber: number, fps: number = 30) => {
    if (!videoRef.current) return;

    const targetTime = frameNumber / fps;
    videoRef.current.currentTime = targetTime;
  }, []);

  // Step forward/backward by one frame
  const stepFrame = useCallback((direction: 1 | -1, fps: number = 30) => {
    if (!videoRef.current) return;

    const frameTime = 1 / fps;
    const currentTime = videoRef.current.currentTime;
    videoRef.current.currentTime = Math.max(0, currentTime + direction * frameTime);
  }, []);

  // Get current frame number
  const getCurrentFrame = useCallback((fps: number = 30): number => {
    if (!videoRef.current) return 0;
    return Math.floor(videoRef.current.currentTime * fps);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    videoRef,
    configureVideo,
    stats,
    isPlaying,
    seekToFrame,
    stepFrame,
    getCurrentFrame,
  };
}

/**
 * Hook for low-latency audio playback and analysis
 */
export function useOptimizedAudio(options: AudioPlaybackOptions = {}) {
  const {
    latencyHint = 'interactive',
    sampleRate = 48000,
    echoCancellation = true,
    noiseSuppression = true,
  } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize audio context with low latency settings
  const initializeAudio = useCallback(async () => {
    if (audioContextRef.current) return audioContextRef.current;

    try {
      // Create audio context with optimal settings
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      audioContextRef.current = new AudioContextClass({
        latencyHint,
        sampleRate,
      });

      // Create gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);

      // Create analyser for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      analyserRef.current.connect(gainNodeRef.current);

      // Measure actual latency
      if ('outputLatency' in audioContextRef.current) {
        setLatency((audioContextRef.current as AudioContext & { outputLatency?: number }).outputLatency || 0);
      } else if ('baseLatency' in audioContextRef.current) {
        setLatency(audioContextRef.current.baseLatency);
      }

      setIsInitialized(true);
      console.log('[OptimizedAudio] Initialized with latency:', latency * 1000, 'ms');

      return audioContextRef.current;
    } catch (error) {
      console.error('[OptimizedAudio] Failed to initialize:', error);
      return null;
    }
  }, [latencyHint, sampleRate, latency]);

  // Connect an audio/video element for playback
  const connectMediaElement = useCallback((element: HTMLMediaElement) => {
    if (!audioContextRef.current || !analyserRef.current) return;

    // Resume context if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    // Disconnect existing source
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }

    // Create new source from element
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(element);
    sourceNodeRef.current.connect(analyserRef.current);
  }, []);

  // Connect an audio buffer for low-latency playback
  const playBuffer = useCallback((buffer: AudioBuffer, startTime: number = 0) => {
    if (!audioContextRef.current || !analyserRef.current) return null;

    // Resume context if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current);
    source.start(0, startTime);

    return source;
  }, []);

  // Get frequency data for visualization
  const getFrequencyData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current) return null;

    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, []);

  // Get time domain data (waveform)
  const getTimeDomainData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current) return null;

    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);
    return data;
  }, []);

  // Set volume (0-1)
  const setVolume = useCallback((volume: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        audioContextRef.current?.currentTime || 0
      );
    }
  }, []);

  // Get microphone input with low latency
  const getMicrophoneInput = useCallback(async () => {
    if (!audioContextRef.current) {
      await initializeAudio();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl: true,
          sampleRate,
          channelCount: 1,
          latency: 0.01, // Request 10ms latency
        },
      });

      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        return { stream, source };
      }

      return null;
    } catch (error) {
      console.error('[OptimizedAudio] Failed to get microphone:', error);
      return null;
    }
  }, [initializeAudio, echoCancellation, noiseSuppression, sampleRate]);

  // Cleanup
  const dispose = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    sourceNodeRef.current = null;
    analyserRef.current = null;
    gainNodeRef.current = null;
    setIsInitialized(false);
  }, []);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    audioContext: audioContextRef.current,
    analyser: analyserRef.current,
    latency,
    isInitialized,
    initializeAudio,
    connectMediaElement,
    playBuffer,
    getFrequencyData,
    getTimeDomainData,
    setVolume,
    getMicrophoneInput,
    dispose,
  };
}

/**
 * Combined hook for synchronized audio/video playback
 */
export function useOptimizedMediaPlayback() {
  const video = useOptimizedVideo();
  const audio = useOptimizedAudio();

  // Synchronize audio context with video element
  const connectVideoWithAudio = useCallback((videoElement: HTMLVideoElement) => {
    video.configureVideo(videoElement);

    // Connect video audio to Web Audio API for processing
    audio.initializeAudio().then(() => {
      audio.connectMediaElement(videoElement);
    });
  }, [video, audio]);

  return {
    video,
    audio,
    connectVideoWithAudio,
  };
}

export default useOptimizedMediaPlayback;
