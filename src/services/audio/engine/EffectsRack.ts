/**
 * Effects Rack
 * Collection of audio effects processors
 */

import { v4 as uuidv4 } from 'uuid';
import * as Tone from 'tone';
import { 
  Effect, 
  EffectType, 
  ReverbParams, 
  DelayParams, 
  CompressorParams,
  FilterParams,
  EQParams 
} from '../types';
import { logger } from '../../../utils/logger';

export class EffectsRack {
  private context: AudioContext;
  private toneContext: Tone.BaseContext;

  constructor(context: AudioContext) {
    this.context = context;
    // Initialize Tone.js with our audio context
    Tone.setContext(new Tone.Context({ context }));
    this.toneContext = Tone.getContext();
  }

  /**
   * Create an effect
   */
  createEffect(type: EffectType | string, params?: any): Effect {
    const id = uuidv4();
    let node: AudioNode | undefined;
    let effect: Effect;

    switch (type) {
      case EffectType.REVERB:
        effect = this.createReverb(id, params);
        break;
      
      case EffectType.DELAY:
        effect = this.createDelay(id, params);
        break;
      
      case EffectType.COMPRESSOR:
        effect = this.createCompressor(id, params);
        break;
      
      case EffectType.EQ:
        effect = this.createEQ(id, params);
        break;
      
      case EffectType.FILTER:
        effect = this.createFilter(id, params);
        break;
      
      case EffectType.DISTORTION:
        effect = this.createDistortion(id, params);
        break;
      
      case EffectType.CHORUS:
        effect = this.createChorus(id, params);
        break;
      
      case EffectType.GATE:
        effect = this.createGate(id, params);
        break;
      
      case EffectType.LIMITER:
        effect = this.createLimiter(id, params);
        break;
      
      case EffectType.PITCH_SHIFT:
        effect = this.createPitchShift(id, params);
        break;
      
      default:
        throw new Error(`Unknown effect type: ${type}`);
    }

    logger.info('Effect created', { id, type });
    return effect;
  }

  /**
   * Create reverb effect
   */
  private createReverb(id: string, params?: ReverbParams): Effect {
    const reverb = new Tone.Reverb({
      decay: params?.decay || 2.5,
      preDelay: params?.preDelay || 0.01,
      wet: params?.wetness || 0.3
    });

    // Use impulse response for better quality
    reverb.generate();

    return {
      id,
      type: EffectType.REVERB,
      name: 'Reverb',
      enabled: true,
      params: {
        roomSize: params?.roomSize || 0.7,
        decay: params?.decay || 2.5,
        wetness: params?.wetness || 0.3,
        preDelay: params?.preDelay || 0.01,
        damping: params?.damping || 0.5
      },
      node: reverb as any
    };
  }

  /**
   * Create delay effect
   */
  private createDelay(id: string, params?: DelayParams): Effect {
    let delay: any;
    
    if (params?.type === 'ping-pong') {
      delay = new Tone.PingPongDelay({
        delayTime: params?.time || 0.25,
        feedback: params?.feedback || 0.3,
        wet: params?.wetness || 0.3
      });
    } else {
      delay = new Tone.FeedbackDelay({
        delayTime: params?.time || 0.25,
        feedback: params?.feedback || 0.3,
        wet: params?.wetness || 0.3
      });
    }

    return {
      id,
      type: EffectType.DELAY,
      name: 'Delay',
      enabled: true,
      params: {
        time: params?.time || 0.25,
        feedback: params?.feedback || 0.3,
        wetness: params?.wetness || 0.3,
        type: params?.type || 'normal'
      },
      node: delay as any
    };
  }

  /**
   * Create compressor effect
   */
  private createCompressor(id: string, params?: CompressorParams): Effect {
    const compressor = new Tone.Compressor({
      threshold: params?.threshold || -24,
      ratio: params?.ratio || 4,
      attack: params?.attack || 0.003,
      release: params?.release || 0.1,
      knee: params?.knee || 10
    });

    return {
      id,
      type: EffectType.COMPRESSOR,
      name: 'Compressor',
      enabled: true,
      params: {
        threshold: params?.threshold || -24,
        ratio: params?.ratio || 4,
        attack: params?.attack || 0.003,
        release: params?.release || 0.1,
        knee: params?.knee || 10,
        makeupGain: params?.makeupGain || 0
      },
      node: compressor as any
    };
  }

  /**
   * Create EQ effect
   */
  private createEQ(id: string, params?: EQParams): Effect {
    const eq = new Tone.EQ3({
      low: params?.bands?.[0]?.gain || 0,
      mid: params?.bands?.[1]?.gain || 0,
      high: params?.bands?.[2]?.gain || 0,
      lowFrequency: params?.bands?.[0]?.frequency || 200,
      highFrequency: params?.bands?.[2]?.frequency || 2000
    });

    return {
      id,
      type: EffectType.EQ,
      name: 'Equalizer',
      enabled: true,
      params: {
        bands: params?.bands || [
          { frequency: 200, gain: 0, Q: 0.7, type: 'lowshelf' },
          { frequency: 1000, gain: 0, Q: 0.7, type: 'peaking' },
          { frequency: 8000, gain: 0, Q: 0.7, type: 'highshelf' }
        ]
      },
      node: eq as any
    };
  }

