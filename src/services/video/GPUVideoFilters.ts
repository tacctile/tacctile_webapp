/**
 * GPUVideoFilters Service
 * WebGL-based GPU-accelerated video filters for 60fps real-time processing
 */

// Vertex shader - passes through vertices and texture coordinates
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// Fragment shader for various filters
const FRAGMENT_SHADERS = {
  // Pass-through shader
  passthrough: `
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_texCoord;

    void main() {
      gl_FragColor = texture2D(u_texture, v_texCoord);
    }
  `,

  // Brightness/Contrast/Saturation adjustment
  colorAdjust: `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_brightness;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_gamma;
    varying vec2 v_texCoord;

    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
      vec4 color = texture2D(u_texture, v_texCoord);

      // Apply brightness
      color.rgb += u_brightness;

      // Apply contrast
      color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;

      // Apply saturation via HSV
      vec3 hsv = rgb2hsv(color.rgb);
      hsv.y *= u_saturation;
      color.rgb = hsv2rgb(hsv);

      // Apply gamma correction
      color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));

      gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
    }
  `,

  // Night vision / infrared enhancement
  nightVision: `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_intensity;
    varying vec2 v_texCoord;

    void main() {
      vec4 color = texture2D(u_texture, v_texCoord);

      // Convert to luminance
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

      // Boost low light areas
      luma = pow(luma, 0.6) * u_intensity;

      // Apply green tint for night vision effect
      vec3 nightColor = vec3(luma * 0.1, luma, luma * 0.1);

      gl_FragColor = vec4(nightColor, color.a);
    }
  `,

  // Thermal camera simulation
  thermal: `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_sensitivity;
    varying vec2 v_texCoord;

    vec3 heatmap(float t) {
      // Black -> Blue -> Cyan -> Green -> Yellow -> Red -> White
      t = clamp(t, 0.0, 1.0);

      vec3 c;
      if (t < 0.2) {
        c = mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), t * 5.0);
      } else if (t < 0.4) {
        c = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), (t - 0.2) * 5.0);
      } else if (t < 0.6) {
        c = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t - 0.4) * 5.0);
      } else if (t < 0.8) {
        c = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.6) * 5.0);
      } else {
        c = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (t - 0.8) * 5.0);
      }

      return c;
    }

    void main() {
      vec4 color = texture2D(u_texture, v_texCoord);

      // Use red channel as "heat" indicator (infrared simulation)
      float heat = (color.r * 0.5 + dot(color.rgb, vec3(0.299, 0.587, 0.114)) * 0.5);
      heat = pow(heat, 1.0 / u_sensitivity);

      gl_FragColor = vec4(heatmap(heat), color.a);
    }
  `,

  // Edge detection / motion enhancement
  edgeDetect: `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_threshold;
    varying vec2 v_texCoord;

    void main() {
      vec2 texelSize = 1.0 / u_resolution;

      // Sobel edge detection
      vec3 tl = texture2D(u_texture, v_texCoord + vec2(-1.0, -1.0) * texelSize).rgb;
      vec3 tm = texture2D(u_texture, v_texCoord + vec2(0.0, -1.0) * texelSize).rgb;
      vec3 tr = texture2D(u_texture, v_texCoord + vec2(1.0, -1.0) * texelSize).rgb;
      vec3 ml = texture2D(u_texture, v_texCoord + vec2(-1.0, 0.0) * texelSize).rgb;
      vec3 mr = texture2D(u_texture, v_texCoord + vec2(1.0, 0.0) * texelSize).rgb;
      vec3 bl = texture2D(u_texture, v_texCoord + vec2(-1.0, 1.0) * texelSize).rgb;
      vec3 bm = texture2D(u_texture, v_texCoord + vec2(0.0, 1.0) * texelSize).rgb;
      vec3 br = texture2D(u_texture, v_texCoord + vec2(1.0, 1.0) * texelSize).rgb;

      vec3 gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
      vec3 gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;

      vec3 edge = sqrt(gx * gx + gy * gy);
      float edgeStrength = dot(edge, vec3(0.333));

      // Threshold and enhance edges
      edgeStrength = smoothstep(u_threshold, u_threshold + 0.1, edgeStrength);

      vec4 original = texture2D(u_texture, v_texCoord);
      gl_FragColor = vec4(mix(original.rgb, vec3(1.0, 1.0, 1.0), edgeStrength), original.a);
    }
  `,

  // Denoise / noise reduction
  denoise: `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_strength;
    varying vec2 v_texCoord;

    void main() {
      vec2 texelSize = 1.0 / u_resolution;

      // Bilateral-like blur for noise reduction
      vec4 center = texture2D(u_texture, v_texCoord);
      vec4 sum = center;
      float weightSum = 1.0;

      for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
          if (x == 0.0 && y == 0.0) continue;

          vec2 offset = vec2(x, y) * texelSize;
          vec4 sample = texture2D(u_texture, v_texCoord + offset);

          // Weight by spatial distance
          float spatialWeight = exp(-dot(offset, offset) * 100.0);

          // Weight by color difference
          float colorDiff = length(sample.rgb - center.rgb);
          float colorWeight = exp(-colorDiff * colorDiff * 10.0 / u_strength);

          float weight = spatialWeight * colorWeight;
          sum += sample * weight;
          weightSum += weight;
        }
      }

      gl_FragColor = sum / weightSum;
    }
  `,

  // Sharpen
  sharpen: `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_amount;
    varying vec2 v_texCoord;

    void main() {
      vec2 texelSize = 1.0 / u_resolution;

      vec4 center = texture2D(u_texture, v_texCoord);
      vec4 top = texture2D(u_texture, v_texCoord + vec2(0.0, -1.0) * texelSize);
      vec4 bottom = texture2D(u_texture, v_texCoord + vec2(0.0, 1.0) * texelSize);
      vec4 left = texture2D(u_texture, v_texCoord + vec2(-1.0, 0.0) * texelSize);
      vec4 right = texture2D(u_texture, v_texCoord + vec2(1.0, 0.0) * texelSize);

      vec4 sharpened = center * (1.0 + 4.0 * u_amount) - u_amount * (top + bottom + left + right);

      gl_FragColor = clamp(sharpened, 0.0, 1.0);
    }
  `,
};

