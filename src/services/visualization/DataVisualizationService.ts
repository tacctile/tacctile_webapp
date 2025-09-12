export interface DataPoint {
  id: string;
  x: number;
  y: number;
  value: number;
  timestamp: Date;
  type: 'emf' | 'temperature' | 'audio' | 'motion' | 'custom';
  metadata?: Record<string, any>;
  investigatorId?: string;
  roomId?: string;
}

export interface HeatMapOptions {
  radius: number;
  maxOpacity: number;
  minOpacity: number;
  blur: number;
  gradient: Record<number, string>;
  colorScale: 'viridis' | 'plasma' | 'inferno' | 'turbo' | 'custom';
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface RoomActivity {
  roomId: string;
  roomName: string;
  bounds: { x: number; y: number; width: number; height: number };
  activityLevel: number; // 0-1 scale
  dataPoints: DataPoint[];
  averageValue: number;
  peakValue: number;
  eventCount: number;
}

export class DataVisualizationService {
  private dataPoints: Map<string, DataPoint[]> = new Map();
  private heatMapCanvas: HTMLCanvasElement | null = null;
  private heatMapContext: CanvasRenderingContext2D | null = null;

  constructor() {
    this.initializeHeatMap();
  }

  private initializeHeatMap(): void {
    this.heatMapCanvas = document.createElement('canvas');
    this.heatMapContext = this.heatMapCanvas.getContext('2d');
  }

  addDataPoint(point: DataPoint): void {
    const typeKey = point.type;
    if (!this.dataPoints.has(typeKey)) {
      this.dataPoints.set(typeKey, []);
    }
    
    const points = this.dataPoints.get(typeKey)!;
    points.push(point);

    // Keep only last 10000 points per type to prevent memory issues
    if (points.length > 10000) {
      points.splice(0, points.length - 10000);
    }
  }

  addDataPoints(points: DataPoint[]): void {
    points.forEach(point => this.addDataPoint(point));
  }

  getDataPoints(
    type?: string,
    timeRange?: TimeRange,
    bounds?: { x: number; y: number; width: number; height: number }
  ): DataPoint[] {
    let allPoints: DataPoint[] = [];

    if (type) {
      allPoints = this.dataPoints.get(type) || [];
    } else {
      // Get all points from all types
      for (const points of this.dataPoints.values()) {
        allPoints.push(...points);
      }
    }

    // Filter by time range
    if (timeRange) {
      allPoints = allPoints.filter(point => 
        point.timestamp >= timeRange.start && point.timestamp <= timeRange.end
      );
    }

    // Filter by spatial bounds
    if (bounds) {
      allPoints = allPoints.filter(point =>
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      );
    }

    return allPoints;
  }

