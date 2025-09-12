/**
 * Disturbance Visualizer
 * Real-time visualization of laser grid disturbances with overlay effects
 */

import { EventEmitter } from 'events';
import {
  GridDisturbance,
  DisturbanceType,
  ProcessedFrame,
  VisualizationConfig,
  Vector2,
  BoundingBox2D,
  DetectedDot,
  GridPattern
} from '../types';
import { logger } from '../../../utils/logger';

export interface VisualizationElement {
  id: string;
  type: 'dot' | 'disturbance' | 'trail' | 'ghost' | 'highlight';
  position: Vector2;
  size: Vector2;
  color: string;
  opacity: number;
  duration?: number;
  animation?: VisualizationAnimation;
  metadata?: any;
}

export interface VisualizationAnimation {
  type: 'pulse' | 'fade' | 'grow' | 'shake' | 'spiral' | 'ripple';
  duration: number;
  intensity: number;
  startTime: number;
}

export interface DisturbanceTrail {
  disturbanceId: string;
  positions: Array<{ position: Vector2; timestamp: number; intensity: number }>;
  maxLength: number;
  color: string;
}

export class DisturbanceVisualizer extends EventEmitter {
  private config: VisualizationConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationFrame: number = 0;
  private isAnimating: boolean = false;
  
  private elements: Map<string, VisualizationElement> = new Map();
  private trails: Map<string, DisturbanceTrail> = new Map();
  private ghostEffects: Map<string, VisualizationElement> = new Map();
  
  private frameHistory: ProcessedFrame[] = [];
  private lastRenderTime: number = 0;
  private frameRate: number = 30;

  constructor(canvas: HTMLCanvasElement, config?: Partial<VisualizationConfig>) {
    super();
    
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.config = {
      showOriginalDots: true,
      showDetectedDots: true,
      showDisturbances: true,
      showTrails: true,
      showGrid: false,
      overlayOpacity: 0.8,
      disturbanceColor: '#ff0000',
      trailLength: 10,
      highlightThreshold: 0.7,
      ...config
    };

    this.setupCanvas();
  }

  /**
   * Setup canvas properties
   */
  private setupCanvas(): void {
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.globalCompositeOperation = 'source-over';
    
    // Set high DPI support
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  /**
   * Render processed frame with overlays
   */
  renderFrame(frame: ProcessedFrame): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw original camera frame
    this.drawCameraFrame(frame.originalFrame);

    // Draw grid reference if enabled
    if (this.config.showGrid) {
      this.drawGridReference(frame);
    }

    // Draw expected dots if enabled
    if (this.config.showOriginalDots) {
      this.drawOriginalDots(frame);
    }

    // Draw detected dots if enabled
    if (this.config.showDetectedDots) {
      this.drawDetectedDots(frame.detectedDots);
    }

    // Draw disturbances if enabled
    if (this.config.showDisturbances) {
      this.drawDisturbances(frame.disturbances);
    }

    // Draw trails if enabled
    if (this.config.showTrails) {
      this.drawTrails();
    }

    // Draw ghost effects
    this.drawGhostEffects();

    // Update trails
    this.updateTrails(frame.disturbances);

    // Update frame history
    this.updateFrameHistory(frame);

    // Start animation loop if not running
    if (!this.isAnimating) {
      this.startAnimation();
    }
  }

  /**
   * Draw original camera frame
   */
  private drawCameraFrame(frame: any): void {
    // Draw camera frame as background with reduced opacity
    this.ctx.globalAlpha = 0.3;
    
    // Convert frame data to ImageData and draw
    const imageData = this.ctx.createImageData(frame.width, frame.height);
    
    for (let i = 0; i < frame.imageData.length; i++) {
      const pixelIndex = i * 4;
      const grayValue = frame.imageData[i];
      
      imageData.data[pixelIndex] = grayValue;     // R
      imageData.data[pixelIndex + 1] = grayValue; // G
      imageData.data[pixelIndex + 2] = grayValue; // B
      imageData.data[pixelIndex + 3] = 255;       // A
    }
    
    // Scale to canvas size
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frame.width;
    tempCanvas.height = frame.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);
    
    this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw grid reference lines
   */
  private drawGridReference(frame: ProcessedFrame): void {
    if (!frame.gridAlignment || frame.gridAlignment.confidence < 0.5) return;

    this.ctx.globalAlpha = 0.2;
    this.ctx.strokeStyle = '#00ff00';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);

