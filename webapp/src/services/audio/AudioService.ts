/**
 * AudioService - Browser Web Audio API service
 * Pure web audio processing without Node.js dependencies
 */

export interface AudioAnalysis {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  rms: number;
  peak: number;
  spectralCentroid: number;
  spectralFlux: number;
}

export interface AudioRecordingOptions {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

class AudioService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  /**
   * Initialize Web Audio API context
   */
  async init(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Resume context if suspended (required by some browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Get or create audio context
   */
  getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call init() first.');
    }
    return this.audioContext;
  }

  /**
   * Start audio recording from microphone
   */
  async startRecording(options: AudioRecordingOptions = {}): Promise<void> {
    await this.init();

    const {
      sampleRate = 48000,
      channelCount = 1,
      echoCancellation = true,
      noiseSuppression = true,
      autoGainControl = true
    } = options;

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount,
          echoCancellation,
          noiseSuppression,
          autoGainControl
        }
      });

      // Create source node for analysis
      this.sourceNode = this.audioContext!.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser!);

      // Create media recorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.recordedChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error('[AudioService] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop audio recording
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.getSupportedMimeType();
        const blob = new Blob(this.recordedChunks, { type: mimeType });

        // Clean up
        this.recordedChunks = [];
        if (this.sourceNode) {
          this.sourceNode.disconnect();
          this.sourceNode = null;
        }
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Get supported audio MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Analyze audio in real-time
   */
  async analyzeAudio(): Promise<AudioAnalysis> {
    if (!this.analyser) {
      throw new Error('Analyser not initialized');
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    const timeDomainData = new Uint8Array(bufferLength);

    this.analyser.getByteFrequencyData(frequencyData);
    this.analyser.getByteTimeDomainData(timeDomainData);

    // Calculate RMS (Root Mean Square)
    let sum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const normalized = (timeDomainData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / timeDomainData.length);

    // Calculate peak
    const peak = Math.max(...Array.from(timeDomainData).map(v => Math.abs(v - 128) / 128));

    // Calculate spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      weightedSum += frequencyData[i] * i;
      magnitudeSum += frequencyData[i];
    }
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

    // Calculate spectral flux (simple version)
    const spectralFlux = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;

    return {
      frequencyData,
      timeDomainData,
      rms,
      peak,
      spectralCentroid,
      spectralFlux
    };
  }

  /**
   * Load audio file and decode
   */
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    await this.init();

    const arrayBuffer = await file.arrayBuffer();
    return await this.audioContext!.decodeAudioData(arrayBuffer);
  }

  /**
   * Play audio buffer
   */
  async playAudioBuffer(buffer: AudioBuffer): Promise<AudioBufferSourceNode> {
    await this.init();

    const source = this.audioContext!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext!.destination);
    source.start(0);

    return source;
  }

  /**
   * Apply audio effects (gain, filter, etc.)
   */
  createEffectChain(): {
    gain: GainNode;
    filter: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
  } {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    const compressor = this.audioContext.createDynamicsCompressor();

    // Default settings
    gain.gain.value = 1.0;
    filter.type = 'lowpass';
    filter.frequency.value = 350;
    filter.Q.value = 1;

    return { gain, filter, compressor };
  }

  /**
   * Convert audio buffer to WAV blob
   */
  async audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // Write WAV header
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

    // Write audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Get list of available audio input devices
   */
  async getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  }

  /**
   * Get list of available audio output devices
   */
  async getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audiooutput');
  }

  /**
   * Check if microphone access is available
   */
  async checkMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('[AudioService] Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();
export default audioService;
