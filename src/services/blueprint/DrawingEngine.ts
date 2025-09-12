import paper from 'paper';
import interact from 'interactjs';
import { v4 as uuidv4 } from 'uuid';

export type DrawingTool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'text' | 'evidence-pin';

export interface GridSettings {
  size: number;
  visible: boolean;
  snapEnabled: boolean;
  color: string;
  opacity: number;
}

export interface DrawingElement {
  id: string;
  type: DrawingTool;
  layer: string;
  paperItem: paper.Item;
  properties: Record<string, any>;
  selected: boolean;
  locked: boolean;
  visible: boolean;
}

export interface WallProperties {
  thickness: number;
  material: string;
  color: string;
  length?: number;
}

export interface DoorProperties {
  width: number;
  height: number;
  openDirection: 'left' | 'right';
  doorType: 'single' | 'double' | 'sliding';
  color: string;
}

export interface WindowProperties {
  width: number;
  height: number;
  sillHeight: number;
  windowType: 'single' | 'double' | 'sliding' | 'casement';
  color: string;
}

export interface RoomProperties {
  name: string;
  area?: number;
  color: string;
  fillColor?: string;
  opacity: number;
}

export interface EvidencePinProperties {
  evidenceId: string;
  evidenceType: 'photo' | 'audio' | 'video' | 'emf' | 'temperature' | 'motion' | 'other';
  timestamp: Date;
  description: string;
  filePath?: string;
  thumbnailPath?: string;
}

export class DrawingEngine {
  private canvas: HTMLCanvasElement;
  private scope: paper.PaperScope;
  private currentTool: DrawingTool = 'select';
  private elements: Map<string, DrawingElement> = new Map();
  private layers: Map<string, paper.Layer> = new Map();
  private gridSettings: GridSettings;
  private isDrawing = false;
  private currentPath: paper.Path | null = null;
  private selectedElements: Set<string> = new Set();
  private clipboard: DrawingElement[] = [];
  private undoStack: any[] = [];
  private redoStack: any[] = [];
  private scale = 1;
  private panOffset: paper.Point = new paper.Point(0, 0);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scope = new paper.PaperScope();
    this.scope.setup(canvas);
    
    this.gridSettings = {
      size: 20,
      visible: true,
      snapEnabled: true,
      color: '#333333',
      opacity: 0.3
    };