    // Draw grid lines based on alignment
    const { width, height } = this.canvas;
    const gridSpacing = 50; // pixels

    // Vertical lines
    for (let x = 0; x < width; x += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < height; y += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    this.ctx.setLineDash([]);
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw original expected dots
   */
  private drawOriginalDots(frame: ProcessedFrame): void {
    // This would draw the expected dot positions
    // For now, we'll use a simplified representation
    
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillStyle = '#0088ff';

    // Draw expected positions as small circles
    for (let x = 50; x < this.canvas.width; x += 50) {
      for (let y = 50; y < this.canvas.height; y += 50) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw detected dots
   */
  private drawDetectedDots(detectedDots: DetectedDot[]): void {
    for (const dot of detectedDots) {
      const baseColor = dot.matched ? '#00ff00' : '#ffff00';
      const intensity = Math.min(1, dot.confidence * 2);
      
      this.ctx.globalAlpha = intensity;
      this.ctx.fillStyle = this.adjustColorIntensity(baseColor, intensity);

      // Draw dot
      this.ctx.beginPath();
      this.ctx.arc(dot.position.x, dot.position.y, dot.size / 2, 0, 2 * Math.PI);
      this.ctx.fill();

      // Draw confidence indicator
      if (dot.confidence > this.config.highlightThreshold) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      // Draw displacement vector if available
      if (dot.displacement && dot.expectedPosition) {
        this.ctx.globalAlpha = 0.7;
        this.ctx.strokeStyle = '#ff8800';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([3, 3]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(dot.expectedPosition.x, dot.expectedPosition.y);
        this.ctx.lineTo(dot.position.x, dot.position.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
      }
    }

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw disturbances with specialized effects
   */
  private drawDisturbances(disturbances: GridDisturbance[]): void {
    for (const disturbance of disturbances) {
      this.drawDisturbance(disturbance);
      this.createDisturbanceEffects(disturbance);
    }
  }

  /**
   * Draw individual disturbance
   */
  private drawDisturbance(disturbance: GridDisturbance): void {
    const baseColor = this.getDisturbanceColor(disturbance.disturbanceType);
    const intensity = Math.min(1, disturbance.intensity * 1.5);
    
    this.ctx.globalAlpha = intensity * this.config.overlayOpacity;
    
    switch (disturbance.disturbanceType) {
      case DisturbanceType.DOT_OCCLUSION:
        this.drawOcclusionEffect(disturbance, baseColor);
        break;
      case DisturbanceType.DOT_DISPLACEMENT:
        this.drawDisplacementEffect(disturbance, baseColor);
        break;
      case DisturbanceType.DOT_DIMMING:
        this.drawDimmingEffect(disturbance, baseColor);
        break;
      case DisturbanceType.DOT_BRIGHTENING:
        this.drawBrighteningEffect(disturbance, baseColor);
        break;
      case DisturbanceType.PATTERN_DISTORTION:
        this.drawDistortionEffect(disturbance, baseColor);
        break;
      case DisturbanceType.SHADOW_CAST:
        this.drawShadowEffect(disturbance, baseColor);
        break;
      case DisturbanceType.INTERFERENCE:
        this.drawInterferenceEffect(disturbance, baseColor);
        break;
      default:
        this.drawGenericDisturbance(disturbance, baseColor);
    }

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw occlusion effect
   */
  private drawOcclusionEffect(disturbance: GridDisturbance, color: string): void {
    const { position, size } = disturbance;
    
    // Dark circle with red border
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, Math.max(size.x, size.y) / 2, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Pulsing red border
    const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    this.ctx.strokeStyle = this.adjustColorIntensity(color, pulseIntensity);
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Add "X" mark
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 2;
    const radius = Math.max(size.x, size.y) / 3;
    
    this.ctx.beginPath();
    this.ctx.moveTo(position.x - radius, position.y - radius);
    this.ctx.lineTo(position.x + radius, position.y + radius);
    this.ctx.moveTo(position.x + radius, position.y - radius);
    this.ctx.lineTo(position.x - radius, position.y + radius);
    this.ctx.stroke();
  }

  /**
   * Draw displacement effect
   */
  private drawDisplacementEffect(disturbance: GridDisturbance, color: string): void {
    const { position, size, metadata } = disturbance;
    
    if (!metadata?.velocityVector) return;

    // Draw motion blur effect
    const velocity = metadata.velocityVector;
    const blurLength = Math.min(30, Math.sqrt(velocity.x ** 2 + velocity.y ** 2));
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size.x;
    this.ctx.lineCap = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(position.x - velocity.x, position.y - velocity.y);
    this.ctx.lineTo(position.x, position.y);
    this.ctx.stroke();

    // Add directional arrow
    this.drawArrow(
      { x: position.x - velocity.x / 2, y: position.y - velocity.y / 2 },
      velocity,
      color
    );
  }

  /**
   * Draw dimming effect
   */
  private drawDimmingEffect(disturbance: GridDisturbance, color: string): void {
    const { position, size } = disturbance;
    
    // Fading circle effect
    const fadeIntensity = 0.3 + 0.4 * Math.sin(Date.now() / 300);
    this.ctx.fillStyle = this.adjustColorIntensity('#000080', fadeIntensity);
    
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, Math.max(size.x, size.y) / 2, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Add dimming indicator
    this.ctx.strokeStyle = '#4444ff';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  /**
   * Draw brightening effect
   */
  private drawBrighteningEffect(disturbance: GridDisturbance, color: string): void {
    const { position, size } = disturbance;
    
    // Glowing effect
    const glowIntensity = 0.5 + 0.5 * Math.sin(Date.now() / 150);
    
    // Create radial gradient
    const gradient = this.ctx.createRadialGradient(
      position.x, position.y, 0,
      position.x, position.y, Math.max(size.x, size.y)
    );
    
    gradient.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 0, ${glowIntensity * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, Math.max(size.x, size.y), 0, 2 * Math.PI);
    this.ctx.fill();
  }

  /**
   * Draw distortion effect
   */
  private drawDistortionEffect(disturbance: GridDisturbance, color: string): void {
    const { position, size } = disturbance;
    
    // Wavy distortion pattern
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    
    const time = Date.now() / 100;
    const waveCount = 8;
    const radius = Math.max(size.x, size.y) / 2;
    
    this.ctx.beginPath();
    for (let i = 0; i <= waveCount * 2 * Math.PI; i += 0.1) {
      const waveRadius = radius + 5 * Math.sin(i * 4 + time);
      const x = position.x + Math.cos(i) * waveRadius;
      const y = position.y + Math.sin(i) * waveRadius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
  }

  /**
   * Draw shadow effect
   */
  private drawShadowEffect(disturbance: GridDisturbance, color: string): void {
    const { position, size } = disturbance;
    
    // Dark shadowy area with soft edges
    const gradient = this.ctx.createRadialGradient(
      position.x, position.y, 0,
      position.x, position.y, Math.max(size.x, size.y)
    );
    
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, Math.max(size.x, size.y), 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Add eerie glow around shadow
    this.ctx.strokeStyle = '#660066';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  /**
   * Draw interference effect
   */
  private drawInterferenceEffect(disturbance: GridDisturbance, color: string): void {
    const { position, size } = disturbance;
    
    // Static/noise pattern
    this.ctx.fillStyle = color;
    
    const noiseSize = 2;
    const area = Math.max(size.x, size.y);
    
    for (let x = position.x - area/2; x < position.x + area/2; x += noiseSize) {
      for (let y = position.y - area/2; y < position.y + area/2; y += noiseSize) {
        if (Math.random() > 0.7) {
          this.ctx.fillRect(x, y, noiseSize, noiseSize);
        }
      }
    }
  }

  /**
   * Draw generic disturbance
   */
  private drawGenericDisturbance(disturbance: GridDisturbance, color: string): void {
    const { position, size } = disturbance;
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, Math.max(size.x, size.y) / 2, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  /**
   * Create disturbance effects
   */
  private createDisturbanceEffects(disturbance: GridDisturbance): void {
    // Create ripple effect for high-intensity disturbances
    if (disturbance.intensity > 0.7) {
      this.createRippleEffect(disturbance.position, disturbance.intensity);
    }

    // Create ghost trail for moving disturbances
    if (disturbance.disturbanceType === DisturbanceType.DOT_DISPLACEMENT) {
      this.createGhostTrail(disturbance);
    }

    // Create pulsing effect for occlusions
    if (disturbance.disturbanceType === DisturbanceType.DOT_OCCLUSION) {
      this.createPulseEffect(disturbance.position, '#ff0000');
    }
  }

  /**
   * Create ripple effect
   */
  private createRippleEffect(position: Vector2, intensity: number): void {
    const ripple: VisualizationElement = {
      id: `ripple_${Date.now()}_${Math.random()}`,
      type: 'highlight',
      position,
      size: { x: 10, y: 10 },
      color: '#ff6600',
      opacity: intensity,
      animation: {
        type: 'ripple',
        duration: 1000,
        intensity,
        startTime: Date.now()
      }
    };

    this.elements.set(ripple.id, ripple);
    
    // Auto-remove after animation
    setTimeout(() => {
      this.elements.delete(ripple.id);
    }, ripple.animation!.duration);
  }

  /**
   * Create ghost trail effect
   */
  private createGhostTrail(disturbance: GridDisturbance): void {
    if (!disturbance.metadata?.velocityVector) return;

    const trail = this.trails.get(disturbance.id);
    if (trail) {
      // Update existing trail
      trail.positions.push({
        position: disturbance.position,
        timestamp: Date.now(),
        intensity: disturbance.intensity
      });

      // Limit trail length
      if (trail.positions.length > trail.maxLength) {
        trail.positions.shift();
      }
    } else {
      // Create new trail
      this.trails.set(disturbance.id, {
        disturbanceId: disturbance.id,
        positions: [{
          position: disturbance.position,
          timestamp: Date.now(),
          intensity: disturbance.intensity
        }],
        maxLength: this.config.trailLength,
        color: this.getDisturbanceColor(disturbance.disturbanceType)
      });
    }
  }

  /**
   * Create pulse effect
   */
  private createPulseEffect(position: Vector2, color: string): void {
    const pulse: VisualizationElement = {
      id: `pulse_${Date.now()}_${Math.random()}`,
      type: 'highlight',
      position,
      size: { x: 20, y: 20 },
      color,
      opacity: 0.8,
      animation: {
        type: 'pulse',
        duration: 800,
        intensity: 1.0,
        startTime: Date.now()
      }
    };

    this.elements.set(pulse.id, pulse);
    
    setTimeout(() => {
      this.elements.delete(pulse.id);
    }, pulse.animation!.duration);
  }

  /**
   * Draw trails
   */
  private drawTrails(): void {
    const currentTime = Date.now();
    
    for (const trail of this.trails.values()) {
      if (trail.positions.length < 2) continue;

      this.ctx.strokeStyle = trail.color;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Draw trail as connected lines with fading opacity
      for (let i = 1; i < trail.positions.length; i++) {
        const prev = trail.positions[i - 1];
        const curr = trail.positions[i];
        
        const age = currentTime - prev.timestamp;
        const maxAge = 2000; // 2 seconds
        const opacity = Math.max(0, 1 - (age / maxAge));
        
        if (opacity <= 0) continue;

        this.ctx.globalAlpha = opacity * curr.intensity;
        
        this.ctx.beginPath();
        this.ctx.moveTo(prev.position.x, prev.position.y);
        this.ctx.lineTo(curr.position.x, curr.position.y);
        this.ctx.stroke();
      }

      // Remove old trail positions
      trail.positions = trail.positions.filter(pos => 
        currentTime - pos.timestamp < 2000
      );
    }

    this.ctx.globalAlpha = 1.0;

    // Clean up empty trails
    for (const [id, trail] of this.trails.entries()) {
      if (trail.positions.length === 0) {
        this.trails.delete(id);
      }
    }
  }

  /**
   * Draw ghost effects
   */
  private drawGhostEffects(): void {
    const currentTime = Date.now();
    
    for (const element of this.elements.values()) {
      if (!element.animation) continue;

      const elapsed = currentTime - element.animation.startTime;
      const progress = elapsed / element.animation.duration;
      
      if (progress >= 1) continue;

      this.drawAnimatedElement(element, progress);
    }
  }

  /**
   * Draw animated element
   */
  private drawAnimatedElement(element: VisualizationElement, progress: number): void {
    const { animation } = element;
    if (!animation) return;

    let scale = 1;
    let opacity = element.opacity;
    let rotation = 0;

    switch (animation.type) {
      case 'pulse':
        scale = 1 + 0.5 * Math.sin(progress * Math.PI * 4) * (1 - progress);
        opacity *= 1 - progress;
        break;
      case 'fade':
        opacity *= 1 - progress;
        break;
      case 'grow':
        scale = progress;
        break;
      case 'ripple':
        scale = 1 + progress * 3;
        opacity *= 1 - progress;
        break;
      case 'spiral':
        rotation = progress * Math.PI * 4;
        scale = 1 + progress * 0.5;
        opacity *= 1 - progress;
        break;
    }

    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    
    // Apply transformations
    this.ctx.translate(element.position.x, element.position.y);
    this.ctx.rotate(rotation);
    this.ctx.scale(scale, scale);

    // Draw element
    this.ctx.fillStyle = element.color;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, Math.max(element.size.x, element.size.y) / 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.restore();
  }

  /**
   * Draw arrow
   */
  private drawArrow(position: Vector2, direction: Vector2, color: string): void {
    const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);
    if (length < 5) return;

    const angle = Math.atan2(direction.y, direction.x);
    const headLength = Math.min(15, length * 0.3);
    
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 2;

    // Draw arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(
      position.x + direction.x,
      position.y + direction.y
    );
    this.ctx.lineTo(
      position.x + direction.x - headLength * Math.cos(angle - Math.PI / 6),
      position.y + direction.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      position.x + direction.x - headLength * Math.cos(angle + Math.PI / 6),
      position.y + direction.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Get disturbance color based on type
   */
  private getDisturbanceColor(type: DisturbanceType): string {
    switch (type) {
      case DisturbanceType.DOT_OCCLUSION:
        return '#ff0000';
      case DisturbanceType.DOT_DISPLACEMENT:
        return '#ff8800';
      case DisturbanceType.DOT_DIMMING:
        return '#0088ff';
      case DisturbanceType.DOT_BRIGHTENING:
        return '#ffff00';
      case DisturbanceType.PATTERN_DISTORTION:
        return '#ff00ff';
      case DisturbanceType.SHADOW_CAST:
        return '#660066';
      case DisturbanceType.INTERFERENCE:
        return '#00ff88';
      default:
        return this.config.disturbanceColor;
    }
  }

  /**
   * Adjust color intensity
   */
  private adjustColorIntensity(color: string, intensity: number): string {
    // Simple intensity adjustment - in real implementation would use proper color manipulation
    const alpha = Math.max(0, Math.min(1, intensity));
    return color.replace(')', `, ${alpha})`).replace('#', 'rgba(').replace(/(.{2})/g, '$1,').slice(0, -1) + ')';
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    this.lastRenderTime = performance.now();
    
    const animate = (currentTime: number) => {
      if (!this.isAnimating) return;

      const deltaTime = currentTime - this.lastRenderTime;
      
      if (deltaTime >= 1000 / this.frameRate) {
        this.animateElements();
        this.lastRenderTime = currentTime;
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Animate elements
   */
  private animateElements(): void {
    // Clean up expired elements
    const currentTime = Date.now();
    
    for (const [id, element] of this.elements.entries()) {
      if (element.animation) {
        const elapsed = currentTime - element.animation.startTime;
        if (elapsed >= element.animation.duration) {
          this.elements.delete(id);
        }
      }
    }

    // Emit animation frame event
    this.emit('frame-animated');
  }

  /**
   * Stop animation
   */
  stopAnimation(): void {
    this.isAnimating = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  /**
   * Update trails
   */
  private updateTrails(disturbances: GridDisturbance[]): void {
    const currentDisturbanceIds = new Set(disturbances.map(d => d.id));
    
    // Remove trails for disturbances that no longer exist
    for (const [id, trail] of this.trails.entries()) {
      if (!currentDisturbanceIds.has(trail.disturbanceId)) {
        // Keep trail for a bit longer for visual continuity
        setTimeout(() => {
          this.trails.delete(id);
        }, 1000);
      }
    }
  }

  /**
   * Update frame history
   */
  private updateFrameHistory(frame: ProcessedFrame): void {
    this.frameHistory.push(frame);
    if (this.frameHistory.length > 30) {
      this.frameHistory.shift();
    }
  }

  /**
   * Update visualization config
   */
  updateConfig(newConfig: Partial<VisualizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Visualization config updated', this.config);
  }

  /**
   * Get visualization config
   */
  getConfig(): VisualizationConfig {
    return { ...this.config };
  }

  /**
   * Take screenshot
   */
  takeScreenshot(): string {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Clear visualization
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.elements.clear();
    this.trails.clear();
    this.ghostEffects.clear();
    this.frameHistory = [];
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.setupCanvas();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopAnimation();
    this.clear();
    this.removeAllListeners();
  }
}