/**
 * Layer Stack
 * Non-destructive layer management system
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ImageLayer, ImageAdjustments } from '../types';
import { logger } from '../../../utils/logger';

export class LayerStack extends EventEmitter {
  private layers: Map<string, ImageLayer> = new Map();
  private layerOrder: string[] = [];
  private activeLayerId: string | null = null;
  private maxLayers: number = 32;

  constructor() {
    super();
  }

  /**
   * Create a new layer
   */
  createLayer(
    name: string,
    imageData: ImageData,
    options?: Partial<ImageLayer>
  ): ImageLayer {
    if (this.layers.size >= this.maxLayers) {
      throw new Error(`Maximum layer limit (${this.maxLayers}) reached`);
    }

    const layer: ImageLayer = {
      id: uuidv4(),
      name,
      imageData: this.cloneImageData(imageData),
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      locked: false,
      ...options
    };

    this.layers.set(layer.id, layer);
    this.layerOrder.push(layer.id);

    this.emit('layerAdded', layer);
    logger.info('Layer created', { id: layer.id, name });

    return layer;
  }

  /**
   * Add existing layer
   */
  addLayer(layer: ImageLayer, index?: number): void {
    if (this.layers.has(layer.id)) {
      throw new Error('Layer already exists');
    }

    this.layers.set(layer.id, layer);

    if (index !== undefined && index >= 0 && index <= this.layerOrder.length) {
      this.layerOrder.splice(index, 0, layer.id);
    } else {
      this.layerOrder.push(layer.id);
    }

    this.emit('layerAdded', layer);
  }

  /**
   * Remove layer
   */
  removeLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    if (layer.locked) {
      throw new Error('Cannot remove locked layer');
    }

    this.layers.delete(layerId);
    const index = this.layerOrder.indexOf(layerId);
    if (index > -1) {
      this.layerOrder.splice(index, 1);
    }

    if (this.activeLayerId === layerId) {
      this.activeLayerId = this.layerOrder.length > 0 ? this.layerOrder[0] : null;
    }

    this.emit('layerRemoved', layer);
    logger.info('Layer removed', { id: layerId });
  }

  /**
   * Update layer
   */
  updateLayer(layerId: string, updates: Partial<ImageLayer>): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    if (layer.locked && updates.imageData) {
      throw new Error('Cannot modify locked layer');
    }

    Object.assign(layer, updates);
    this.emit('layerUpdated', layer);
  }

  /**
   * Move layer in stack
   */
  moveLayer(layerId: string, newIndex: number): void {
    const currentIndex = this.layerOrder.indexOf(layerId);
    if (currentIndex === -1) return;

    this.layerOrder.splice(currentIndex, 1);
    this.layerOrder.splice(newIndex, 0, layerId);

    this.emit('layerMoved', { layerId, from: currentIndex, to: newIndex });
  }

  /**
   * Duplicate layer
   */
  duplicateLayer(layerId: string): ImageLayer | null {
    const layer = this.layers.get(layerId);
    if (!layer) return null;

    const duplicate = this.createLayer(
      `${layer.name} copy`,
      layer.imageData,
      {
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        adjustments: layer.adjustments ? { ...layer.adjustments } : undefined
      }
    );

    const index = this.layerOrder.indexOf(layerId);
    this.moveLayer(duplicate.id, index + 1);

    return duplicate;
  }

  /**
   * Merge layers
   */
  mergeLayers(layerIds: string[], name?: string): ImageLayer | null {
    if (layerIds.length < 2) return null;

    const layersToMerge = layerIds
      .map(id => this.layers.get(id))
      .filter(layer => layer !== undefined) as ImageLayer[];

    if (layersToMerge.length < 2) return null;

    // Create merged canvas
    const canvas = document.createElement('canvas');
    const firstLayer = layersToMerge[0];
    canvas.width = firstLayer.imageData.width;
    canvas.height = firstLayer.imageData.height;
    const ctx = canvas.getContext('2d')!;

    // Merge layers
    for (const layer of layersToMerge) {
      if (!layer.visible) continue;

      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);

      ctx.drawImage(tempCanvas, 0, 0);
    }

    // Get merged image data
    const mergedData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Create new layer
    const mergedLayer = this.createLayer(
      name || 'Merged Layer',
      mergedData
    );

    // Remove original layers
    for (const id of layerIds) {
      this.removeLayer(id);
    }

    return mergedLayer;
  }

  /**
   * Flatten all layers
   */
  flatten(): ImageData | null {
    if (this.layers.size === 0) return null;

    const canvas = document.createElement('canvas');
    let width = 0;
    let height = 0;

    // Find maximum dimensions
    this.layers.forEach(layer => {
      width = Math.max(width, layer.imageData.width);
      height = Math.max(height, layer.imageData.height);
    });

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Draw all visible layers
    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (!layer || !layer.visible) continue;

      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);

      ctx.drawImage(tempCanvas, 0, 0);
    }

    return ctx.getImageData(0, 0, width, height);
  }

  /**
   * Apply adjustments to layer
   */
  applyAdjustmentsToLayer(layerId: string, adjustments: ImageAdjustments): void {
    const layer = this.layers.get(layerId);
    if (!layer || layer.locked) return;

    layer.adjustments = { ...adjustments };
    this.emit('layerAdjusted', { layerId, adjustments });
  }

  /**
   * Set layer visibility
   */
  setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.visible = visible;
    this.emit('layerVisibilityChanged', { layerId, visible });
  }

  /**
   * Set layer opacity
   */
  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.opacity = Math.max(0, Math.min(1, opacity));
    this.emit('layerOpacityChanged', { layerId, opacity: layer.opacity });
  }

  /**
   * Set layer blend mode
   */
  setLayerBlendMode(layerId: string, blendMode: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.blendMode = blendMode;
    this.emit('layerBlendModeChanged', { layerId, blendMode });
  }

  /**
   * Lock/unlock layer
   */
  setLayerLocked(layerId: string, locked: boolean): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.locked = locked;
    this.emit('layerLockChanged', { layerId, locked });
  }

  /**
   * Set active layer
   */
  setActiveLayer(layerId: string | null): void {
    if (layerId && !this.layers.has(layerId)) return;

    this.activeLayerId = layerId;
    this.emit('activeLayerChanged', layerId);
  }

  /**
   * Get active layer
   */
  getActiveLayer(): ImageLayer | null {
    if (!this.activeLayerId) return null;
    return this.layers.get(this.activeLayerId) || null;
  }

  /**
   * Get layer by ID
   */
  getLayer(layerId: string): ImageLayer | undefined {
    return this.layers.get(layerId);
  }

  /**
   * Get all layers in order
   */
  getLayers(): ImageLayer[] {
    return this.layerOrder
      .map(id => this.layers.get(id))
      .filter(layer => layer !== undefined) as ImageLayer[];
  }

  /**
   * Get layer count
   */
  getLayerCount(): number {
    return this.layers.size;
  }

  /**
   * Clear all layers
   */
  clear(): void {
    this.layers.clear();
    this.layerOrder = [];
    this.activeLayerId = null;
    this.emit('stackCleared');
  }

  /**
   * Clone ImageData
   */
  private cloneImageData(imageData: ImageData): ImageData {
    return new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
  }

  /**
   * Export layer stack state
   */
  exportState(): any {
    return {
      layers: Array.from(this.layers.entries()),
      layerOrder: [...this.layerOrder],
      activeLayerId: this.activeLayerId
    };
  }

  /**
   * Import layer stack state
   */
  importState(state: any): void {
    this.clear();

    if (state.layers) {
      for (const [id, layer] of state.layers) {
        this.layers.set(id, layer);
      }
    }

    if (state.layerOrder) {
      this.layerOrder = [...state.layerOrder];
    }

    if (state.activeLayerId) {
      this.activeLayerId = state.activeLayerId;
    }

    this.emit('stackImported');
  }
}