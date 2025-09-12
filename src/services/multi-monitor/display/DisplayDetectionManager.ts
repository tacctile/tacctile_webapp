import { EventEmitter } from 'events';
import { screen, Display } from 'electron';
import {
  DisplayInfo,
  DisplayDetectionResult,
  DisplayChange,
  DisplayChangeType,
  DisplayCapabilities,
  Resolution,
  PositioningStrategy,
  PositioningType,
  WindowPosition,
  PositionAnchor
} from '../types';

export class DisplayDetectionManager extends EventEmitter {
  private displays: Map<string, DisplayInfo> = new Map();
  private detectionInterval?: NodeJS.Timeout;
  private lastDetection: DisplayDetectionResult | null = null;
  private capabilities: DisplayCapabilities | null = null;
  private logger: any;
  private isMonitoring: boolean = false;
  private detectionFrequency: number = 2000; // 2 seconds

  constructor() {
    super();
    this.logger = console; // Replace with actual logger
    this.initializeDetection();
  }

  private async initializeDetection(): Promise<void> {
    try {
      this.logger.info('Initializing display detection manager');
      
      // Initial display detection
      await this.performDisplayDetection();
      
      // Detect display capabilities
      await this.detectCapabilities();
      
      // Set up screen change listeners
      this.setupScreenChangeListeners();
      
      this.emit('initialized', {
        displayCount: this.displays.size,
        capabilities: this.capabilities
      });
      
      this.logger.info(`Display detection initialized with ${this.displays.size} displays`);
    } catch (error) {
      this.logger.error('Failed to initialize display detection:', error);
      this.emit('error', { error, context: 'initialization' });
    }
  }

  private setupScreenChangeListeners(): void {
    // Listen for display changes
    screen.on('display-added', (event, newDisplay) => {
      this.handleDisplayAdded(newDisplay);
    });

    screen.on('display-removed', (event, oldDisplay) => {
      this.handleDisplayRemoved(oldDisplay);
    });

    screen.on('display-metrics-changed', (event, display, changedMetrics) => {
      this.handleDisplayMetricsChanged(display, changedMetrics);
    });
  }

  private async handleDisplayAdded(display: Display): Promise<void> {
    this.logger.info('Display added:', display.id);
    
    const displayInfo = this.convertElectronDisplay(display);
    this.displays.set(displayInfo.id, displayInfo);
    
    const change: DisplayChange = {
      type: DisplayChangeType.ADDED,
      displayId: displayInfo.id,
      newState: displayInfo
    };
    
    this.emit('display-added', { display: displayInfo, change });
    this.emit('display-changed', { displays: Array.from(this.displays.values()), change });
    
    // Re-detect capabilities as they may have changed
    await this.detectCapabilities();
  }

  private async handleDisplayRemoved(display: Display): Promise<void> {
    this.logger.info('Display removed:', display.id);
    
    const displayId = display.id.toString();
    const removedDisplay = this.displays.get(displayId);
    
    if (removedDisplay) {
      this.displays.delete(displayId);
      
      const change: DisplayChange = {
        type: DisplayChangeType.REMOVED,
        displayId,
        oldState: removedDisplay
      };
      
      this.emit('display-removed', { display: removedDisplay, change });
      this.emit('display-changed', { displays: Array.from(this.displays.values()), change });
    }
    
    // Re-detect capabilities
    await this.detectCapabilities();
  }

  private async handleDisplayMetricsChanged(display: Display, changedMetrics: string[]): Promise<void> {
    this.logger.info('Display metrics changed:', display.id, changedMetrics);
    
    const displayId = display.id.toString();
    const oldDisplay = this.displays.get(displayId);
    const newDisplay = this.convertElectronDisplay(display);
    
    if (oldDisplay) {
      this.displays.set(displayId, newDisplay);
      
      // Determine the type of change
      const changeType = this.determineChangeType(changedMetrics);
      
      const change: DisplayChange = {
        type: changeType,
        displayId,
        oldState: oldDisplay,
        newState: newDisplay
      };
      
      this.emit('display-metrics-changed', { display: newDisplay, change, changedMetrics });
      this.emit('display-changed', { displays: Array.from(this.displays.values()), change });
    }
  }

