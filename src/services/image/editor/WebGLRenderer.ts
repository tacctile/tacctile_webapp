/**
 * WebGL Renderer
 * Hardware-accelerated image processing
 */

import { mat4 } from 'gl-matrix';
import { WebGLShader, ImageAdjustments } from '../types';
import { logger } from '../../../utils/logger';

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private programs: Map<string, WebGLProgram> = new Map();
  private textures: Map<string, WebGLTexture> = new Map();
  private framebuffers: Map<string, WebGLFramebuffer> = new Map();
  
  private vertexBuffer: WebGLBuffer;
  private textureCoordBuffer: WebGLBuffer;
  private isWebGL2: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Initialize WebGL context
   */
  async initialize(): Promise<void> {
    // Try WebGL2 first
    this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext;
    
    if (this.gl) {
      this.isWebGL2 = true;
    } else {
      // Fallback to WebGL1
      this.gl = this.canvas.getContext('webgl', {
        preserveDrawingBuffer: true,
        premultipliedAlpha: false,
        antialias: false
      }) as WebGLRenderingContext;
    }
    
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }
    
    // Set up vertex buffers
    this.setupBuffers();
    
    // Load default shaders
    await this.loadDefaultShaders();
    
    // Set up WebGL state
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    
    logger.info('WebGL renderer initialized', { 
      webgl2: this.isWebGL2,
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)
    });
  }

  /**
   * Set up vertex buffers
   */
  private setupBuffers(): void {
    // Vertex positions (full screen quad)
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    
    this.vertexBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    
    // Texture coordinates
    const texCoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1
    ]);
    
    this.textureCoordBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
  }

  /**
   * Load default shaders
   */
  private async loadDefaultShaders(): Promise<void> {
    // Basic pass-through shader
    this.createShaderProgram('default', {
      vertex: this.getDefaultVertexShader(),
      fragment: this.getDefaultFragmentShader(),
      uniforms: {}
    });
    
    // Adjustment shader
    this.createShaderProgram('adjustments', {
      vertex: this.getDefaultVertexShader(),
      fragment: this.getAdjustmentFragmentShader(),
      uniforms: {}
    });
    
    // Blur shader
    this.createShaderProgram('blur', {
      vertex: this.getDefaultVertexShader(),
      fragment: this.getBlurFragmentShader(),
      uniforms: {}
    });
    
    // Sharpen shader
    this.createShaderProgram('sharpen', {
      vertex: this.getDefaultVertexShader(),
      fragment: this.getSharpenFragmentShader(),
      uniforms: {}
    });
    
    // Edge detection shader
    this.createShaderProgram('edges', {
      vertex: this.getDefaultVertexShader(),
      fragment: this.getEdgeDetectionFragmentShader(),
      uniforms: {}
    });
  }

  /**
   * Create shader program
   */
  private createShaderProgram(name: string, shader: WebGLShader): WebGLProgram {
    const vertexShader = this.compileShader(shader.vertex, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(shader.fragment, this.gl.FRAGMENT_SHADER);
    
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      throw new Error(`Failed to link shader program: ${error}`);
    }
    
    this.programs.set(name, program);
    return program;
  }

  /**
   * Compile shader
   */
  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      throw new Error(`Failed to compile shader: ${error}`);
    }
    
    return shader;
  }

  /**
   * Process image with adjustments
   */
  async processImage(
    imageData: ImageData,
    adjustments: ImageAdjustments
  ): Promise<ImageData> {
    // Create texture from image data
    const texture = this.createTextureFromImageData(imageData);
    
    // Create framebuffer for output
    const framebuffer = this.createFramebuffer(imageData.width, imageData.height);
    
    // Use adjustment shader
    const program = this.programs.get('adjustments')!;
    this.gl.useProgram(program);
    
    // Set uniforms
    this.setAdjustmentUniforms(program, adjustments);
    
    // Bind texture
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    const textureLocation = this.gl.getUniformLocation(program, 'u_texture');
    this.gl.uniform1i(textureLocation, 0);
    
    // Set up attributes
    this.setupAttributes(program);
    
    // Render to framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.viewport(0, 0, imageData.width, imageData.height);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    // Read pixels
    const pixels = new Uint8ClampedArray(imageData.width * imageData.height * 4);
    this.gl.readPixels(
      0, 0,
      imageData.width, imageData.height,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE,
      pixels
    );
    
    // Clean up
    this.gl.deleteTexture(texture);
    this.gl.deleteFramebuffer(framebuffer);
    
    return new ImageData(pixels, imageData.width, imageData.height);
  }

  /**
   * Create texture from ImageData
   */
  private createTextureFromImageData(imageData: ImageData): WebGLTexture {
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      imageData.width,
      imageData.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      imageData.data
    );
    
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    
    return texture;
  }

  /**
   * Create framebuffer
   */
  private createFramebuffer(width: number, height: number): WebGLFramebuffer {
    const framebuffer = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
    
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    );
    
    return framebuffer;
  }

  /**
   * Set adjustment uniforms
   */
  private setAdjustmentUniforms(program: WebGLProgram, adjustments: ImageAdjustments): void {
    const setUniform = (name: string, value: number) => {
      const location = this.gl.getUniformLocation(program, name);
      if (location) this.gl.uniform1f(location, value);
    };
    
    setUniform('u_brightness', adjustments.brightness);
    setUniform('u_contrast', adjustments.contrast);
    setUniform('u_saturation', adjustments.saturation);
    setUniform('u_exposure', adjustments.exposure);
    setUniform('u_highlights', adjustments.highlights);
    setUniform('u_shadows', adjustments.shadows);
    setUniform('u_temperature', adjustments.temperature);
    setUniform('u_tint', adjustments.tint);
    setUniform('u_vibrance', adjustments.vibrance);
    setUniform('u_clarity', adjustments.clarity);
  }

  /**
   * Set up vertex attributes
   */
  private setupAttributes(program: WebGLProgram): void {
    // Position attribute
    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    // Texture coordinate attribute
    const texCoordLocation = this.gl.getAttribLocation(program, 'a_texCoord');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  /**
   * Get default vertex shader
   */
  private getDefaultVertexShader(): string {
    return `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
  }

  /**
   * Get default fragment shader
   */
  private getDefaultFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `;
  }

  /**
   * Get adjustment fragment shader
   */
  private getAdjustmentFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_exposure;
      uniform float u_highlights;
      uniform float u_shadows;
      uniform float u_temperature;
      uniform float u_tint;
      uniform float u_vibrance;
      uniform float u_clarity;
      
      varying vec2 v_texCoord;
      
      vec3 adjustBrightness(vec3 color, float brightness) {
        return color + brightness;
      }
      
      vec3 adjustContrast(vec3 color, float contrast) {
        return (color - 0.5) * (1.0 + contrast) + 0.5;
      }
      
      vec3 adjustSaturation(vec3 color, float saturation) {
        float gray = dot(color, vec3(0.2989, 0.5870, 0.1140));
        return mix(vec3(gray), color, saturation);
      }
      
      vec3 adjustExposure(vec3 color, float exposure) {
        return color * pow(2.0, exposure);
      }
      
      vec3 adjustHighlightsShadows(vec3 color, float highlights, float shadows) {
        float luminance = dot(color, vec3(0.2989, 0.5870, 0.1140));
        float highlightMask = smoothstep(0.5, 1.0, luminance);
        float shadowMask = 1.0 - smoothstep(0.0, 0.5, luminance);
        
        color = mix(color, color * (1.0 + highlights), highlightMask);
        color = mix(color, color * (1.0 + shadows), shadowMask);
        
        return color;
      }
      
      vec3 adjustTemperatureTint(vec3 color, float temperature, float tint) {
        color.r += temperature * 0.1;
        color.b -= temperature * 0.1;
        color.g += tint * 0.1;
        return color;
      }
      
      vec3 adjustVibrance(vec3 color, float vibrance) {
        float max_color = max(color.r, max(color.g, color.b));
        float min_color = min(color.r, min(color.g, color.b));
        float color_saturation = max_color - min_color;
        float pixel_vibrance = 1.0 + vibrance * (1.0 - color_saturation);
        
        float gray = dot(color, vec3(0.2989, 0.5870, 0.1140));
        return mix(vec3(gray), color, pixel_vibrance);
      }
      
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        
        // Apply adjustments
        color.rgb = adjustExposure(color.rgb, u_exposure);
        color.rgb = adjustBrightness(color.rgb, u_brightness);
        color.rgb = adjustContrast(color.rgb, u_contrast);
        color.rgb = adjustHighlightsShadows(color.rgb, u_highlights, u_shadows);
        color.rgb = adjustSaturation(color.rgb, u_saturation);
        color.rgb = adjustVibrance(color.rgb, u_vibrance);
        color.rgb = adjustTemperatureTint(color.rgb, u_temperature, u_tint);
        
        // Apply clarity (local contrast enhancement)
        if (u_clarity > 0.0) {
          vec2 texelSize = 1.0 / vec2(textureSize(u_texture, 0));
          vec3 blur = vec3(0.0);
          for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
              vec2 offset = vec2(float(x), float(y)) * texelSize;
              blur += texture2D(u_texture, v_texCoord + offset).rgb;
            }
          }
          blur /= 9.0;
          color.rgb = mix(color.rgb, color.rgb + (color.rgb - blur) * 2.0, u_clarity);
        }
        
        // Clamp values
        color.rgb = clamp(color.rgb, 0.0, 1.0);
        
        gl_FragColor = color;
      }
    `;
  }

  /**
   * Get blur fragment shader
   */
  private getBlurFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform float u_radius;
      
      varying vec2 v_texCoord;
      
      void main() {
        vec2 texelSize = 1.0 / u_resolution;
        vec4 color = vec4(0.0);
        float total = 0.0;
        
        // Gaussian blur
        for (float x = -u_radius; x <= u_radius; x++) {
          for (float y = -u_radius; y <= u_radius; y++) {
            vec2 offset = vec2(x, y) * texelSize;
            float weight = exp(-(x*x + y*y) / (2.0 * u_radius * u_radius));
            color += texture2D(u_texture, v_texCoord + offset) * weight;
            total += weight;
          }
        }
        
        gl_FragColor = color / total;
      }
    `;
  }

  /**
   * Get sharpen fragment shader
   */
  private getSharpenFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform float u_amount;
      
      varying vec2 v_texCoord;
      
      void main() {
        vec2 texelSize = 1.0 / u_resolution;
        
        vec4 center = texture2D(u_texture, v_texCoord);
        vec4 top = texture2D(u_texture, v_texCoord + vec2(0.0, -texelSize.y));
        vec4 bottom = texture2D(u_texture, v_texCoord + vec2(0.0, texelSize.y));
        vec4 left = texture2D(u_texture, v_texCoord + vec2(-texelSize.x, 0.0));
        vec4 right = texture2D(u_texture, v_texCoord + vec2(texelSize.x, 0.0));
        
        // Unsharp mask
        vec4 blur = (top + bottom + left + right) * 0.25;
        vec4 sharpened = center + (center - blur) * u_amount;
        
        gl_FragColor = clamp(sharpened, 0.0, 1.0);
      }
    `;
  }

  /**
   * Get edge detection fragment shader
   */
  private getEdgeDetectionFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform float u_threshold;
      
      varying vec2 v_texCoord;
      
      float luminance(vec3 color) {
        return dot(color, vec3(0.2989, 0.5870, 0.1140));
      }
      
      void main() {
        vec2 texelSize = 1.0 / u_resolution;
        
        // Sobel operator
        float tl = luminance(texture2D(u_texture, v_texCoord + vec2(-texelSize.x, -texelSize.y)).rgb);
        float tm = luminance(texture2D(u_texture, v_texCoord + vec2(0.0, -texelSize.y)).rgb);
        float tr = luminance(texture2D(u_texture, v_texCoord + vec2(texelSize.x, -texelSize.y)).rgb);
        float ml = luminance(texture2D(u_texture, v_texCoord + vec2(-texelSize.x, 0.0)).rgb);
        float mm = luminance(texture2D(u_texture, v_texCoord).rgb);
        float mr = luminance(texture2D(u_texture, v_texCoord + vec2(texelSize.x, 0.0)).rgb);
        float bl = luminance(texture2D(u_texture, v_texCoord + vec2(-texelSize.x, texelSize.y)).rgb);
        float bm = luminance(texture2D(u_texture, v_texCoord + vec2(0.0, texelSize.y)).rgb);
        float br = luminance(texture2D(u_texture, v_texCoord + vec2(texelSize.x, texelSize.y)).rgb);
        
        float gx = -1.0 * tl + 1.0 * tr + -2.0 * ml + 2.0 * mr + -1.0 * bl + 1.0 * br;
        float gy = -1.0 * tl + -2.0 * tm + -1.0 * tr + 1.0 * bl + 2.0 * bm + 1.0 * br;
        
        float edge = sqrt(gx * gx + gy * gy);
        edge = step(u_threshold, edge);
        
        gl_FragColor = vec4(vec3(edge), 1.0);
      }
    `;
  }

  /**
   * Apply convolution kernel
   */
  applyKernel(imageData: ImageData, kernel: Float32Array, divisor: number = 1): ImageData {
    const program = this.programs.get('default')!;
    // Implementation for kernel convolution
    // This would be expanded with proper kernel shader
    return imageData;
  }

  /**
   * Dispose WebGL resources
   */
  dispose(): void {
    // Delete programs
    this.programs.forEach(program => {
      this.gl.deleteProgram(program);
    });
    this.programs.clear();
    
    // Delete textures
    this.textures.forEach(texture => {
      this.gl.deleteTexture(texture);
    });
    this.textures.clear();
    
    // Delete framebuffers
    this.framebuffers.forEach(framebuffer => {
      this.gl.deleteFramebuffer(framebuffer);
    });
    this.framebuffers.clear();
    
    // Delete buffers
    this.gl.deleteBuffer(this.vertexBuffer);
    this.gl.deleteBuffer(this.textureCoordBuffer);
    
    logger.info('WebGL renderer disposed');
  }
}