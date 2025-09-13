import React, { useState, useMemo } from 'react';
import { DrawingElement } from '../../services/blueprint/DrawingEngine';

interface LayersPanelProps {
  elements: DrawingElement[];
  onElementVisibilityChange: (elementId: string, visible: boolean) => void;
  onElementLockChange: (elementId: string, locked: boolean) => void;
  onElementDelete?: (elementId: string) => void;
  onLayerReorder?: (fromIndex: number, toIndex: number) => void;
}

interface LayerGroup {
  type: string;
  name: string;
  icon: string;
  elements: DrawingElement[];
  visible: boolean;
  locked: boolean;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  onElementVisibilityChange,
  onElementLockChange,
  onElementDelete,
  onLayerReorder: _onLayerReorder
}) => {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set(['walls', 'doors', 'windows']));
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());

  const layerGroups: LayerGroup[] = useMemo(() => {
    const groups: Record<string, LayerGroup> = {
      walls: { type: 'wall', name: 'Walls', icon: '╱', elements: [], visible: true, locked: false },
      doors: { type: 'door', name: 'Doors', icon: '⌒', elements: [], visible: true, locked: false },
      windows: { type: 'window', name: 'Windows', icon: '⬜', elements: [], visible: true, locked: false },
      rooms: { type: 'room', name: 'Rooms', icon: '▢', elements: [], visible: true, locked: false },
      text: { type: 'text', name: 'Text', icon: 'T', elements: [], visible: true, locked: false },
      evidence: { type: 'evidence-pin', name: 'Evidence', icon: '📍', elements: [], visible: true, locked: false }
    };

    elements.forEach(element => {
      const group = groups[element.type === 'evidence-pin' ? 'evidence' : `${element.type}s`];
      if (group) {
        group.elements.push(element);
        if (!element.visible) group.visible = false;
        if (element.locked) group.locked = true;
      }
    });

    return Object.values(groups).filter(group => group.elements.length > 0);
  }, [elements]);

  const toggleLayerExpansion = (layerType: string) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerType)) {
        newSet.delete(layerType);
      } else {
        newSet.add(layerType);
      }
      return newSet;
    });
  };

  const toggleLayerVisibility = (layer: LayerGroup) => {
    const newVisibility = !layer.visible;
    layer.elements.forEach(element => {
      onElementVisibilityChange(element.id, newVisibility);
    });
  };

  const toggleLayerLock = (layer: LayerGroup) => {
    const newLockState = !layer.locked;
    layer.elements.forEach(element => {
      onElementLockChange(element.id, newLockState);
    });
  };

  const toggleElementSelection = (elementId: string) => {
    setSelectedElements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(elementId)) {
        newSet.delete(elementId);
      } else {
        newSet.add(elementId);
      }
      return newSet;
    });
  };

  const getElementDisplayName = (element: DrawingElement) => {
    if (element.properties.name) return element.properties.name;
    if (element.properties.text) return `"${element.properties.text}"`;
    return `${element.type.charAt(0).toUpperCase() + element.type.slice(1)} ${element.id.slice(-4)}`;
  };

  return (
    <div className="layers-panel">
      <div className="panel-header">
        <h3>Layers</h3>
        <div className="layer-actions">
          <button className="action-btn" title="Show All">
            👁️
          </button>
          <button className="action-btn" title="Hide All">
            🙈
          </button>
          <button className="action-btn" title="Lock All">
            🔒
          </button>
        </div>
      </div>

      <div className="layers-list">
        {layerGroups.map(layer => (
          <div key={layer.type} className="layer-group">
            <div className="layer-header">
              <button
                className={`expand-btn ${expandedLayers.has(layer.type) ? 'expanded' : ''}`}
                onClick={() => toggleLayerExpansion(layer.type)}
              >
                ▶
              </button>
              
              <span className="layer-icon">{layer.icon}</span>
              
              <span className="layer-name">
                {layer.name} ({layer.elements.length})
              </span>

              <div className="layer-controls">
                <button
                  className={`control-btn ${layer.visible ? 'active' : ''}`}
                  onClick={() => toggleLayerVisibility(layer)}
                  title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                >
                  {layer.visible ? '👁️' : '🙈'}
                </button>
                <button
                  className={`control-btn ${layer.locked ? 'active' : ''}`}
                  onClick={() => toggleLayerLock(layer)}
                  title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>
              </div>
            </div>

            {expandedLayers.has(layer.type) && (
              <div className="layer-elements">
                {layer.elements.map(element => (
                  <div
                    key={element.id}
                    className={`element-item ${selectedElements.has(element.id) ? 'selected' : ''}`}
                    onClick={() => toggleElementSelection(element.id)}
                  >
                    <div className="element-info">
                      <span className="element-name">
                        {getElementDisplayName(element)}
                      </span>
                      {element.properties.material && (
                        <span className="element-material">
                          {element.properties.material}
                        </span>
                      )}
                    </div>

                    <div className="element-controls">
                      <button
                        className={`control-btn small ${element.visible !== false ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onElementVisibilityChange(element.id, !element.visible);
                        }}
                        title={element.visible !== false ? 'Hide Element' : 'Show Element'}
                      >
                        {element.visible !== false ? '👁️' : '🙈'}
                      </button>
                      <button
                        className={`control-btn small ${element.locked ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onElementLockChange(element.id, !element.locked);
                        }}
                        title={element.locked ? 'Unlock Element' : 'Lock Element'}
                      >
                        {element.locked ? '🔒' : '🔓'}
                      </button>
                      {onElementDelete && (
                        <button
                          className="control-btn small delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onElementDelete(element.id);
                          }}
                          title="Delete Element"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="layer-footer">
        <button className="footer-btn">
          <span>➕</span>
          New Layer
        </button>
        <button className="footer-btn">
          <span>📁</span>
          Import
        </button>
      </div>

      <style jsx>{`
        .layers-panel {
          padding: 16px;
          background: var(--surface-secondary, #1e1e1e);
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .panel-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
        }

        .layer-actions {
          display: flex;
          gap: 4px;
        }

        .action-btn {
          width: 28px;
          height: 28px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.75rem;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .layers-list {
          flex: 1;
          overflow-y: auto;
        }

        .layer-group {
          margin-bottom: 8px;
          border: 1px solid var(--border-color, #333333);
          border-radius: 6px;
          background: var(--surface-tertiary, #2d2d2d);
        }

        .layer-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .layer-header:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .expand-btn {
          background: none;
          border: none;
          color: var(--text-secondary, #aaaaaa);
          cursor: pointer;
          font-size: 0.75rem;
          transform: rotate(0deg);
          transition: transform 0.2s ease;
          margin-right: 8px;
        }

        .expand-btn.expanded {
          transform: rotate(90deg);
        }

        .layer-icon {
          font-size: 1rem;
          margin-right: 8px;
        }

        .layer-name {
          flex: 1;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary, #ffffff);
        }

        .layer-controls {
          display: flex;
          gap: 4px;
        }

        .control-btn {
          width: 24px;
          height: 24px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.75rem;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .control-btn:hover {
          background: var(--surface-hover, #3d3d3d);
          border-color: var(--border-color, #444444);
        }

        .control-btn.active {
          background: var(--accent-color, #bb86fc);
          border-color: var(--accent-color, #bb86fc);
        }

        .control-btn.small {
          width: 20px;
          height: 20px;
          font-size: 0.625rem;
        }

        .control-btn.delete {
          color: #ff6b6b;
        }

        .control-btn.delete:hover {
          background: rgba(255, 107, 107, 0.1);
          border-color: #ff6b6b;
        }

        .layer-elements {
          border-top: 1px solid var(--border-color, #333333);
          background: var(--surface-primary, #1a1a1a);
        }

        .element-item {
          display: flex;
          align-items: center;
          padding: 6px 12px 6px 32px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .element-item:last-child {
          border-bottom: none;
        }

        .element-item:hover {
          background: var(--surface-hover, #2d2d2d);
        }

        .element-item.selected {
          background: rgba(187, 134, 252, 0.1);
          border-left: 3px solid var(--accent-color, #bb86fc);
        }

        .element-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .element-name {
          font-size: 0.8rem;
          color: var(--text-primary, #ffffff);
          font-weight: 500;
        }

        .element-material {
          font-size: 0.7rem;
          color: var(--text-secondary, #aaaaaa);
          font-style: italic;
        }

        .element-controls {
          display: flex;
          gap: 2px;
          opacity: 0.7;
          transition: opacity 0.2s ease;
        }

        .element-item:hover .element-controls {
          opacity: 1;
        }

        .layer-footer {
          display: flex;
          gap: 8px;
          padding-top: 12px;
          margin-top: 12px;
          border-top: 1px solid var(--border-color, #333333);
        }

        .footer-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .footer-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .footer-btn span {
          font-size: 0.875rem;
        }

        /* Material 3 Dark Theme Variables */
        :root {
          --surface-primary: #121212;
          --surface-secondary: #1e1e1e;
          --surface-tertiary: #2d2d2d;
          --surface-hover: #3d3d3d;
          --text-primary: #ffffff;
          --text-secondary: #aaaaaa;
          --border-color: #333333;
          --accent-color: #bb86fc;
        }

        /* Scrollbar styling */
        .layers-list::-webkit-scrollbar {
          width: 6px;
        }

        .layers-list::-webkit-scrollbar-track {
          background: var(--surface-primary, #121212);
        }

        .layers-list::-webkit-scrollbar-thumb {
          background: var(--border-color, #333333);
          border-radius: 3px;
        }

        .layers-list::-webkit-scrollbar-thumb:hover {
          background: var(--text-secondary, #aaaaaa);
        }
      `}</style>
    </div>
  );
};