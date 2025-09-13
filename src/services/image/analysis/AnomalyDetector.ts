/**
 * Anomaly Detection
 * Advanced image analysis for paranormal anomalies
 */

import { ImageAnomaly, AnomalyType } from '../types';
import { logger } from '../../../utils/logger';

interface Circle {
  x: number;
  y: number;
  radius: number;
  confidence: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface Component {
  pixels: Array<{x: number; y: number}>;
  bounds: {x: number; y: number; width: number; height: number};
  area: number;
}

export class AnomalyDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sensitivity = 0.7;
  private minAnomalySize = 10;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Detect all anomalies in image
   */
  async detectAnomalies(imageData: ImageData): Promise<ImageAnomaly[]> {
    const anomalies: ImageAnomaly[] = [];
    
    // Run multiple detection algorithms
    const [
      orbs,
      figures,
      shadows,
      mists,
      lightStreaks,
      faces,
      distortions,
      energyFields
    ] = await Promise.all([
      this.detectOrbs(imageData),
      this.detectFigures(imageData),
      this.detectShadows(imageData),
      this.detectMists(imageData),
      this.detectLightStreaks(imageData),
      this.detectFaces(imageData),
      this.detectDistortions(imageData),
      this.detectEnergyFields(imageData)
    ]);
    
    anomalies.push(...orbs, ...figures, ...shadows, ...mists, 
                   ...lightStreaks, ...faces, ...distortions, ...energyFields);
    
    // Filter overlapping anomalies
    return this.filterOverlapping(anomalies);
  }

  /**
   * Detect orb anomalies
   */
  private async detectOrbs(imageData: ImageData): Promise<ImageAnomaly[]> {
    const orbs: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Convert to grayscale for analysis
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    // Apply circular Hough transform
    const circles = this.houghCircles(gray, width, height);
    
    for (const circle of circles) {
      // Analyze circle properties
      const intensity = this.measureIntensity(data, circle.x, circle.y, circle.radius, width);
      const transparency = this.measureTransparency(data, circle.x, circle.y, circle.radius, width);
      
      if (intensity > 0.6 && transparency > 0.3) {
        orbs.push({
          type: AnomalyType.ORB,
          x: circle.x - circle.radius,
          y: circle.y - circle.radius,
          width: circle.radius * 2,
          height: circle.radius * 2,
          confidence: circle.confidence,
          intensity,
          description: `Orb detected with ${Math.round(circle.confidence * 100)}% confidence`
        });
      }
    }
    
    return orbs;
  }

  /**
   * Detect figure anomalies
   */
  private async detectFigures(imageData: ImageData): Promise<ImageAnomaly[]> {
    const figures: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Edge detection for shape analysis
    const edges = this.sobelEdgeDetection(data, width, height);
    
    // Find connected components
    const components = this.findConnectedComponents(edges, width, height);
    
    for (const component of components) {
      // Check for humanoid proportions
      const aspectRatio = component.height / component.width;
      const fillRatio = component.pixelCount / (component.width * component.height);
      
      if (aspectRatio > 1.5 && aspectRatio < 3.0 && fillRatio > 0.3 && fillRatio < 0.7) {
        const confidence = this.calculateFigureConfidence(component);
        
        if (confidence > this.sensitivity) {
          figures.push({
            type: AnomalyType.FIGURE,
            x: component.minX,
            y: component.minY,
            width: component.width,
            height: component.height,
            confidence,
            intensity: fillRatio,
            description: `Humanoid figure detected with ${Math.round(confidence * 100)}% confidence`
          });
        }
      }
    }
    
    return figures;
  }

  /**
   * Detect shadow anomalies
   */
  private async detectShadows(imageData: ImageData): Promise<ImageAnomaly[]> {
    const shadows: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Analyze dark regions
    const darkRegions = this.findDarkRegions(data, width, height);
    
    for (const region of darkRegions) {
      // Check for unnatural shadow characteristics
      const gradient = this.analyzeGradient(data, region, width);
      const consistency = this.analyzeConsistency(data, region, width);
      
      if (gradient < 0.3 && consistency > 0.7) {
        const confidence = (1 - gradient) * consistency;
        
        shadows.push({
          type: AnomalyType.SHADOW,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          confidence,
          intensity: region.darkness,
          description: `Anomalous shadow detected with ${Math.round(confidence * 100)}% confidence`
        });
      }
    }
    
    return shadows;
  }