  private determineChangeType(changedMetrics: string[]): DisplayChangeType {
    if (changedMetrics.includes('bounds')) {
      if (changedMetrics.includes('size')) {
        return DisplayChangeType.RESIZED;
      } else {
        return DisplayChangeType.MOVED;
      }
    }
    
    if (changedMetrics.includes('rotation')) {
      return DisplayChangeType.ROTATED;
    }
    
    if (changedMetrics.includes('scaleFactor')) {
      return DisplayChangeType.SCALE_CHANGED;
    }
    
    return DisplayChangeType.MOVED; // Default fallback
  }

  public async performDisplayDetection(): Promise<DisplayDetectionResult> {
    try {
      const electronDisplays = screen.getAllDisplays();
      const newDisplays = new Map<string, DisplayInfo>();
      const changes: DisplayChange[] = [];
      
      // Convert Electron displays to our format
      for (const electronDisplay of electronDisplays) {
        const displayInfo = this.convertElectronDisplay(electronDisplay);
        newDisplays.set(displayInfo.id, displayInfo);
        
        // Check for changes
        const existingDisplay = this.displays.get(displayInfo.id);
        if (!existingDisplay) {
          changes.push({
            type: DisplayChangeType.ADDED,
            displayId: displayInfo.id,
            newState: displayInfo
          });
        } else if (this.hasDisplayChanged(existingDisplay, displayInfo)) {
          changes.push({
            type: this.getChangeType(existingDisplay, displayInfo),
            displayId: displayInfo.id,
            oldState: existingDisplay,
            newState: displayInfo
          });
        }
      }
      
      // Check for removed displays
      for (const [displayId, display] of this.displays) {
        if (!newDisplays.has(displayId)) {
          changes.push({
            type: DisplayChangeType.REMOVED,
            displayId,
            oldState: display
          });
        }
      }
      
      // Update internal displays map
      this.displays = newDisplays;
      
      const result: DisplayDetectionResult = {
        displays: Array.from(this.displays.values()),
        changes,
        timestamp: Date.now(),
        capabilities: this.capabilities || this.getDefaultCapabilities()
      };
      
      this.lastDetection = result;
      
      if (changes.length > 0) {
        this.emit('displays-changed', result);
        this.logger.info(`Display detection completed: ${changes.length} changes detected`);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Display detection failed:', error);
      throw error;
    }
  }

  private convertElectronDisplay(display: Display): DisplayInfo {
    return {
      id: display.id.toString(),
      name: display.label || `Display ${display.id}`,
      bounds: {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height
      },
      workArea: {
        x: display.workArea.x,
        y: display.workArea.y,
        width: display.workArea.width,
        height: display.workArea.height
      },
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      isPrimary: screen.getPrimaryDisplay().id === display.id,
      isInternal: display.internal || false,
      colorDepth: display.colorDepth,
      accelerometerSupport: display.accelerometerSupport || false,
      touchSupport: display.touchSupport || false,
      monochrome: display.monochrome || false,
      displayFrequency: display.displayFrequency
    };
  }

  private hasDisplayChanged(oldDisplay: DisplayInfo, newDisplay: DisplayInfo): boolean {
    return (
      oldDisplay.bounds.x !== newDisplay.bounds.x ||
      oldDisplay.bounds.y !== newDisplay.bounds.y ||
      oldDisplay.bounds.width !== newDisplay.bounds.width ||
      oldDisplay.bounds.height !== newDisplay.bounds.height ||
      oldDisplay.scaleFactor !== newDisplay.scaleFactor ||
      oldDisplay.rotation !== newDisplay.rotation ||
      oldDisplay.isPrimary !== newDisplay.isPrimary
    );
  }

  private getChangeType(oldDisplay: DisplayInfo, newDisplay: DisplayInfo): DisplayChangeType {
    if (oldDisplay.bounds.width !== newDisplay.bounds.width || 
        oldDisplay.bounds.height !== newDisplay.bounds.height) {
      return DisplayChangeType.RESIZED;
    }
    
    if (oldDisplay.bounds.x !== newDisplay.bounds.x || 
        oldDisplay.bounds.y !== newDisplay.bounds.y) {
      return DisplayChangeType.MOVED;
    }
    
    if (oldDisplay.rotation !== newDisplay.rotation) {
      return DisplayChangeType.ROTATED;
    }
    
    if (oldDisplay.scaleFactor !== newDisplay.scaleFactor) {
      return DisplayChangeType.SCALE_CHANGED;
    }
    
    if (oldDisplay.isPrimary !== newDisplay.isPrimary) {
      return DisplayChangeType.PRIMARY_CHANGED;
    }
    
    return DisplayChangeType.MOVED; // Default fallback
  }

  private async detectCapabilities(): Promise<void> {
    try {
      const displays = Array.from(this.displays.values());
      const resolutions = new Set<string>();
      let hdrSupport = false;
      let touchSupport = false;
      let wideColorGamut = false;
      
      // Collect capabilities from all displays
      for (const display of displays) {
        const aspectRatio = this.calculateAspectRatio(display.bounds.width, display.bounds.height);
        resolutions.add(`${display.bounds.width}x${display.bounds.height}:${aspectRatio}`);
        
        if (display.touchSupport) touchSupport = true;
        // HDR and wide color gamut detection would require additional platform-specific APIs
      }
      
      const uniqueResolutions: Resolution[] = Array.from(resolutions).map(res => {
        const [dimensions, aspectRatio] = res.split(':');
        const [width, height] = dimensions.split('x').map(Number);
        return { width, height, aspectRatio };
      });
      
      this.capabilities = {
        maxDisplays: 32, // Platform dependent, this is a reasonable default
        supportedResolutions: uniqueResolutions,
        supportedRefreshRates: [60, 75, 120, 144, 240], // Common refresh rates
        hdrSupport,
        wideColorGamut,
        touchSupport,
        penSupport: false // Would require additional detection
      };
      
      this.emit('capabilities-updated', this.capabilities);
    } catch (error) {
      this.logger.error('Failed to detect capabilities:', error);
      this.capabilities = this.getDefaultCapabilities();
    }
  }

  private calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const ratioWidth = width / divisor;
    const ratioHeight = height / divisor;
    
    // Common aspect ratios
    const commonRatios: Record<string, string> = {
      '16:9': '16:9',
      '16:10': '16:10',
      '4:3': '4:3',
      '21:9': '21:9',
      '32:9': '32:9'
    };
    
    const ratioString = `${ratioWidth}:${ratioHeight}`;
    return commonRatios[ratioString] || ratioString;
  }