  /**
   * Create filter effect
   */
  private createFilter(id: string, params?: FilterParams): Effect {
    const filter = new Tone.Filter({
      frequency: params?.frequency || 1000,
      Q: params?.Q || 1,
      type: params?.type || 'lowpass',
      gain: params?.gain || 0
    });

    return {
      id,
      type: EffectType.FILTER,
      name: 'Filter',
      enabled: true,
      params: {
        frequency: params?.frequency || 1000,
        Q: params?.Q || 1,
        type: params?.type || 'lowpass',
        gain: params?.gain || 0
      },
      node: filter as any
    };
  }

  /**
   * Create distortion effect
   */
  private createDistortion(id: string, params?: any): Effect {
    const distortion = new Tone.Distortion({
      distortion: params?.amount || 0.4,
      oversample: params?.oversample || '2x',
      wet: params?.wetness || 1
    });

    return {
      id,
      type: EffectType.DISTORTION,
      name: 'Distortion',
      enabled: true,
      params: {
        amount: params?.amount || 0.4,
        oversample: params?.oversample || '2x',
        wetness: params?.wetness || 1
      },
      node: distortion as any
    };
  }

  /**
   * Create chorus effect
   */
  private createChorus(id: string, params?: any): Effect {
    const chorus = new Tone.Chorus({
      frequency: params?.rate || 1.5,
      delayTime: params?.delay || 3.5,
      depth: params?.depth || 0.7,
      spread: params?.spread || 180,
      wet: params?.wetness || 0.5
    });

    return {
      id,
      type: EffectType.CHORUS,
      name: 'Chorus',
      enabled: true,
      params: {
        rate: params?.rate || 1.5,
        delay: params?.delay || 3.5,
        depth: params?.depth || 0.7,
        spread: params?.spread || 180,
        wetness: params?.wetness || 0.5
      },
      node: chorus as any
    };
  }

  /**
   * Create gate effect
   */
  private createGate(id: string, params?: any): Effect {
    const gate = new Tone.Gate({
      threshold: params?.threshold || -40,
      attack: params?.attack || 0.001,
      release: params?.release || 0.1,
      smoothing: params?.smoothing || 0.01
    });

    return {
      id,
      type: EffectType.GATE,
      name: 'Noise Gate',
      enabled: true,
      params: {
        threshold: params?.threshold || -40,
        attack: params?.attack || 0.001,
        release: params?.release || 0.1,
        smoothing: params?.smoothing || 0.01
      },
      node: gate as any
    };
  }

  /**
   * Create limiter effect
   */
  private createLimiter(id: string, params?: any): Effect {
    const limiter = new Tone.Limiter({
      threshold: params?.threshold || -0.1
    });

    return {
      id,
      type: EffectType.LIMITER,
      name: 'Limiter',
      enabled: true,
      params: {
        threshold: params?.threshold || -0.1
      },
      node: limiter as any
    };
  }

  /**
   * Create pitch shift effect
   */
  private createPitchShift(id: string, params?: any): Effect {
    const pitchShift = new Tone.PitchShift({
      pitch: params?.pitch || 0,
      windowSize: params?.windowSize || 0.1,
      delayTime: params?.delayTime || 0,
      feedback: params?.feedback || 0,
      wet: params?.wetness || 1
    });

    return {
      id,
      type: EffectType.PITCH_SHIFT,
      name: 'Pitch Shift',
      enabled: true,
      params: {
        pitch: params?.pitch || 0,
        windowSize: params?.windowSize || 0.1,
        delayTime: params?.delayTime || 0,
        feedback: params?.feedback || 0,
        wetness: params?.wetness || 1
      },
      node: pitchShift as any
    };
  }

  /**
   * Create custom effect chain for EVP enhancement
   */
  createEVPEnhancer(): Effect[] {
    const effects: Effect[] = [];

    // High-pass filter to remove low frequency noise
    effects.push(this.createFilter(uuidv4(), {
      type: 'highpass',
      frequency: 200,
      Q: 0.7
    }));

    // Compressor to even out levels
    effects.push(this.createCompressor(uuidv4(), {
      threshold: -30,
      ratio: 3,
      attack: 0.001,
      release: 0.05
    }));

    // EQ to boost voice frequencies
    effects.push(this.createEQ(uuidv4(), {
      bands: [
        { frequency: 200, gain: -3, Q: 0.7, type: 'lowshelf' },
        { frequency: 2000, gain: 3, Q: 1, type: 'peaking' },
        { frequency: 8000, gain: 2, Q: 0.7, type: 'highshelf' }
      ]
    }));

    // Noise gate to reduce background noise
    effects.push(this.createGate(uuidv4(), {
      threshold: -45,
      attack: 0.001,
      release: 0.05
    }));

    // Limiter to prevent clipping
    effects.push(this.createLimiter(uuidv4(), {
      threshold: -1
    }));

    logger.info('EVP enhancer chain created', { effectCount: effects.length });
    return effects;
  }

  /**
   * Create noise reduction chain
   */
  createNoiseReduction(): Effect[] {
    const effects: Effect[] = [];

    // Multi-band gate
    effects.push(this.createGate(uuidv4(), {
      threshold: -50,
      attack: 0.001,
      release: 0.1
    }));

    // Low-cut filter
    effects.push(this.createFilter(uuidv4(), {
      type: 'highpass',
      frequency: 80,
      Q: 0.7
    }));

    // High-cut filter
    effects.push(this.createFilter(uuidv4(), {
      type: 'lowpass',
      frequency: 15000,
      Q: 0.7
    }));

    logger.info('Noise reduction chain created', { effectCount: effects.length });
    return effects;
  }

  /**
   * Dispose effects rack
   */
  dispose(): void {
    // Tone.js cleanup
    Tone.dispose();
    logger.info('Effects rack disposed');
  }
}