  /**
   * Detect mist anomalies
   */
  private async detectMists(imageData: ImageData): Promise<ImageAnomaly[]> {
    const mists: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Analyze texture and opacity patterns
    const regions = this.findLowContrastRegions(data, width, height);
    
    for (const region of regions) {
      // Check for mist-like properties
      const opacity = this.measureOpacity(data, region, width);
      const diffusion = this.measureDiffusion(data, region, width);
      
      if (opacity > 0.2 && opacity < 0.8 && diffusion > 0.6) {
        const confidence = opacity * diffusion;
        
        mists.push({
          type: AnomalyType.MIST,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          confidence,
          intensity: opacity,
          description: `Mist or fog anomaly detected with ${Math.round(confidence * 100)}% confidence`
        });
      }
    }
    
    return mists;
  }

  /**
   * Detect light streak anomalies
   */
  private async detectLightStreaks(imageData: ImageData): Promise<ImageAnomaly[]> {
    const streaks: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Hough line transform for streak detection
    const lines = this.houghLines(data, width, height);
    
    for (const line of lines) {
      // Analyze line properties
      const brightness = this.measureLineBrightness(data, line, width, height);
      const consistency = this.measureLineConsistency(data, line, width, height);
      
      if (brightness > 0.7 && consistency > 0.6) {
        const bbox = this.getLineBoundingBox(line, width, height);
        
        streaks.push({
          type: AnomalyType.LIGHT_STREAK,
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          confidence: line.confidence,
          intensity: brightness,
          description: `Light streak detected with ${Math.round(line.confidence * 100)}% confidence`
        });
      }
    }
    
    return streaks;
  }

  /**
   * Detect face anomalies
   */
  private async detectFaces(imageData: ImageData): Promise<ImageAnomaly[]> {
    const faces: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Simple face detection using pattern matching
    const patterns = this.detectFacePatterns(data, width, height);
    
    for (const pattern of patterns) {
      // Verify face-like features
      const hasEyes = this.detectEyePattern(data, pattern, width);
      const symmetry = this.measureSymmetry(data, pattern, width);
      
      if (hasEyes && symmetry > 0.6) {
        const confidence = pattern.confidence * symmetry;
        
        faces.push({
          type: AnomalyType.FACE,
          x: pattern.x,
          y: pattern.y,
          width: pattern.width,
          height: pattern.height,
          confidence,
          intensity: pattern.clarity,
          description: `Face pattern detected with ${Math.round(confidence * 100)}% confidence`
        });
      }
    }
    
    return faces;
  }

  /**
   * Detect distortion anomalies
   */
  private async detectDistortions(imageData: ImageData): Promise<ImageAnomaly[]> {
    const distortions: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Analyze spatial frequency distortions
    const distortedRegions = this.findDistortedRegions(data, width, height);
    
    for (const region of distortedRegions) {
      const confidence = region.distortionLevel * this.sensitivity;
      
      if (confidence > 0.5) {
        distortions.push({
          type: AnomalyType.DISTORTION,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          confidence,
          intensity: region.distortionLevel,
          description: `Spatial distortion detected with ${Math.round(confidence * 100)}% confidence`
        });
      }
    }
    
    return distortions;
  }

  /**
   * Detect energy field anomalies
   */
  private async detectEnergyFields(imageData: ImageData): Promise<ImageAnomaly[]> {
    const fields: ImageAnomaly[] = [];
    const { data, width, height } = imageData;
    
    // Analyze electromagnetic-like patterns
    const fieldRegions = this.findEnergyPatterns(data, width, height);
    
    for (const region of fieldRegions) {
      // Check for field characteristics
      const coherence = this.measureFieldCoherence(data, region, width);
      const intensity = this.measureFieldIntensity(data, region, width);
      
      if (coherence > 0.5 && intensity > 0.4) {
        const confidence = coherence * intensity;
        
        fields.push({
          type: AnomalyType.ENERGY_FIELD,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          confidence,
          intensity,
          description: `Energy field pattern detected with ${Math.round(confidence * 100)}% confidence`
        });
      }
    }
    
    return fields;
  }

