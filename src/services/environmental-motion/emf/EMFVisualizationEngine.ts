import { EventEmitter } from 'events';
import {
  EMFReading,
  EMFFrequencyBand,
  EMFVisualizationSettings,
  EMFVisualizationFrame,
  EMFFieldData,
  EnvironmentalSensor
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('EMFVisualizationEngine');

export class EMFVisualizationEngine extends EventEmitter {
  private settings: EMFVisualizationSettings;
  private fieldData: Map<EMFFrequencyBand, number[][]> = new Map();
  private readingHistory: EMFReading[] = [];
  private activeCanvas: HTMLCanvasElement | null = null;
  private animationFrame: number | null = null;
  private lastUpdateTime = 0;
  private fieldSources: EMFSource[] = [];
  private isRecording = false;

  constructor(settings: EMFVisualizationSettings) {
    super();
    this.settings = { ...settings };
    this.initializeVisualization();
  }

  private initializeVisualization(): void {
    logger.info('Initializing EMF visualization engine');
    
    // Initialize field data grids for each frequency band
    Object.values(EMFFrequencyBand).forEach(band => {
      this.fieldData.set(band, this.createEmptyFieldGrid());
    });

    this.setupUpdateTimer();
  }

  private createEmptyFieldGrid(width = 100, height = 100): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = new Array(width).fill(0);
    }
    return grid;
  }

  private setupUpdateTimer(): void {
    const updateInterval = 1000 / this.settings.updateRate; // Convert Hz to ms
    
    const update = () => {
      const now = Date.now();
      if (now - this.lastUpdateTime >= updateInterval) {
        this.updateVisualization();
        this.lastUpdateTime = now;
      }
      this.animationFrame = requestAnimationFrame(update);
    };
    
    this.animationFrame = requestAnimationFrame(update);
  }

  addEMFReading(reading: EMFReading): void {
    // Add reading to history
    this.readingHistory.push(reading);
    
    // Maintain history size
    if (this.readingHistory.length > 1000) {
      this.readingHistory.shift();
    }

    // Update field data if coordinates are provided
    if (reading.coordinates) {
      this.updateFieldData(reading);
    }

    // Detect field sources
    this.detectFieldSources(reading);

    this.emit('emf-reading-added', reading);
  }

  private updateFieldData(reading: EMFReading): void {
    const fieldGrid = this.fieldData.get(reading.frequencyBand);
    if (!fieldGrid) return;

    const { x, y } = this.worldToGridCoordinates(reading.coordinates!);
    
    if (x >= 0 && x < fieldGrid[0].length && y >= 0 && y < fieldGrid.length) {
      // Apply spatial interpolation for smooth field representation
      this.interpolateFieldValue(fieldGrid, x, y, reading.intensity);
    }
  }

  private worldToGridCoordinates(worldCoords: { x: number; y: number; z: number }): { x: number; y: number } {
    // Convert world coordinates to grid coordinates
    // This would depend on the actual coordinate system and visualization area
    const gridWidth = this.fieldData.get(EMFFrequencyBand.ELF)?.[0]?.length || 100;
    const gridHeight = this.fieldData.get(EMFFrequencyBand.ELF)?.length || 100;
    
    // Assuming a 10x10 meter visualization area centered at origin
    const visualizationSize = 10; // meters
    const gridX = Math.floor((worldCoords.x + visualizationSize / 2) / visualizationSize * gridWidth);
    const gridY = Math.floor((worldCoords.y + visualizationSize / 2) / visualizationSize * gridHeight);
    
    return { x: gridX, y: gridY };
  }

  private interpolateFieldValue(grid: number[][], centerX: number, centerY: number, intensity: number): void {
    const radius = 3; // Interpolation radius
    const falloffFactor = 2.0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        
        if (x >= 0 && x < grid[0].length && y >= 0 && y < grid.length) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const weight = Math.exp(-distance / falloffFactor);
            grid[y][x] = Math.max(grid[y][x], intensity * weight);
          }
        }
      }
    }
  }

  private detectFieldSources(reading: EMFReading): void {
    if (!reading.coordinates || reading.intensity < this.settings.threshold) {
      return;
    }

    // Find if this reading is near an existing source
    const nearbySource = this.fieldSources.find(source => {
      if (source.frequencyBand === reading.frequencyBand) {
        const distance = this.calculateDistance3D(source.position, reading.coordinates!);
        return distance < 2.0; // 2 meters
      }
      return false;
    });

    if (nearbySource) {
      // Update existing source
      nearbySource.intensity = Math.max(nearbySource.intensity, reading.intensity);
      nearbySource.lastDetected = reading.timestamp;
      nearbySource.confidence = Math.min(1.0, nearbySource.confidence + 0.1);
    } else if (reading.intensity > this.settings.threshold * 2) {
      // Create new source for significant readings
      const newSource: EMFSource = {
        id: `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        position: { ...reading.coordinates },
        frequencyBand: reading.frequencyBand,
        intensity: reading.intensity,
        frequency: reading.frequency,
        fieldType: reading.fieldType,
        confidence: 0.5,
        firstDetected: reading.timestamp,
        lastDetected: reading.timestamp,
        classification: reading.source || 'unknown'
      };
      
      this.fieldSources.push(newSource);
      this.emit('emf-source-detected', newSource);
    }

    // Clean up old sources
    this.cleanupOldSources();
  }

  private calculateDistance3D(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2) + 
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  private cleanupOldSources(): void {
    const maxAge = 30000; // 30 seconds
    const currentTime = Date.now();
    
    this.fieldSources = this.fieldSources.filter(source => {
      const age = currentTime - source.lastDetected;
      return age < maxAge;
    });
  }

  private updateVisualization(): void {
    if (!this.activeCanvas) return;

    try {
      const visualizationFrame = this.generateVisualizationFrame();
      this.renderVisualizationFrame(visualizationFrame);
      this.emit('visualization-updated', visualizationFrame);
    } catch (error) {
      logger.error('Error updating EMF visualization:', error);
      this.emit('error', { error, context: 'visualization update' });
    }
  }

  private generateVisualizationFrame(): EMFVisualizationFrame {
    const timestamp = Date.now();
    const fieldData = this.getCurrentFieldData();
    
    const frame: EMFVisualizationFrame = {
      timestamp,
      fieldData,
      annotations: {
        sources: this.fieldSources.map(source => ({
          x: source.position.x,
          y: source.position.y,
          intensity: source.intensity,
          label: `${source.frequencyBand.toUpperCase()}: ${source.intensity.toFixed(2)} ${fieldData.units}`
        })),
        anomalies: this.detectAnomalies()
      }
    };

    // Generate additional visualization data based on settings
    if (this.settings.heatmap) {
      frame.heatmapData = this.generateHeatmapData();
    }

    if (this.settings.vectorField) {
      frame.vectorField = this.generateVectorField();
    }

    if (this.settings.fieldLines) {
      frame.fieldLines = this.generateFieldLines();
    }

    return frame;
  }

  private getCurrentFieldData(): EMFFieldData {
    const gridSize = this.fieldData.get(EMFFrequencyBand.ELF)?.[0]?.length || 100;
    
    return {
      width: gridSize,
      height: gridSize,
      resolution: 0.1, // 10cm per grid cell
      readings: Object.fromEntries(
        Array.from(this.fieldData.entries()).map(([band, data]) => [band, data])
      ) as any,
      timestamp: Date.now(),
      units: 'tesla'
    };
  }

  private generateHeatmapData(): number[][] {
    // Combine all frequency bands for heatmap
    const gridHeight = this.fieldData.get(EMFFrequencyBand.ELF)?.length || 100;
    const gridWidth = this.fieldData.get(EMFFrequencyBand.ELF)?.[0]?.length || 100;
    
    const heatmap: number[][] = [];
    
    for (let y = 0; y < gridHeight; y++) {
      heatmap[y] = [];
      for (let x = 0; x < gridWidth; x++) {
        let totalIntensity = 0;
        let count = 0;
        
        // Combine intensities from all bands
        for (const [band, data] of this.fieldData) {
          if (data[y] && data[y][x] !== undefined) {
            totalIntensity += data[y][x];
            count++;
          }
        }
        
        heatmap[y][x] = count > 0 ? totalIntensity / count : 0;
      }
    }
    
    // Apply smoothing if averaging is enabled
    if (this.settings.averaging.enabled) {
      return this.applyTemporalAveraging(heatmap);
    }
    
    return heatmap;
  }

  private applyTemporalAveraging(currentHeatmap: number[][]): number[][] {
    // This would maintain a history of heatmaps and average them
    // For now, return current heatmap
    return currentHeatmap;
  }

  private generateVectorField(): { x: number; y: number; magnitude: number }[][] {
    const gridHeight = this.fieldData.get(EMFFrequencyBand.ELF)?.length || 100;
    const gridWidth = this.fieldData.get(EMFFrequencyBand.ELF)?.[0]?.length || 100;
    
    const vectorField: { x: number; y: number; magnitude: number }[][] = [];
    
    for (let y = 1; y < gridHeight - 1; y++) {
      vectorField[y] = [];
      for (let x = 1; x < gridWidth - 1; x++) {
        // Calculate gradient (simplified electromagnetic field direction)
        const gradientX = this.calculateGradient(x, y, 'x');
        const gradientY = this.calculateGradient(x, y, 'y');
        
        const magnitude = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
        
        vectorField[y][x] = {
          x: gradientX,
          y: gradientY,
          magnitude
        };
      }
    }
    
    return vectorField;
  }

  private calculateGradient(x: number, y: number, direction: 'x' | 'y'): number {
    // Calculate field gradient for vector field visualization
    let totalGradient = 0;
    let count = 0;
    
    for (const [band, data] of this.fieldData) {
      if (data[y] && data[y][x] !== undefined) {
        let gradient = 0;
        
        if (direction === 'x') {
          gradient = (data[y][x + 1] || 0) - (data[y][x - 1] || 0);
        } else {
          gradient = (data[y + 1]?.[x] || 0) - (data[y - 1]?.[x] || 0);
        }
        
        totalGradient += gradient;
        count++;
      }
    }
    
    return count > 0 ? totalGradient / count : 0;
  }

  private generateFieldLines(): { points: { x: number; y: number }[] }[] {
    const fieldLines: { points: { x: number; y: number }[] }[] = [];
    
    // Generate field lines starting from significant sources
    for (const source of this.fieldSources) {
      if (source.intensity > this.settings.threshold * 3) {
        const lines = this.traceFieldLinesFromSource(source);
        fieldLines.push(...lines);
      }
    }
    
    return fieldLines;
  }

  private traceFieldLinesFromSource(source: EMFSource): { points: { x: number; y: number }[] }[] {
    const lines: { points: { x: number; y: number }[] }[] = [];
    const startGridPos = this.worldToGridCoordinates(source.position);
    
    // Generate multiple field lines in different directions
    const numLines = 8;
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * 2 * Math.PI;
      const line = this.traceFieldLine(startGridPos.x, startGridPos.y, angle, source.frequencyBand);
      if (line.length > 5) { // Only include substantial field lines
        lines.push({ points: line });
      }
    }
    
    return lines;
  }

  private traceFieldLine(startX: number, startY: number, initialAngle: number, band: EMFFrequencyBand): { x: number; y: number }[] {
    const line: { x: number; y: number }[] = [];
    const fieldData = this.fieldData.get(band);
    if (!fieldData) return line;
    
    let currentX = startX;
    let currentY = startY;
    let currentAngle = initialAngle;
    const stepSize = 0.5;
    const maxSteps = 100;
    
    for (let step = 0; step < maxSteps; step++) {
      // Convert grid coordinates back to world coordinates for the line points
      const worldCoords = this.gridToWorldCoordinates(Math.round(currentX), Math.round(currentY));
      line.push(worldCoords);
      
      // Calculate next position based on field gradient
      const gradientX = this.calculateGradient(Math.round(currentX), Math.round(currentY), 'x');
      const gradientY = this.calculateGradient(Math.round(currentX), Math.round(currentY), 'y');
      
      if (Math.abs(gradientX) < 0.01 && Math.abs(gradientY) < 0.01) {
        break; // Field too weak
      }
      
      currentAngle = Math.atan2(gradientY, gradientX);
      currentX += Math.cos(currentAngle) * stepSize;
      currentY += Math.sin(currentAngle) * stepSize;
      
      // Check bounds
      if (currentX < 0 || currentX >= fieldData[0].length ||
          currentY < 0 || currentY >= fieldData.length) {
        break;
      }
    }
    
    return line;
  }

  private gridToWorldCoordinates(gridX: number, gridY: number): { x: number; y: number } {
    const visualizationSize = 10; // meters
    const gridWidth = this.fieldData.get(EMFFrequencyBand.ELF)?.[0]?.length || 100;
    const gridHeight = this.fieldData.get(EMFFrequencyBand.ELF)?.length || 100;
    
    const worldX = (gridX / gridWidth) * visualizationSize - visualizationSize / 2;
    const worldY = (gridY / gridHeight) * visualizationSize - visualizationSize / 2;
    
    return { x: worldX, y: worldY };
  }

  private detectAnomalies(): { x: number; y: number; type: string; severity: number }[] {
    const anomalies: { x: number; y: number; type: string; severity: number }[] = [];
    
    // Detect intensity anomalies
    const recentReadings = this.readingHistory.slice(-50); // Last 50 readings
    const averageIntensity = recentReadings.reduce((sum, r) => sum + r.intensity, 0) / recentReadings.length;
    const threshold = averageIntensity * 3; // 3x average is anomalous
    
    for (const reading of recentReadings) {
      if (reading.intensity > threshold && reading.coordinates) {
        const worldCoords = reading.coordinates;
        anomalies.push({
          x: worldCoords.x,
          y: worldCoords.y,
          type: 'high_intensity',
          severity: Math.min(1.0, reading.intensity / threshold - 1)
        });
      }
    }
    
    // Detect frequency anomalies
    this.detectFrequencyAnomalies(anomalies);
    
    // Detect spatial anomalies
    this.detectSpatialAnomalies(anomalies);
    
    return anomalies;
  }

  private detectFrequencyAnomalies(anomalies: { x: number; y: number; type: string; severity: number }[]): void {
    // Group readings by frequency band and detect unusual patterns
    const bandReadings = new Map<EMFFrequencyBand, EMFReading[]>();
    
    for (const reading of this.readingHistory.slice(-100)) {
      if (!bandReadings.has(reading.frequencyBand)) {
        bandReadings.set(reading.frequencyBand, []);
      }
      bandReadings.get(reading.frequencyBand)!.push(reading);
    }
    
    for (const [band, readings] of bandReadings) {
      if (readings.length > 5) {
        const avgIntensity = readings.reduce((sum, r) => sum + r.intensity, 0) / readings.length;
        const recentIntensity = readings.slice(-5).reduce((sum, r) => sum + r.intensity, 0) / 5;
        
        if (recentIntensity > avgIntensity * 2) {
          // Recent surge in this frequency band
          const latestReading = readings[readings.length - 1];
          if (latestReading.coordinates) {
            anomalies.push({
              x: latestReading.coordinates.x,
              y: latestReading.coordinates.y,
              type: `frequency_surge_${band}`,
              severity: recentIntensity / avgIntensity - 1
            });
          }
        }
      }
    }
  }

  private detectSpatialAnomalies(anomalies: { x: number; y: number; type: string; severity: number }[]): void {
    // Detect unusual spatial patterns in the field data
    for (const [band, fieldData] of this.fieldData) {
      const gridHeight = fieldData.length;
      const gridWidth = fieldData[0]?.length || 0;
      
      // Look for isolated high-intensity regions
      for (let y = 1; y < gridHeight - 1; y++) {
        for (let x = 1; x < gridWidth - 1; x++) {
          const centerValue = fieldData[y][x];
          if (centerValue > this.settings.threshold * 2) {
            // Check if this is isolated (neighbors are much weaker)
            const neighbors = [
              fieldData[y-1][x-1], fieldData[y-1][x], fieldData[y-1][x+1],
              fieldData[y][x-1], fieldData[y][x+1],
              fieldData[y+1][x-1], fieldData[y+1][x], fieldData[y+1][x+1]
            ];
            
            const avgNeighbor = neighbors.reduce((sum, val) => sum + val, 0) / neighbors.length;
            
            if (centerValue > avgNeighbor * 5) {
              // Isolated high intensity point
              const worldCoords = this.gridToWorldCoordinates(x, y);
              anomalies.push({
                x: worldCoords.x,
                y: worldCoords.y,
                type: 'isolated_source',
                severity: centerValue / avgNeighbor / 5
              });
            }
          }
        }
      }
    }
  }

  private renderVisualizationFrame(frame: EMFVisualizationFrame): void {
    if (!this.activeCanvas) return;

    const ctx = this.activeCanvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
    
    // Render heatmap if enabled
    if (this.settings.heatmap && frame.heatmapData) {
      this.renderHeatmap(ctx, frame.heatmapData);
    }
    
    // Render vector field if enabled
    if (this.settings.vectorField && frame.vectorField) {
      this.renderVectorField(ctx, frame.vectorField);
    }
    
    // Render field lines if enabled
    if (this.settings.fieldLines && frame.fieldLines) {
      this.renderFieldLines(ctx, frame.fieldLines);
    }
    
    // Render sources and anomalies
    this.renderAnnotations(ctx, frame.annotations);
  }

  private renderHeatmap(ctx: CanvasRenderingContext2D, heatmapData: number[][]): void {
    const canvas = ctx.canvas;
    const cellWidth = canvas.width / heatmapData[0].length;
    const cellHeight = canvas.height / heatmapData.length;
    
    // Find max value for normalization
    const maxValue = Math.max(...heatmapData.flat());
    if (maxValue === 0) return;
    
    for (let y = 0; y < heatmapData.length; y++) {
      for (let x = 0; x < heatmapData[y].length; x++) {
        const intensity = heatmapData[y][x] / maxValue;
        if (intensity > 0.01) { // Only render visible intensities
          const color = this.intensityToColor(intensity);
          ctx.fillStyle = color;
          ctx.globalAlpha = intensity * 0.7 + 0.1; // Semi-transparent
          ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }
      }
    }
    
    ctx.globalAlpha = 1.0;
  }

  private intensityToColor(intensity: number): string {
    // Convert intensity to heat map color (blue -> green -> yellow -> red)
    if (intensity < 0.25) {
      // Blue to cyan
      const t = intensity * 4;
      return `rgb(0, ${Math.floor(t * 255)}, 255)`;
    } else if (intensity < 0.5) {
      // Cyan to green
      const t = (intensity - 0.25) * 4;
      return `rgb(0, 255, ${Math.floor((1 - t) * 255)})`;
    } else if (intensity < 0.75) {
      // Green to yellow
      const t = (intensity - 0.5) * 4;
      return `rgb(${Math.floor(t * 255)}, 255, 0)`;
    } else {
      // Yellow to red
      const t = (intensity - 0.75) * 4;
      return `rgb(255, ${Math.floor((1 - t) * 255)}, 0)`;
    }
  }

  private renderVectorField(ctx: CanvasRenderingContext2D, vectorField: { x: number; y: number; magnitude: number }[][]): void {
    const canvas = ctx.canvas;
    const cellWidth = canvas.width / vectorField[0].length;
    const cellHeight = canvas.height / vectorField.length;
    const scale = 20; // Scale factor for vector display
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    
    for (let y = 0; y < vectorField.length; y += 2) { // Skip every other cell for clarity
      for (let x = 0; x < vectorField[y].length; x += 2) {
        const vector = vectorField[y][x];
        if (vector && vector.magnitude > 0.1) {
          const centerX = x * cellWidth + cellWidth / 2;
          const centerY = y * cellHeight + cellHeight / 2;
          const endX = centerX + vector.x * scale;
          const endY = centerY + vector.y * scale;
          
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Arrow head
          const angle = Math.atan2(vector.y, vector.x);
          const headLength = 5;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), 
                    endY - headLength * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), 
                    endY - headLength * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
      }
    }
  }

  private renderFieldLines(ctx: CanvasRenderingContext2D, fieldLines: { points: { x: number; y: number }[] }[]): void {
    const canvas = ctx.canvas;
    const visualizationSize = 10; // meters
    
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    
    for (const line of fieldLines) {
      if (line.points.length < 2) continue;
      
      ctx.beginPath();
      const firstPoint = line.points[0];
      const canvasX = ((firstPoint.x + visualizationSize / 2) / visualizationSize) * canvas.width;
      const canvasY = ((firstPoint.y + visualizationSize / 2) / visualizationSize) * canvas.height;
      ctx.moveTo(canvasX, canvasY);
      
      for (let i = 1; i < line.points.length; i++) {
        const point = line.points[i];
        const x = ((point.x + visualizationSize / 2) / visualizationSize) * canvas.width;
        const y = ((point.y + visualizationSize / 2) / visualizationSize) * canvas.height;
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1.0;
  }

  private renderAnnotations(ctx: CanvasRenderingContext2D, annotations: EMFVisualizationFrame['annotations']): void {
    const canvas = ctx.canvas;
    const visualizationSize = 10; // meters
    
    // Render sources
    for (const source of annotations.sources) {
      const canvasX = ((source.x + visualizationSize / 2) / visualizationSize) * canvas.width;
      const canvasY = ((source.y + visualizationSize / 2) / visualizationSize) * canvas.height;
      
      // Draw source marker
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw label
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(source.label, canvasX + 8, canvasY - 8);
    }
    
    // Render anomalies
    for (const anomaly of annotations.anomalies) {
      const canvasX = ((anomaly.x + visualizationSize / 2) / visualizationSize) * canvas.width;
      const canvasY = ((anomaly.y + visualizationSize / 2) / visualizationSize) * canvas.height;
      
      // Draw anomaly marker
      const intensity = Math.min(1.0, anomaly.severity);
      ctx.fillStyle = `rgba(255, 165, 0, ${intensity})`;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw warning symbol
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvasX, canvasY - 4);
      ctx.lineTo(canvasX, canvasY + 1);
      ctx.moveTo(canvasX, canvasY + 3);
      ctx.lineTo(canvasX, canvasY + 4);
      ctx.stroke();
    }
  }

  setCanvas(canvas: HTMLCanvasElement): void {
    this.activeCanvas = canvas;
    this.emit('canvas-set', canvas);
  }

  updateSettings(newSettings: Partial<EMFVisualizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // Apply color mapping changes
    if (newSettings.colorMapping) {
      this.emit('color-mapping-changed', newSettings.colorMapping);
    }
    
    // Restart timer if update rate changed
    if (newSettings.updateRate) {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
      }
      this.setupUpdateTimer();
    }
    
    this.emit('settings-updated', this.settings);
  }

  getSettings(): EMFVisualizationSettings {
    return { ...this.settings };
  }

  getFieldSources(): EMFSource[] {
    return [...this.fieldSources];
  }

  getRecentReadings(count = 50): EMFReading[] {
    return this.readingHistory.slice(-count);
  }

  clearFieldData(): void {
    // Reset all field data
    Object.values(EMFFrequencyBand).forEach(band => {
      this.fieldData.set(band, this.createEmptyFieldGrid());
    });
    
    this.fieldSources = [];
    this.readingHistory = [];
    
    this.emit('field-data-cleared');
  }

  startRecording(): void {
    this.isRecording = true;
    this.emit('recording-started');
  }

  stopRecording(): void {
    this.isRecording = false;
    this.emit('recording-stopped');
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.clearFieldData();
    this.activeCanvas = null;
    this.removeAllListeners();
  }
}

interface EMFSource {
  id: string;
  position: { x: number; y: number; z: number };
  frequencyBand: EMFFrequencyBand;
  intensity: number;
  frequency: number;
  fieldType: 'magnetic' | 'electric' | 'combined';
  confidence: number;
  firstDetected: number;
  lastDetected: number;
  classification: string;
}