  private getDefaultCapabilities(): DisplayCapabilities {
    return {
      maxDisplays: 8,
      supportedResolutions: [
        { width: 1920, height: 1080, aspectRatio: '16:9' },
        { width: 2560, height: 1440, aspectRatio: '16:9' },
        { width: 3840, height: 2160, aspectRatio: '16:9' }
      ],
      supportedRefreshRates: [60, 75, 120],
      hdrSupport: false,
      wideColorGamut: false,
      touchSupport: false,
      penSupport: false
    };
  }

  public calculateOptimalPosition(
    strategy: PositioningStrategy,
    targetDisplay: DisplayInfo,
    windowSize: { width: number; height: number },
    existingWindows: Array<{ bounds: { x: number; y: number; width: number; height: number } }> = []
  ): WindowPosition {
    switch (strategy.type) {
      case PositioningType.AUTOMATIC:
        return this.calculateAutomaticPosition(targetDisplay, windowSize, existingWindows);
      
      case PositioningType.SMART_ARRANGEMENT:
        return this.calculateSmartArrangement(targetDisplay, windowSize, existingWindows, strategy.parameters);
      
      case PositioningType.CASCADE:
        return this.calculateCascadePosition(targetDisplay, windowSize, existingWindows, strategy.parameters);
      
      case PositioningType.TILE:
        return this.calculateTilePosition(targetDisplay, windowSize, existingWindows, strategy.parameters);
      
      case PositioningType.TEMPLATE_BASED:
        return this.calculateTemplatePosition(targetDisplay, windowSize, strategy.parameters);
      
      case PositioningType.MANUAL:
        return strategy.parameters as WindowPosition;
      
      default:
        return this.calculateCenterPosition(targetDisplay, windowSize);
    }
  }

  private calculateAutomaticPosition(
    display: DisplayInfo,
    windowSize: { width: number; height: number },
    existingWindows: Array<{ bounds: { x: number; y: number; width: number; height: number } }>
  ): WindowPosition {
    // Try to find a position that doesn't overlap with existing windows
    const workArea = display.workArea;
    const margin = 20;
    
    // Start from top-left of work area
    let bestX = workArea.x + margin;
    let bestY = workArea.y + margin;
    
    // Check if this position overlaps with existing windows
    for (const existing of existingWindows) {
      const wouldOverlap = this.checkOverlap(
        { x: bestX, y: bestY, width: windowSize.width, height: windowSize.height },
        existing.bounds
      );
      
      if (wouldOverlap) {
        // Try next position (cascade style)
        bestX += 30;
        bestY += 30;
        
        // Wrap around if we go off screen
        if (bestX + windowSize.width > workArea.x + workArea.width) {
          bestX = workArea.x + margin;
          bestY += 50;
        }
        
        if (bestY + windowSize.height > workArea.y + workArea.height) {
          bestY = workArea.y + margin;
        }
      }
    }
    
    return {
      x: bestX,
      y: bestY,
      anchor: PositionAnchor.TOP_LEFT
    };
  }