export type FilterType = keyof typeof FRAGMENT_SHADERS;

export interface FilterParams {
  brightness?: number;      // -1 to 1
  contrast?: number;        // 0 to 2
  saturation?: number;      // 0 to 2
  gamma?: number;           // 0.1 to 3
  intensity?: number;       // 0 to 2
  sensitivity?: number;     // 0.1 to 3
  threshold?: number;       // 0 to 1
  strength?: number;        // 0.1 to 2
  amount?: number;          // 0 to 2
}

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

class GPUVideoFilters {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private programs: Map<FilterType, ShaderProgram> = new Map();
  private texture: WebGLTexture | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private isInitialized = false;
  private currentFilter: FilterType = 'passthrough';

  /**
   * Initialize WebGL context and shaders
   */
  async initialize(canvas?: HTMLCanvasElement): Promise<boolean> {
    try {
      this.canvas = canvas || document.createElement('canvas');

      // Try WebGL2 first, fall back to WebGL1
      this.gl = this.canvas.getContext('webgl2', {
        antialias: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }) as WebGLRenderingContext;

      if (!this.gl) {
        this.gl = this.canvas.getContext('webgl', {
          antialias: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        });
      }

      if (!this.gl) {
        console.error('[GPUVideoFilters] WebGL not supported');
        return false;
      }

      // Set up geometry buffers
      this.setupBuffers();

      // Compile all shaders
      for (const [name, fragmentSrc] of Object.entries(FRAGMENT_SHADERS)) {
        const program = this.createProgram(VERTEX_SHADER, fragmentSrc);
        if (program) {
          this.programs.set(name as FilterType, program);
        }
      }

      // Create texture for video frames
      this.texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

      this.isInitialized = true;
      console.log('[GPUVideoFilters] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[GPUVideoFilters] Initialization failed:', error);
      return false;
    }
  }