  generateHeatMap(
    width: number,
    height: number,
    points: DataPoint[],
    options: Partial<HeatMapOptions> = {}
  ): ImageData {
    const defaultOptions: HeatMapOptions = {
      radius: 25,
      maxOpacity: 0.8,
      minOpacity: 0.1,
      blur: 15,
      gradient: {
        0.0: 'blue',
        0.2: 'cyan',
        0.4: 'lime',
        0.6: 'yellow',
        0.8: 'orange',
        1.0: 'red'
      },
      colorScale: 'viridis'
    };

    const config = { ...defaultOptions, ...options };

    if (!this.heatMapCanvas || !this.heatMapContext) {
      this.initializeHeatMap();
    }

    this.heatMapCanvas!.width = width;
    this.heatMapCanvas!.height = height;
    const ctx = this.heatMapContext!;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (points.length === 0) {
      return ctx.getImageData(0, 0, width, height);
    }

    // Find min/max values for normalization
    const values = points.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    // Create intensity map
    const intensityData = new Float32Array(width * height);

    points.forEach(point => {
      const normalizedValue = (point.value - minValue) / valueRange;
      const intensity = normalizedValue * config.maxOpacity + config.minOpacity;

      // Apply radial gradient for each point
      const radius = config.radius;
      const startX = Math.max(0, Math.floor(point.x - radius));
      const endX = Math.min(width, Math.ceil(point.x + radius));
      const startY = Math.max(0, Math.floor(point.y - radius));
      const endY = Math.min(height, Math.ceil(point.y + radius));

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const distance = Math.sqrt(
            Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2)
          );
          
          if (distance <= radius) {
            const falloff = 1 - (distance / radius);
            const contribution = intensity * falloff;
            const index = y * width + x;
            intensityData[index] = Math.max(intensityData[index], contribution);
          }
        }
      }
    });

    // Apply blur effect
    if (config.blur > 0) {
      this.applyGaussianBlur(intensityData, width, height, config.blur);
    }

    // Convert intensity to color
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < intensityData.length; i++) {
      const intensity = intensityData[i];
      const color = this.intensityToColor(intensity, config);
      
      const pixelIndex = i * 4;
      data[pixelIndex] = color.r;     // Red
      data[pixelIndex + 1] = color.g; // Green
      data[pixelIndex + 2] = color.b; // Blue
      data[pixelIndex + 3] = Math.floor(intensity * 255); // Alpha
    }

    return imageData;
  }

  private applyGaussianBlur(
    data: Float32Array,
    width: number,
    height: number,
    radius: number
  ): void {
    // Simple box blur approximation of Gaussian blur
    const tempData = new Float32Array(data.length);
    
    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        
        for (let i = -radius; i <= radius; i++) {
          const sampleX = Math.max(0, Math.min(width - 1, x + i));
          sum += data[y * width + sampleX];
          count++;
        }
        
        tempData[y * width + x] = sum / count;
      }
    }
    
    // Vertical pass
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        let count = 0;
        
        for (let i = -radius; i <= radius; i++) {
          const sampleY = Math.max(0, Math.min(height - 1, y + i));
          sum += tempData[sampleY * width + x];
          count++;
        }
        
        data[y * width + x] = sum / count;
      }
    }
  }

  private intensityToColor(
    intensity: number,
    options: HeatMapOptions
  ): { r: number; g: number; b: number } {
    if (intensity === 0) {
      return { r: 0, g: 0, b: 0 };
    }

    // Use predefined color scales or custom gradient
    switch (options.colorScale) {
      case 'viridis':
        return this.viridisColorScale(intensity);
      case 'plasma':
        return this.plasmaColorScale(intensity);
      case 'inferno':
        return this.infernoColorScale(intensity);
      case 'turbo':
        return this.turboColorScale(intensity);
      default:
        return this.customGradientColor(intensity, options.gradient);
    }
  }

  private viridisColorScale(t: number): { r: number; g: number; b: number } {
    // Viridis color scale approximation
    const r = Math.max(0, Math.min(255, Math.floor(
      255 * (0.267004 + t * (0.004874 + t * (2.526188 + t * (-12.019460 + t * 22.446450))))
    )));
    const g = Math.max(0, Math.min(255, Math.floor(
      255 * (0.004877 + t * (0.445201 + t * (0.637773 + t * (0.513245 + t * (-0.600823)))))
    )));
    const b = Math.max(0, Math.min(255, Math.floor(
      255 * (0.329415 + t * (1.408124 + t * (-1.678114 + t * (0.289896 + t * 0.651897))))
    )));

    return { r, g, b };
  }

  private plasmaColorScale(t: number): { r: number; g: number; b: number } {
    // Plasma color scale approximation
    const r = Math.max(0, Math.min(255, Math.floor(
      255 * (0.050383 + t * (2.176514 + t * (-2.689460 + t * 6.130348)))
    )));
    const g = Math.max(0, Math.min(255, Math.floor(
      255 * (0.029556 + t * (0.005647 + t * (3.932712 + t * (-2.716530))))
    )));
    const b = Math.max(0, Math.min(255, Math.floor(
      255 * (0.579710 + t * (0.825211 + t * (-4.033574 + t * 6.111654)))
    )));

    return { r, g, b };
  }

  private infernoColorScale(t: number): { r: number; g: number; b: number } {
    // Inferno color scale approximation
    const r = Math.max(0, Math.min(255, Math.floor(
      255 * (0.001462 + t * (2.178012 + t * (0.533866 + t * 1.177701)))
    )));
    const g = Math.max(0, Math.min(255, Math.floor(
      255 * (0.000466 + t * (0.214847 + t * (1.645827 + t * 0.792682)))
    )));
    const b = Math.max(0, Math.min(255, Math.floor(
      255 * (0.013866 + t * (0.455123 + t * (-0.962896 + t * 1.573391)))
    )));

    return { r, g, b };
  }

  private turboColorScale(t: number): { r: number; g: number; b: number } {
    // Turbo color scale approximation
    const r = Math.max(0, Math.min(255, Math.floor(
      255 * (0.18995 + t * (4.5572 + t * (-42.3716 + t * (130.5 + t * (-118.1)))))
    )));
    const g = Math.max(0, Math.min(255, Math.floor(
      255 * (0.07176 + t * (11.8618 + t * (-122.68 + t * (383.8 + t * (-282.8)))))
    )));
    const b = Math.max(0, Math.min(255, Math.floor(
      255 * (0.23217 + t * (5.4110 + t * (-35.34 + t * (60.1 + t * (-36.0)))))
    )));

    return { r, g, b };
  }

  private customGradientColor(
    intensity: number,
    gradient: Record<number, string>
  ): { r: number; g: number; b: number } {
    const stops = Object.keys(gradient)
      .map(k => parseFloat(k))
      .sort((a, b) => a - b);

    if (stops.length === 0) {
      return { r: 255, g: 255, b: 255 };
    }

    if (intensity <= stops[0]) {
      return this.hexToRgb(gradient[stops[0]]);
    }

    if (intensity >= stops[stops.length - 1]) {
      return this.hexToRgb(gradient[stops[stops.length - 1]]);
    }

    // Find the two stops to interpolate between
    let lowerStop = stops[0];
    let upperStop = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
      if (intensity >= stops[i] && intensity <= stops[i + 1]) {
        lowerStop = stops[i];
        upperStop = stops[i + 1];
        break;
      }
    }

    // Interpolate between the two colors
    const t = (intensity - lowerStop) / (upperStop - lowerStop);
    const color1 = this.hexToRgb(gradient[lowerStop]);
    const color2 = this.hexToRgb(gradient[upperStop]);

    return {
      r: Math.floor(color1.r + (color2.r - color1.r) * t),
      g: Math.floor(color1.g + (color2.g - color1.g) * t),
      b: Math.floor(color1.b + (color2.b - color1.b) * t)
    };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  calculateRoomActivity(
    rooms: Array<{ id: string; name: string; bounds: { x: number; y: number; width: number; height: number } }>,
    timeRange?: TimeRange
  ): RoomActivity[] {
    return rooms.map(room => {
      const roomPoints = this.getDataPoints(undefined, timeRange, room.bounds);
      
      if (roomPoints.length === 0) {
        return {
          roomId: room.id,
          roomName: room.name,
          bounds: room.bounds,
          activityLevel: 0,
          dataPoints: [],
          averageValue: 0,
          peakValue: 0,
          eventCount: 0
        };
      }

      const values = roomPoints.map(p => p.value);
      const averageValue = values.reduce((a, b) => a + b, 0) / values.length;
      const peakValue = Math.max(...values);
      const eventCount = roomPoints.length;

      // Calculate activity level based on various factors
      const dataPointDensity = eventCount / (room.bounds.width * room.bounds.height);
      const valueIntensity = averageValue; // Assuming normalized 0-1 scale
      const activityLevel = Math.min(1, (dataPointDensity * 10000 + valueIntensity) / 2);

      return {
        roomId: room.id,
        roomName: room.name,
        bounds: room.bounds,
        activityLevel,
        dataPoints: roomPoints,
        averageValue,
        peakValue,
        eventCount
      };
    });
  }

  // Sample data generation for testing
  generateSampleData(
    width: number,
    height: number,
    type: 'emf' | 'temperature',
    count: number = 100
  ): DataPoint[] {
    const points: DataPoint[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      
      // Generate realistic values based on type
      let value: number;
      switch (type) {
        case 'emf':
          // EMF values typically range from 0-100 milligauss
          value = Math.random() * 100;
          break;
        case 'temperature':
          // Temperature in Fahrenheit, room temp with some variation
          value = 68 + (Math.random() - 0.5) * 20;
          break;
        default:
          value = Math.random();
      }

      points.push({
        id: `sample-${type}-${i}`,
        x,
        y,
        value,
        timestamp: new Date(now.getTime() - Math.random() * 3600000), // Last hour
        type,
        metadata: {
          synthetic: true,
          clustered: Math.random() > 0.7 // Some clustering
        }
      });
    }

    // Add some hotspots for more realistic data
    this.addHotspots(points, width, height, type, 3);

    return points;
  }

  private addHotspots(
    points: DataPoint[],
    width: number,
    height: number,
    type: 'emf' | 'temperature',
    hotspotCount: number
  ): void {
    for (let h = 0; h < hotspotCount; h++) {
      const centerX = Math.random() * width;
      const centerY = Math.random() * height;
      const radius = 50 + Math.random() * 100;
      const intensity = 0.5 + Math.random() * 0.5;

      // Add points in a cluster around the hotspot
      const clusterSize = 10 + Math.floor(Math.random() * 20);
      for (let i = 0; i < clusterSize; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        if (x >= 0 && x <= width && y >= 0 && y <= height) {
          let value: number;
          switch (type) {
            case 'emf':
              value = intensity * 100;
              break;
            case 'temperature':
              value = 68 + (intensity - 0.5) * 40;
              break;
            default:
              value = intensity;
          }

          points.push({
            id: `hotspot-${h}-${i}`,
            x,
            y,
            value,
            timestamp: new Date(),
            type,
            metadata: {
              hotspot: true,
              hotspotId: h
            }
          });
        }
      }
    }
  }

  clearData(type?: string): void {
    if (type) {
      this.dataPoints.delete(type);
    } else {
      this.dataPoints.clear();
    }
  }

  getDataTypes(): string[] {
    return Array.from(this.dataPoints.keys());
  }

  getDataStatistics(type?: string, timeRange?: TimeRange): {
    count: number;
    minValue: number;
    maxValue: number;
    averageValue: number;
    timeSpan: number;
  } {
    const points = this.getDataPoints(type, timeRange);
    
    if (points.length === 0) {
      return {
        count: 0,
        minValue: 0,
        maxValue: 0,
        averageValue: 0,
        timeSpan: 0
      };
    }

    const values = points.map(p => p.value);
    const timestamps = points.map(p => p.timestamp.getTime());

    return {
      count: points.length,
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
      averageValue: values.reduce((a, b) => a + b, 0) / values.length,
      timeSpan: Math.max(...timestamps) - Math.min(...timestamps)
    };
  }
}

// Singleton instance
let dataVisualizationService: DataVisualizationService | null = null;

export const getDataVisualizationService = (): DataVisualizationService => {
  if (!dataVisualizationService) {
    dataVisualizationService = new DataVisualizationService();
  }
  return dataVisualizationService;
};