  private calculateSmartArrangement(
    display: DisplayInfo,
    windowSize: { width: number; height: number },
    existingWindows: Array<{ bounds: { x: number; y: number; width: number; height: number } }>,
    parameters: Record<string, any>
  ): WindowPosition {
    const workArea = display.workArea;
    const margin = parameters.margin || 10;
    const preferredQuadrant = parameters.quadrant || 'top-left';
    
    // Divide screen into quadrants
    const quadrantWidth = (workArea.width - margin * 3) / 2;
    const quadrantHeight = (workArea.height - margin * 3) / 2;
    
    const quadrants = {
      'top-left': { x: workArea.x + margin, y: workArea.y + margin },
      'top-right': { x: workArea.x + margin + quadrantWidth + margin, y: workArea.y + margin },
      'bottom-left': { x: workArea.x + margin, y: workArea.y + margin + quadrantHeight + margin },
      'bottom-right': { x: workArea.x + margin + quadrantWidth + margin, y: workArea.y + margin + quadrantHeight + margin }
    };
    
    let targetQuadrant = quadrants[preferredQuadrant as keyof typeof quadrants];
    
    // Check if preferred quadrant is available
    const wouldOverlap = existingWindows.some(existing =>
      this.checkOverlap(
        { x: targetQuadrant.x, y: targetQuadrant.y, width: windowSize.width, height: windowSize.height },
        existing.bounds
      )
    );
    
    if (wouldOverlap) {
      // Try other quadrants
      for (const [quadrantName, quadrant] of Object.entries(quadrants)) {
        if (quadrantName === preferredQuadrant) continue;
        
        const overlap = existingWindows.some(existing =>
          this.checkOverlap(
            { x: quadrant.x, y: quadrant.y, width: windowSize.width, height: windowSize.height },
            existing.bounds
          )
        );
        
        if (!overlap) {
          targetQuadrant = quadrant;
          break;
        }
      }
    }
    
    return {
      x: targetQuadrant.x,
      y: targetQuadrant.y,
      anchor: PositionAnchor.TOP_LEFT
    };
  }

  private calculateCascadePosition(
    display: DisplayInfo,
    windowSize: { width: number; height: number },
    existingWindows: Array<{ bounds: { x: number; y: number; width: number; height: number } }>,
    parameters: Record<string, any>
  ): WindowPosition {
    const workArea = display.workArea;
    const cascadeOffset = parameters.cascadeOffset || 25;
    const startMargin = parameters.startMargin || 20;
    
    let x = workArea.x + startMargin;
    let y = workArea.y + startMargin;
    
    // Apply cascade offset for each existing window
    const cascadeCount = existingWindows.length;
    x += cascadeCount * cascadeOffset;
    y += cascadeCount * cascadeOffset;
    
    // Wrap around if we go off screen
    if (x + windowSize.width > workArea.x + workArea.width) {
      x = workArea.x + startMargin;
    }
    
    if (y + windowSize.height > workArea.y + workArea.height) {
      y = workArea.y + startMargin;
    }
    
    return {
      x,
      y,
      anchor: PositionAnchor.TOP_LEFT
    };
  }

  private calculateTilePosition(
    display: DisplayInfo,
    windowSize: { width: number; height: number },
    existingWindows: Array<{ bounds: { x: number; y: number; width: number; height: number } }>,
    parameters: Record<string, any>
  ): WindowPosition {
    const workArea = display.workArea;
    const columns = parameters.columns || Math.ceil(Math.sqrt(existingWindows.length + 1));
    const rows = Math.ceil((existingWindows.length + 1) / columns);
    
    const tileWidth = workArea.width / columns;
    const tileHeight = workArea.height / rows;
    
    const tileIndex = existingWindows.length;
    const column = tileIndex % columns;
    const row = Math.floor(tileIndex / columns);
    
    const x = workArea.x + column * tileWidth;
    const y = workArea.y + row * tileHeight;
    
    return {
      x,
      y,
      anchor: PositionAnchor.TOP_LEFT
    };
  }