  private setupBuffers(): void {
    if (!this.gl) return;

    // Position buffer (full-screen quad)
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), this.gl.STATIC_DRAW);

    // Texture coordinate buffer
    this.texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]), this.gl.STATIC_DRAW);
  }

  private createProgram(vertexSrc: string, fragmentSrc: string): ShaderProgram | null {
    if (!this.gl) return null;

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSrc);

    if (!vertexShader || !fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('[GPUVideoFilters] Program link error:', this.gl.getProgramInfoLog(program));
      return null;
    }

    // Get all uniform locations
    const uniforms: Record<string, WebGLUniformLocation | null> = {
      u_texture: this.gl.getUniformLocation(program, 'u_texture'),
      u_resolution: this.gl.getUniformLocation(program, 'u_resolution'),
      u_brightness: this.gl.getUniformLocation(program, 'u_brightness'),
      u_contrast: this.gl.getUniformLocation(program, 'u_contrast'),
      u_saturation: this.gl.getUniformLocation(program, 'u_saturation'),
      u_gamma: this.gl.getUniformLocation(program, 'u_gamma'),
      u_intensity: this.gl.getUniformLocation(program, 'u_intensity'),
      u_sensitivity: this.gl.getUniformLocation(program, 'u_sensitivity'),
      u_threshold: this.gl.getUniformLocation(program, 'u_threshold'),
      u_strength: this.gl.getUniformLocation(program, 'u_strength'),
      u_amount: this.gl.getUniformLocation(program, 'u_amount'),
    };

    return { program, uniforms };
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('[GPUVideoFilters] Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Set the current filter to apply
   */
  setFilter(filter: FilterType): void {
    if (this.programs.has(filter)) {
      this.currentFilter = filter;
    }
  }

  /**
   * Process a video frame with the current filter
   * @param source - Video element, canvas, or ImageBitmap
   * @param params - Filter parameters
   * @returns The output canvas element
   */
  processFrame(
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
    params: FilterParams = {}
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || !this.gl || !this.canvas || !this.texture) {
      return null;
    }

    const program = this.programs.get(this.currentFilter);
    if (!program) return null;

    // Get source dimensions
    const width = 'videoWidth' in source ? source.videoWidth : source.width;
    const height = 'videoHeight' in source ? source.videoHeight : source.height;

    if (width === 0 || height === 0) return null;

    // Resize canvas to match video
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }

    // Upload video frame to texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);

    // Use the filter program
    this.gl.useProgram(program.program);

    // Set up attributes
    const positionLoc = this.gl.getAttribLocation(program.program, 'a_position');
    const texCoordLoc = this.gl.getAttribLocation(program.program, 'a_texCoord');

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(positionLoc);
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.enableVertexAttribArray(texCoordLoc);
    this.gl.vertexAttribPointer(texCoordLoc, 2, this.gl.FLOAT, false, 0, 0);

    // Set uniforms (use null coalescing to handle both null and undefined)
    const uniforms = program.uniforms;
    if (uniforms.u_texture != null) {
      this.gl.uniform1i(uniforms.u_texture, 0);
    }
    if (uniforms.u_resolution != null) {
      this.gl.uniform2f(uniforms.u_resolution, width, height);
    }
    if (uniforms.u_brightness != null) {
      this.gl.uniform1f(uniforms.u_brightness, params.brightness ?? 0);
    }
    if (uniforms.u_contrast != null) {
      this.gl.uniform1f(uniforms.u_contrast, params.contrast ?? 1);
    }
    if (uniforms.u_saturation != null) {
      this.gl.uniform1f(uniforms.u_saturation, params.saturation ?? 1);
    }
    if (uniforms.u_gamma != null) {
      this.gl.uniform1f(uniforms.u_gamma, params.gamma ?? 1);
    }
    if (uniforms.u_intensity != null) {
      this.gl.uniform1f(uniforms.u_intensity, params.intensity ?? 1);
    }
    if (uniforms.u_sensitivity != null) {
      this.gl.uniform1f(uniforms.u_sensitivity, params.sensitivity ?? 1);
    }
    if (uniforms.u_threshold != null) {
      this.gl.uniform1f(uniforms.u_threshold, params.threshold ?? 0.1);
    }
    if (uniforms.u_strength != null) {
      this.gl.uniform1f(uniforms.u_strength, params.strength ?? 1);
    }
    if (uniforms.u_amount != null) {
      this.gl.uniform1f(uniforms.u_amount, params.amount ?? 0.5);
    }

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    return this.canvas;
  }

  /**
   * Get the output canvas element
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Get available filter types
   */
  getAvailableFilters(): FilterType[] {
    return Array.from(this.programs.keys());
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (this.gl) {
      for (const { program } of this.programs.values()) {
        this.gl.deleteProgram(program);
      }
      this.programs.clear();

      if (this.texture) {
        this.gl.deleteTexture(this.texture);
      }
      if (this.positionBuffer) {
        this.gl.deleteBuffer(this.positionBuffer);
      }
      if (this.texCoordBuffer) {
        this.gl.deleteBuffer(this.texCoordBuffer);
      }
    }

    this.gl = null;
    this.canvas = null;
    this.isInitialized = false;
  }

  /**
   * Check if GPU acceleration is available
   */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      );
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const gpuVideoFilters = new GPUVideoFilters();
export default GPUVideoFilters;