    this.initializeLayers();
    this.setupEventHandlers();
    this.drawGrid();
  }

  private initializeLayers(): void {
    // Create default layers
    const layerNames = ['grid', 'walls', 'doors', 'windows', 'rooms', 'annotations', 'evidence'];
    
    layerNames.forEach(name => {
      const layer = new paper.Layer();
      layer.name = name;
      this.layers.set(name, layer);
    });

    // Set walls layer as active by default
    this.layers.get('walls')?.activate();
  }

  private setupEventHandlers(): void {
    this.scope.view.onMouseDown = this.handleMouseDown.bind(this);
    this.scope.view.onMouseDrag = this.handleMouseDrag.bind(this);
    this.scope.view.onMouseUp = this.handleMouseUp.bind(this);
    this.scope.view.onKeyDown = this.handleKeyDown.bind(this);
    this.scope.view.onKeyUp = this.handleKeyUp.bind(this);

    // Setup interact.js for drag and drop
    interact(this.canvas)
      .draggable({
        listeners: {
          move: this.handleCanvasDrag.bind(this)
        }
      })
      .gesturable({
        listeners: {
          move: this.handleGesture.bind(this)
        }
      });
  }

  public setTool(tool: DrawingTool): void {
    this.currentTool = tool;
    this.clearSelection();
    
    // Update cursor based on tool
    this.canvas.style.cursor = this.getCursorForTool(tool);
  }

  private getCursorForTool(tool: DrawingTool): string {
    switch (tool) {
      case 'select': return 'default';
      case 'wall': return 'crosshair';
      case 'door': return 'crosshair';
      case 'window': return 'crosshair';
      case 'room': return 'crosshair';
      case 'text': return 'text';
      case 'evidence-pin': return 'crosshair';
      default: return 'default';
    }
  }

  private handleMouseDown(event: paper.ToolEvent): void {
    const point = this.snapToGrid(event.point);

    switch (this.currentTool) {
      case 'select':
        this.handleSelect(event);
        break;
      case 'wall':
        this.startWall(point);
        break;
      case 'door':
        this.createDoor(point);
        break;
      case 'window':
        this.createWindow(point);
        break;
      case 'room':
        this.startRoom(point);
        break;
      case 'text':
        this.createTextLabel(point);
        break;
      case 'evidence-pin':
        this.createEvidencePin(point);
        break;
    }
  }

  private handleMouseDrag(event: paper.ToolEvent): void {
    if (!this.isDrawing) return;

    const point = this.snapToGrid(event.point);

    switch (this.currentTool) {
      case 'wall':
        this.updateWall(point);
        break;
      case 'room':
        this.updateRoom(point);
        break;
    }
  }

  private handleMouseUp(event: paper.ToolEvent): void {
    if (!this.isDrawing) return;

    const point = this.snapToGrid(event.point);

    switch (this.currentTool) {
      case 'wall':
        this.finishWall(point);
        break;
      case 'room':
        this.updateRoom(point);
        break;
    }
  }

  private startWall(point: paper.Point): void {
    this.layers.get('walls')?.activate();
    
    const wall = new paper.Path();
    wall.strokeColor = new paper.Color('#000000');
    wall.strokeWidth = 3;
    wall.add(point);
    
    this.currentPath = wall;
    this.isDrawing = true;
  }

  private updateWall(point: paper.Point): void {
    if (!this.currentPath) return;
    
    // Remove the last segment if it exists (for live preview)
    if (this.currentPath.segments.length > 1) {
      this.currentPath.removeSegment(this.currentPath.segments.length - 1);
    }
    
    this.currentPath.add(point);
    this.scope.view.draw();
  }

  private finishWall(point: paper.Point): void {
    if (!this.currentPath) return;

    // Ensure the wall has at least two points
    if (this.currentPath.segments.length === 1) {
      this.currentPath.add(point);
    }

    const length = this.currentPath.length;
    
    const element: DrawingElement = {
      id: uuidv4(),
      type: 'wall',
      layer: 'walls',
      paperItem: this.currentPath,
      properties: {
        thickness: 6, // inches
        material: 'drywall',
        color: '#000000',
        length: length
      },
      selected: false,
      locked: false,
      visible: true
    };

    this.elements.set(element.id, element);
    this.currentPath.data = { elementId: element.id };
    
    this.currentPath = null;
    this.isDrawing = false;
    this.saveState();
  }

  private createDoor(point: paper.Point): void {
    this.layers.get('doors')?.activate();
    
    // Create door symbol (rectangle with arc)
    const doorWidth = 36; // 3 feet in scale
    const doorHeight = 6; // Wall thickness
    
    const rect = new paper.Rectangle(point.x, point.y, doorWidth, doorHeight);
    const door = new paper.Path.Rectangle(rect);
    door.strokeColor = new paper.Color('#8B4513');
    door.fillColor = new paper.Color('#D2691E');
    door.strokeWidth = 2;

    // Add door swing arc
    const arc = new paper.Path.Arc(
      point,
      new paper.Point(point.x + doorWidth, point.y),
      new paper.Point(point.x + doorWidth, point.y - doorWidth)
    );
    arc.strokeColor = new paper.Color('#8B4513');
    arc.strokeWidth = 1;
    arc.dashArray = [5, 5];

    const group = new paper.Group([door, arc]);
    
    const element: DrawingElement = {
      id: uuidv4(),
      type: 'door',
      layer: 'doors',
      paperItem: group,
      properties: {
        width: 36,
        height: 80,
        openDirection: 'right',
        doorType: 'single',
        color: '#8B4513'
      },
      selected: false,
      locked: false,
      visible: true
    };

    this.elements.set(element.id, element);
    group.data = { elementId: element.id };
    this.saveState();
  }

  private createWindow(point: paper.Point): void {
    this.layers.get('windows')?.activate();
    
    const windowWidth = 48; // 4 feet in scale
    const windowHeight = 6; // Wall thickness
    
    const rect = new paper.Rectangle(point.x, point.y, windowWidth, windowHeight);
    const window = new paper.Path.Rectangle(rect);
    window.strokeColor = new paper.Color('#4169E1');
    window.fillColor = new paper.Color('#87CEEB');
    window.strokeWidth = 2;

    // Add window cross pattern
    const cross1 = new paper.Path.Line(
      new paper.Point(point.x + windowWidth/2, point.y),
      new paper.Point(point.x + windowWidth/2, point.y + windowHeight)
    );
    const cross2 = new paper.Path.Line(
      new paper.Point(point.x, point.y + windowHeight/2),
      new paper.Point(point.x + windowWidth, point.y + windowHeight/2)
    );
    
    cross1.strokeColor = new paper.Color('#4169E1');
    cross2.strokeColor = new paper.Color('#4169E1');
    cross1.strokeWidth = 1;
    cross2.strokeWidth = 1;

    const group = new paper.Group([window, cross1, cross2]);
    
    const element: DrawingElement = {
      id: uuidv4(),
      type: 'window',
      layer: 'windows',
      paperItem: group,
      properties: {
        width: 48,
        height: 36,
        sillHeight: 30,
        windowType: 'double',
        color: '#4169E1'
      },
      selected: false,
      locked: false,
      visible: true
    };

    this.elements.set(element.id, element);
    group.data = { elementId: element.id };
    this.saveState();
  }

  private startRoom(point: paper.Point): void {
    this.layers.get('rooms')?.activate();
    
    const room = new paper.Path();
    room.strokeColor = new paper.Color('#FF6347');
    room.fillColor = new paper.Color('rgba(255, 99, 71, 0.2)');
    room.strokeWidth = 2;
    room.closed = false;
    room.add(point);
    
    this.currentPath = room;
    this.isDrawing = true;
  }

  private updateRoom(point: paper.Point): void {
    if (!this.currentPath) return;
    
    this.currentPath.add(point);
    this.scope.view.draw();
  }

  private finishRoom(): void {
    if (!this.currentPath) return;

    this.currentPath.closed = true;
    
    const element: DrawingElement = {
      id: uuidv4(),
      type: 'room',
      layer: 'rooms',
      paperItem: this.currentPath,
      properties: {
        name: `Room ${this.elements.size + 1}`,
        area: this.currentPath.area,
        color: '#FF6347',
        fillColor: 'rgba(255, 99, 71, 0.2)',
        opacity: 0.2
      },
      selected: false,
      locked: false,
      visible: true
    };

    this.elements.set(element.id, element);
    this.currentPath.data = { elementId: element.id };
    
    this.currentPath = null;
    this.isDrawing = false;
    this.saveState();
  }

  private createTextLabel(point: paper.Point): void {
    this.layers.get('annotations')?.activate();
    
    const text = new paper.PointText(point);
    text.content = 'Label';
    text.fillColor = new paper.Color('#000000');
    text.fontSize = 14;
    text.fontFamily = 'Arial, sans-serif';
    
    const element: DrawingElement = {
      id: uuidv4(),
      type: 'text',
      layer: 'annotations',
      paperItem: text,
      properties: {
        content: 'Label',
        fontSize: 14,
        fontFamily: 'Arial',
        color: '#000000'
      },
      selected: false,
      locked: false,
      visible: true
    };

    this.elements.set(element.id, element);
    text.data = { elementId: element.id };
    this.saveState();
  }

  private createEvidencePin(point: paper.Point): void {
    this.layers.get('evidence')?.activate();
    
    // Create evidence pin as a circle with icon
    const pin = new paper.Path.Circle(point, 10);
    pin.fillColor = new paper.Color('#FF4444');
    pin.strokeColor = new paper.Color('#CC0000');
    pin.strokeWidth = 2;

    // Add evidence type icon (simplified)
    const icon = new paper.PointText(point);
    icon.content = '📸'; // Default to photo icon
    icon.fontSize = 12;
    icon.justification = 'center';
    
    const group = new paper.Group([pin, icon]);
    
    const element: DrawingElement = {
      id: uuidv4(),
      type: 'evidence-pin',
      layer: 'evidence',
      paperItem: group,
      properties: {
        evidenceId: uuidv4(),
        evidenceType: 'photo',
        timestamp: new Date(),
        description: 'Evidence found here',
        filePath: '',
        thumbnailPath: ''
      },
      selected: false,
      locked: false,
      visible: true
    };

    this.elements.set(element.id, element);
    group.data = { elementId: element.id };
    this.saveState();
  }

  private handleSelect(event: paper.ToolEvent): void {
    const hitResult = this.scope.project.hitTest(event.point, {
      fill: true,
      stroke: true,
      segments: true,
      tolerance: 5
    });

    if (hitResult && hitResult.item.data?.elementId) {
      const elementId = hitResult.item.data.elementId;
      
      if (!event.modifiers.shift) {
        this.clearSelection();
      }
      
      this.selectElement(elementId);
    } else {
      this.clearSelection();
    }
  }

  private selectElement(elementId: string): void {
    const element = this.elements.get(elementId);
    if (!element) return;

    element.selected = true;
    this.selectedElements.add(elementId);
    
    // Visual selection feedback
    element.paperItem.selected = true;
    
    this.scope.view.draw();
  }

  private clearSelection(): void {
    this.selectedElements.forEach(id => {
      const element = this.elements.get(id);
      if (element) {
        element.selected = false;
        element.paperItem.selected = false;
      }
    });
    
    this.selectedElements.clear();
    this.scope.view.draw();
  }

  private snapToGrid(point: paper.Point): paper.Point {
    if (!this.gridSettings.snapEnabled) return point;
    
    const gridSize = this.gridSettings.size * this.scale;
    const x = Math.round(point.x / gridSize) * gridSize;
    const y = Math.round(point.y / gridSize) * gridSize;
    
    return new paper.Point(x, y);
  }

  private drawGrid(): void {
    if (!this.gridSettings.visible) return;

    this.layers.get('grid')?.activate();
    this.layers.get('grid')?.removeChildren();
    
    const bounds = this.scope.view.bounds;
    const gridSize = this.gridSettings.size;
    
    const path = new paper.Path();
    path.strokeColor = new paper.Color(this.gridSettings.color);
    path.strokeWidth = 1;
    path.opacity = this.gridSettings.opacity;

    // Vertical lines
    for (let x = bounds.left; x <= bounds.right; x += gridSize) {
      path.moveTo(new paper.Point(x, bounds.top));
      path.lineTo(new paper.Point(x, bounds.bottom));
    }

    // Horizontal lines
    for (let y = bounds.top; y <= bounds.bottom; y += gridSize) {
      path.moveTo(new paper.Point(bounds.left, y));
      path.lineTo(new paper.Point(bounds.right, y));
    }
  }

  private handleKeyDown(event: paper.KeyEvent): void {
    if (event.key === 'delete' || event.key === 'backspace') {
      this.deleteSelected();
    } else if (event.key === 'escape') {
      this.clearSelection();
      if (this.isDrawing) {
        this.cancelDrawing();
      }
    } else if (event.modifiers.control) {
      switch (event.key) {
        case 'c':
          this.copySelected();
          break;
        case 'v':
          this.paste();
          break;
        case 'z':
          event.modifiers.shift ? this.redo() : this.undo();
          break;
        case 'a':
          this.selectAll();
          break;
      }
    }
  }

  private handleKeyUp(event: paper.KeyEvent): void {
    // Handle key up events if needed
  }

  private handleCanvasDrag(event: any): void {
    if (this.currentTool !== 'select') return;
    
    this.panOffset.x += event.dx;
    this.panOffset.y += event.dy;
    
    this.scope.view.center = this.scope.view.center.add(new paper.Point(event.dx, event.dy));
    this.drawGrid();
  }

  private handleGesture(event: any): void {
    // Handle zoom gestures
    if (event.ds) {
      this.zoom(event.ds, event.box.center);
    }
  }

  public zoom(delta: number, center?: { x: number; y: number }): void {
    const factor = 1 + delta * 0.1;
    const newScale = this.scale * factor;
    
    if (newScale < 0.1 || newScale > 10) return;
    
    this.scale = newScale;
    
    const centerPoint = center ? 
      new paper.Point(center.x, center.y) : 
      this.scope.view.center;
    
    this.scope.view.scale(factor, centerPoint);
    this.drawGrid();
  }

  public pan(dx: number, dy: number): void {
    this.panOffset.x += dx;
    this.panOffset.y += dy;
    
    this.scope.view.center = this.scope.view.center.add(new paper.Point(dx, dy));
    this.drawGrid();
  }

  public resetView(): void {
    this.scope.view.center = new paper.Point(0, 0);
    this.scope.view.zoom = 1;
    this.scale = 1;
    this.panOffset = new paper.Point(0, 0);
    this.drawGrid();
  }

  private deleteSelected(): void {
    this.selectedElements.forEach(id => {
      const element = this.elements.get(id);
      if (element && !element.locked) {
        element.paperItem.remove();
        this.elements.delete(id);
      }
    });
    
    this.selectedElements.clear();
    this.saveState();
    this.scope.view.draw();
  }

  private copySelected(): void {
    this.clipboard = Array.from(this.selectedElements)
      .map(id => this.elements.get(id))
      .filter(element => element !== undefined) as DrawingElement[];
  }

  private paste(): void {
    if (this.clipboard.length === 0) return;
    
    this.clearSelection();
    
    this.clipboard.forEach(element => {
      const clone = element.paperItem.clone();
      clone.position = clone.position.add(new paper.Point(20, 20));
      
      const newElement: DrawingElement = {
        ...element,
        id: uuidv4(),
        paperItem: clone,
        selected: true
      };
      
      clone.data = { elementId: newElement.id };
      this.elements.set(newElement.id, newElement);
      this.selectedElements.add(newElement.id);
    });
    
    this.saveState();
    this.scope.view.draw();
  }

  private selectAll(): void {
    this.clearSelection();
    
    this.elements.forEach((element, id) => {
      if (element.visible && !element.locked) {
        this.selectElement(id);
      }
    });
  }

  private cancelDrawing(): void {
    if (this.currentPath) {
      this.currentPath.remove();
      this.currentPath = null;
    }
    this.isDrawing = false;
  }

  private saveState(): void {
    // Save current state for undo/redo
    const state = JSON.stringify({
      elements: Array.from(this.elements.entries()),
      scale: this.scale,
      panOffset: { x: this.panOffset.x, y: this.panOffset.y }
    });
    
    this.undoStack.push(state);
    this.redoStack = []; // Clear redo stack when new action is performed
    
    // Limit undo stack size
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
  }

  private undo(): void {
    if (this.undoStack.length === 0) return;
    
    const currentState = JSON.stringify({
      elements: Array.from(this.elements.entries()),
      scale: this.scale,
      panOffset: { x: this.panOffset.x, y: this.panOffset.y }
    });
    
    this.redoStack.push(currentState);
    
    const previousState = this.undoStack.pop()!;
    this.loadState(previousState);
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;
    
    const currentState = JSON.stringify({
      elements: Array.from(this.elements.entries()),
      scale: this.scale,
      panOffset: { x: this.panOffset.x, y: this.panOffset.y }
    });
    
    this.undoStack.push(currentState);
    
    const nextState = this.redoStack.pop()!;
    this.loadState(nextState);
  }

  private loadState(stateJson: string): void {
    // This would need more complex implementation to properly restore Paper.js items
    console.log('Loading state:', stateJson);
  }

  public updateGridSettings(settings: Partial<GridSettings>): void {
    this.gridSettings = { ...this.gridSettings, ...settings };
    this.drawGrid();
  }

  public getSelectedElements(): DrawingElement[] {
    return Array.from(this.selectedElements)
      .map(id => this.elements.get(id))
      .filter(element => element !== undefined) as DrawingElement[];
  }

  public getElementById(id: string): DrawingElement | undefined {
    return this.elements.get(id);
  }

  public getAllElements(): DrawingElement[] {
    return Array.from(this.elements.values());
  }

  public exportToSVG(): string {
    return this.scope.project.exportSVG({ asString: true }) as string;
  }

  public exportToPNG(): string {
    return this.canvas.toDataURL('image/png');
  }

  public destroy(): void {
    this.scope.project.clear();
    interact(this.canvas).unset();
  }
}