  private calculateTemplatePosition(
    display: DisplayInfo,
    windowSize: { width: number; height: number },
    parameters: Record<string, any>
  ): WindowPosition {
    const template = parameters.template;
    if (!template || !template.x || !template.y) {
      return this.calculateCenterPosition(display, windowSize);
    }
    
    const workArea = display.workArea;
    
    // Template positions can be absolute or percentage-based
    let x = template.x;
    let y = template.y;
    
    if (typeof x === 'string' && x.endsWith('%')) {
      const percentage = parseFloat(x) / 100;
      x = workArea.x + (workArea.width * percentage);
    }
    
    if (typeof y === 'string' && y.endsWith('%')) {
      const percentage = parseFloat(y) / 100;
      y = workArea.y + (workArea.height * percentage);
    }
    
    return {
      x: typeof x === 'number' ? x : workArea.x,
      y: typeof y === 'number' ? y : workArea.y,
      anchor: template.anchor || PositionAnchor.TOP_LEFT,
      offset: template.offset
    };
  }

  private calculateCenterPosition(
    display: DisplayInfo,
    windowSize: { width: number; height: number }
  ): WindowPosition {
    const workArea = display.workArea;
    
    return {
      x: workArea.x + (workArea.width - windowSize.width) / 2,
      y: workArea.y + (workArea.height - windowSize.height) / 2,
      anchor: PositionAnchor.TOP_LEFT
    };
  }

  private checkOverlap(
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(
      rect1.x + rect1.width <= rect2.x ||
      rect2.x + rect2.width <= rect1.x ||
      rect1.y + rect1.height <= rect2.y ||
      rect2.y + rect2.height <= rect1.y
    );
  }

  public startContinuousMonitoring(frequency: number = 2000): void {
    if (this.isMonitoring) {
      this.stopContinuousMonitoring();
    }
    
    this.detectionFrequency = frequency;
    this.isMonitoring = true;
    
    this.detectionInterval = setInterval(async () => {
      try {
        await this.performDisplayDetection();
      } catch (error) {
        this.logger.error('Continuous monitoring error:', error);
      }
    }, this.detectionFrequency);
    
    this.emit('monitoring-started', { frequency });
    this.logger.info(`Started continuous display monitoring at ${frequency}ms intervals`);
  }

  public stopContinuousMonitoring(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = undefined;
    }
    
    this.isMonitoring = false;
    this.emit('monitoring-stopped');
    this.logger.info('Stopped continuous display monitoring');
  }

  public getDisplays(): DisplayInfo[] {
    return Array.from(this.displays.values());
  }

  public getDisplay(id: string): DisplayInfo | null {
    return this.displays.get(id) || null;
  }

  public getPrimaryDisplay(): DisplayInfo | null {
    for (const display of this.displays.values()) {
      if (display.isPrimary) {
        return display;
      }
    }
    return null;
  }

  public getDisplayCapabilities(): DisplayCapabilities | null {
    return this.capabilities;
  }

  public getLastDetectionResult(): DisplayDetectionResult | null {
    return this.lastDetection;
  }

  public isDisplayAvailable(id: string): boolean {
    return this.displays.has(id);
  }

  public getDisplayBounds(id: string): { x: number; y: number; width: number; height: number } | null {
    const display = this.displays.get(id);
    return display ? display.bounds : null;
  }

  public getDisplayWorkArea(id: string): { x: number; y: number; width: number; height: number } | null {
    const display = this.displays.get(id);
    return display ? display.workArea : null;
  }

  public findDisplayAtPoint(x: number, y: number): DisplayInfo | null {
    for (const display of this.displays.values()) {
      const bounds = display.bounds;
      if (x >= bounds.x && x < bounds.x + bounds.width &&
          y >= bounds.y && y < bounds.y + bounds.height) {
        return display;
      }
    }
    return null;
  }

  public getTotalDisplayArea(): { width: number; height: number; bounds: { x: number; y: number; width: number; height: number } } {
    if (this.displays.size === 0) {
      return { width: 0, height: 0, bounds: { x: 0, y: 0, width: 0, height: 0 } };
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const display of this.displays.values()) {
      const bounds = display.bounds;
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    return {
      width,
      height,
      bounds: { x: minX, y: minY, width, height }
    };
  }

  public dispose(): void {
    this.stopContinuousMonitoring();
    this.displays.clear();
    this.removeAllListeners();
    this.logger.info('Display detection manager disposed');
  }
}