  /**
   * Hough circle transform
   */
  private houghCircles(gray: Uint8ClampedArray, width: number, height: number): Circle[] {
    const circles: Circle[] = [];
    const minRadius = 5;
    const maxRadius = Math.min(width, height) / 4;
    
    // Simplified Hough circle detection
    for (let r = minRadius; r <= maxRadius; r += 5) {
      const accumulator = new Map<string, number>();
      
      // Edge pixels vote for circle centers
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (gray[idx] > 128) { // Edge pixel
            // Vote for possible centers
            for (let theta = 0; theta < 360; theta += 10) {
              const cx = Math.round(x + r * Math.cos(theta * Math.PI / 180));
              const cy = Math.round(y + r * Math.sin(theta * Math.PI / 180));
              
              if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                const key = `${cx},${cy}`;
                accumulator.set(key, (accumulator.get(key) || 0) + 1);
              }
            }
          }
        }
      }
      
      // Find peaks in accumulator
      for (const [key, votes] of accumulator.entries()) {
        if (votes > 20) { // Threshold
          const [x, y] = key.split(',').map(Number);
          circles.push({
            x, y, radius: r,
            confidence: Math.min(votes / 100, 1)
          });
        }
      }
    }
    
    return circles;
  }

  /**
   * Sobel edge detection
   */
  private sobelEdgeDetection(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const edges = new Uint8ClampedArray(width * height);
    
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            
            gx += gray * sobelX[kernelIdx];
            gy += gray * sobelY[kernelIdx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = Math.min(magnitude, 255);
      }
    }
    
    return edges;
  }

  /**
   * Find connected components
   */
  private findConnectedComponents(edges: Uint8ClampedArray, width: number, height: number): Component[] {
    const visited = new Uint8Array(width * height);
    const components: Component[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (edges[idx] > 50 && !visited[idx]) {
          const component = this.floodFill(edges, visited, x, y, width, height);
          
          if (component.pixelCount > this.minAnomalySize) {
            components.push(component);
          }
        }
      }
    }
    
    return components;
  }

  /**
   * Flood fill algorithm
   */
  private floodFill(
    edges: Uint8ClampedArray,
    visited: Uint8Array,
    startX: number,
    startY: number,
    width: number,
    height: number
  ): any {
    const stack = [[startX, startY]];
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    let pixelCount = 0;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx] || edges[idx] < 50) continue;
      
      visited[idx] = 1;
      pixelCount++;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Add neighbors
      if (x > 0) stack.push([x - 1, y]);
      if (x < width - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < height - 1) stack.push([x, y + 1]);
    }
    
    return {
      minX, minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      pixelCount
    };
  }

  /**
   * Hough line transform
   */
  private houghLines(data: Uint8ClampedArray, width: number, height: number): Line[] {
    const lines: Line[] = [];
    const edges = this.sobelEdgeDetection(data, width, height);
    
    const rhoMax = Math.sqrt(width * width + height * height);
    const accumulator = new Map<string, number>();
    
    // Vote for lines
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] > 50) {
          for (let theta = 0; theta < 180; theta += 2) {
            const rho = x * Math.cos(theta * Math.PI / 180) + y * Math.sin(theta * Math.PI / 180);
            const key = `${Math.round(rho)},${theta}`;
            accumulator.set(key, (accumulator.get(key) || 0) + 1);
          }
        }
      }
    }
    
    // Find peaks
    for (const [key, votes] of accumulator.entries()) {
      if (votes > 50) {
        const [rho, theta] = key.split(',').map(Number);
        lines.push({
          rho, theta,
          confidence: Math.min(votes / 200, 1)
        });
      }
    }
    
    return lines;
  }

  /**
   * Helper methods for anomaly analysis
   */
  
  private measureIntensity(data: Uint8ClampedArray, cx: number, cy: number, radius: number, width: number): number {
    let sum = 0;
    let count = 0;
    
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x >= 0 && x < width && y >= 0 && y < data.length / (width * 4)) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= radius) {
            const idx = (y * width + x) * 4;
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            sum += brightness;
            count++;
          }
        }
      }
    }
    
    return count > 0 ? sum / (count * 255) : 0;
  }

  private measureTransparency(data: Uint8ClampedArray, cx: number, cy: number, radius: number, width: number): number {
    // Simplified transparency measurement
    const centerIdx = (cy * width + cx) * 4;
    const centerAlpha = data[centerIdx + 3] / 255;
    return 1 - centerAlpha;
  }

  private calculateFigureConfidence(component: any): number {
    // Simplified confidence calculation
    const sizeScore = Math.min(component.pixelCount / 1000, 1);
    const shapeScore = 1 - Math.abs(component.height / component.width - 2) / 2;
    return (sizeScore + shapeScore) / 2;
  }

  private findDarkRegions(data: Uint8ClampedArray, width: number, height: number): Region[] {
    const regions: Region[] = [];
    const threshold = 50;
    
    // Simplified dark region detection
    for (let y = 0; y < height - 20; y += 10) {
      for (let x = 0; x < width - 20; x += 10) {
        let darkness = 0;
        
        for (let dy = 0; dy < 20; dy++) {
          for (let dx = 0; dx < 20; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            if (brightness < threshold) darkness++;
          }
        }
        
        if (darkness > 300) {
          regions.push({
            x, y, width: 20, height: 20,
            darkness: darkness / 400
          });
        }
      }
    }
    
    return regions;
  }

  private analyzeGradient(data: Uint8ClampedArray, region: any, width: number): number {
    // Simplified gradient analysis
    return Math.random() * 0.5; // Placeholder
  }

  private analyzeConsistency(data: Uint8ClampedArray, region: any, width: number): number {
    // Simplified consistency analysis
    return 0.5 + Math.random() * 0.5; // Placeholder
  }

  private findLowContrastRegions(data: Uint8ClampedArray, width: number, height: number): Region[] {
    // Simplified low contrast region detection
    return [];
  }

  private measureOpacity(data: Uint8ClampedArray, region: any, width: number): number {
    return Math.random(); // Placeholder
  }

  private measureDiffusion(data: Uint8ClampedArray, region: any, width: number): number {
    return Math.random(); // Placeholder
  }

  private measureLineBrightness(data: Uint8ClampedArray, line: any, width: number, height: number): number {
    return 0.5 + Math.random() * 0.5; // Placeholder
  }

  private measureLineConsistency(data: Uint8ClampedArray, line: any, width: number, height: number): number {
    return 0.5 + Math.random() * 0.5; // Placeholder
  }

  private getLineBoundingBox(line: any, width: number, height: number): any {
    // Calculate bounding box for line
    return { x: 0, y: 0, width: 100, height: 10 }; // Placeholder
  }

  private detectFacePatterns(data: Uint8ClampedArray, width: number, height: number): Region[] {
    // Simplified face pattern detection
    return [];
  }

  private detectEyePattern(data: Uint8ClampedArray, pattern: any, width: number): boolean {
    return Math.random() > 0.5; // Placeholder
  }

  private measureSymmetry(data: Uint8ClampedArray, pattern: any, width: number): number {
    return Math.random(); // Placeholder
  }

  private findDistortedRegions(data: Uint8ClampedArray, width: number, height: number): Region[] {
    // Simplified distortion detection
    return [];
  }

  private findEnergyPatterns(data: Uint8ClampedArray, width: number, height: number): Region[] {
    // Simplified energy pattern detection
    return [];
  }

  private measureFieldCoherence(data: Uint8ClampedArray, region: any, width: number): number {
    return Math.random(); // Placeholder
  }

  private measureFieldIntensity(data: Uint8ClampedArray, region: any, width: number): number {
    return Math.random(); // Placeholder
  }

  /**
   * Filter overlapping anomalies
   */
  private filterOverlapping(anomalies: ImageAnomaly[]): ImageAnomaly[] {
    const filtered: ImageAnomaly[] = [];
    
    for (const anomaly of anomalies) {
      let overlaps = false;
      
      for (const existing of filtered) {
        if (this.checkOverlap(anomaly, existing)) {
          // Keep the one with higher confidence
          if (anomaly.confidence > existing.confidence) {
            const index = filtered.indexOf(existing);
            filtered[index] = anomaly;
          }
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        filtered.push(anomaly);
      }
    }
    
    return filtered;
  }

  /**
   * Check if two anomalies overlap
   */
  private checkOverlap(a1: ImageAnomaly, a2: ImageAnomaly): boolean {
    return !(a1.x + a1.width < a2.x || 
             a2.x + a2.width < a1.x || 
             a1.y + a1.height < a2.y || 
             a2.y + a2.height < a1.y);
  }

  /**
   * Set detection sensitivity
   */
  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  /**
   * Enhance anomaly visibility
   */
  enhanceAnomaly(imageData: ImageData, anomaly: ImageAnomaly): ImageData {
    const enhanced = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
    
    const { x, y, width, height } = anomaly;
    
    // Apply enhancement based on anomaly type
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = x + dx;
        const py = y + dy;
        
        if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
          const idx = (py * imageData.width + px) * 4;
          
          switch (anomaly.type) {
            case AnomalyType.ORB:
              // Enhance brightness and add glow
              enhanced.data[idx] = Math.min(255, enhanced.data[idx] * 1.5);
              enhanced.data[idx + 1] = Math.min(255, enhanced.data[idx + 1] * 1.5);
              enhanced.data[idx + 2] = Math.min(255, enhanced.data[idx + 2] * 1.3);
              break;
              
            case AnomalyType.FIGURE: {
              // Increase contrast
              const avg = (enhanced.data[idx] + enhanced.data[idx + 1] + enhanced.data[idx + 2]) / 3;
              const factor = avg > 128 ? 1.3 : 0.7;
              enhanced.data[idx] *= factor;
              enhanced.data[idx + 1] *= factor;
              enhanced.data[idx + 2] *= factor;
              break;
            }
              
            case AnomalyType.MIST:
              // Add ethereal blue tint
              enhanced.data[idx + 2] = Math.min(255, enhanced.data[idx + 2] * 1.2);
              break;
              
            case AnomalyType.ENERGY_FIELD:
              // Add purple/violet tint
              enhanced.data[idx] = Math.min(255, enhanced.data[idx] * 1.2);
              enhanced.data[idx + 2] = Math.min(255, enhanced.data[idx + 2] * 1.3);
              break;
          }
        }
      }
    }
    
    return enhanced;
  }

  /**
   * Generate anomaly heatmap
   */
  generateHeatmap(imageData: ImageData, anomalies: ImageAnomaly[]): ImageData {
    const heatmap = new ImageData(imageData.width, imageData.height);
    const { data, width, height } = heatmap;
    
    // Create intensity map
    const intensity = new Float32Array(width * height);
    
    for (const anomaly of anomalies) {
      const cx = anomaly.x + anomaly.width / 2;
      const cy = anomaly.y + anomaly.height / 2;
      const radius = Math.max(anomaly.width, anomaly.height) / 2;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          
          if (dist <= radius * 2) {
            const falloff = 1 - (dist / (radius * 2));
            intensity[y * width + x] += anomaly.confidence * falloff;
          }
        }
      }
    }
    
    // Normalize and colorize
    const maxIntensity = Math.max(...intensity);
    
    for (let i = 0; i < intensity.length; i++) {
      const normalized = intensity[i] / maxIntensity;
      const idx = i * 4;
      
      // Heat map colors (blue -> green -> yellow -> red)
      if (normalized < 0.25) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = normalized * 4 * 255;
      } else if (normalized < 0.5) {
        data[idx] = 0;
        data[idx + 1] = (normalized - 0.25) * 4 * 255;
        data[idx + 2] = 255 - (normalized - 0.25) * 4 * 255;
      } else if (normalized < 0.75) {
        data[idx] = (normalized - 0.5) * 4 * 255;
        data[idx + 1] = 255;
        data[idx + 2] = 0;
      } else {
        data[idx] = 255;
        data[idx + 1] = 255 - (normalized - 0.75) * 4 * 255;
        data[idx + 2] = 0;
      }
      
      data[idx + 3] = normalized * 255;
    }
    
    return heatmap;
  }
}