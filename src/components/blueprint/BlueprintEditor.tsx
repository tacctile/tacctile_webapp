import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingEngine, DrawingTool, DrawingElement, GridSettings } from '../../services/blueprint/DrawingEngine';
import { ToolPalette } from './ToolPalette';
import { PropertiesPanel } from './PropertiesPanel';
import { LayersPanel } from './LayersPanel';
import { ZoomControls } from './ZoomControls';
import { EvidencePreviewModal } from './EvidencePreviewModal';
import { PositionOverlay } from './PositionOverlay';
import { TeamPanel } from './TeamPanel';
import { InvestigatorProfile } from '../../services/realtime/WebSocketService';
import { getPositionTracker, PositionOptions } from '../../services/realtime/PositionTracker';

interface BlueprintEditorProps {
  className?: string;
  onSave?: (blueprint: unknown) => void;
}

export const BlueprintEditor: React.FC<BlueprintEditorProps> = ({
  className,
  onSave
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingEngineRef = useRef<DrawingEngine | null>(null);
  
  const [currentTool, setCurrentTool] = useState<DrawingTool>('select');
  const [selectedElements] = useState<DrawingElement[]>([]);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true);
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  const [gridSettings, setGridSettings] = useState<GridSettings>({
    size: 20,
    visible: true,
    snapEnabled: true,
    color: '#333333',
    opacity: 0.3
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [evidencePreview, setEvidencePreview] = useState<{
    element: DrawingElement;
    visible: boolean;
  } | null>(null);
  
  // Real-time tracking state
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [currentInvestigator, setCurrentInvestigator] = useState<InvestigatorProfile | null>(null);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [panOffset] = useState({ x: 0, y: 0 });
  const [trackingOptions, setTrackingOptions] = useState({
    showTrails: true,
    showNames: true,
    trailLength: 50
  });

  // Initialize drawing engine
  useEffect(() => {
    if (canvasRef.current && !drawingEngineRef.current) {
      drawingEngineRef.current = new DrawingEngine(canvasRef.current);
      
      // Setup event listeners
      setupEventListeners();
    }

    return () => {
      if (drawingEngineRef.current) {
        drawingEngineRef.current.destroy();
        drawingEngineRef.current = null;
      }
    };
  }, []);

  const setupEventListeners = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingEngineRef.current) return;

    // Handle selection changes
    // const handleSelectionChange = () => {
    //   if (drawingEngineRef.current) {
    //     const selected = drawingEngineRef.current.getSelectedElements();
    //     setSelectedElements(selected);
    //   }
    // };

    // Handle evidence pin clicks
    const handleEvidenceClick = (event: MouseEvent) => {
      // This would be integrated with the drawing engine's click handling
      // For now, we'll simulate evidence preview
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Check if click is on evidence pin
      if (drawingEngineRef.current) {
        const elements = drawingEngineRef.current.getAllElements();
        const evidencePin = elements.find(el => 
          el.type === 'evidence-pin' && 
          // Simplified hit detection
          Math.abs(el.paperItem.position.x - x) < 15 &&
          Math.abs(el.paperItem.position.y - y) < 15
        );
        
        if (evidencePin) {
          setEvidencePreview({
            element: evidencePin,
            visible: true
          });
        }
      }
    };

    canvas.addEventListener('click', handleEvidenceClick);
    
    // Cleanup
    return () => {
      canvas.removeEventListener('click', handleEvidenceClick);
    };
  }, []);

  const handleToolChange = (tool: DrawingTool) => {
    setCurrentTool(tool);
    if (drawingEngineRef.current) {
      drawingEngineRef.current.setTool(tool);
    }
  };

  const handleGridSettingsChange = (newSettings: Partial<GridSettings>) => {
    const updatedSettings = { ...gridSettings, ...newSettings };
    setGridSettings(updatedSettings);
    
    if (drawingEngineRef.current) {
      drawingEngineRef.current.updateGridSettings(updatedSettings);
    }
  };

  const handleZoom = (delta: number, center?: { x: number; y: number }) => {
    if (drawingEngineRef.current) {
      drawingEngineRef.current.zoom(delta, center);
      // Update zoom level for UI
      setZoomLevel(prev => Math.max(0.1, Math.min(10, prev * (1 + delta * 0.1))));
    }
  };

  // const handlePan = (_dx: number, _dy: number) => {
  //   if (drawingEngineRef.current) {
  //     drawingEngineRef.current.pan(_dx, _dy);
  //   }
  // };

  const handleResetView = () => {
    if (drawingEngineRef.current) {
      drawingEngineRef.current.resetView();
      setZoomLevel(1);
    }
  };

  const handleSave = () => {
    if (!drawingEngineRef.current || !onSave) return;
    
    const blueprint = {
      elements: drawingEngineRef.current.getAllElements(),
      gridSettings,
      timestamp: new Date(),
      version: '1.0'
    };
    
    onSave(blueprint);
  };

  const handleExportSVG = () => {
    if (!drawingEngineRef.current) return;
    
    const svg = drawingEngineRef.current.exportToSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint-${Date.now()}.svg`;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    if (!drawingEngineRef.current) return;
    
    const png = drawingEngineRef.current.exportToPNG();
    const a = document.createElement('a');
    a.href = png;
    a.download = `blueprint-${Date.now()}.png`;
    a.click();
  };

  // Real-time tracking handlers
  const handleTrackingToggle = async (enabled: boolean) => {
    if (enabled && currentInvestigator) {
      try {
        const positionTracker = getPositionTracker();
        
        // Enable click-to-track on the canvas
        if (canvasRef.current) {
          positionTracker.enableClickToTrack(canvasRef.current, 'current-blueprint');
        }
        
        setIsTrackingEnabled(true);
      } catch (error) {
        console.error('Failed to start tracking:', error);
      }
    } else {
      const positionTracker = getPositionTracker();
      
      // Disable click-to-track
      if (canvasRef.current) {
        positionTracker.disableClickToTrack(canvasRef.current);
      }
      
      setIsTrackingEnabled(false);
    }
  };

  const handleTrackingOptionsChange = (options: Partial<PositionOptions & typeof trackingOptions>) => {
    setTrackingOptions(prev => ({ ...prev, ...options }));
  };

  const handleInvestigatorClick = (investigator: InvestigatorProfile) => {
    // Center view on investigator position
    // This would require getting the current position from the position tracker
    console.log('Clicked investigator:', investigator.name);
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle global keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault();
          handleSave();
          break;
        case '1':
          event.preventDefault();
          handleToolChange('select');
          break;
        case '2':
          event.preventDefault();
          handleToolChange('wall');
          break;
        case '3':
          event.preventDefault();
          handleToolChange('door');
          break;
        case '4':
          event.preventDefault();
          handleToolChange('window');
          break;
        case '5':
          event.preventDefault();
          handleToolChange('room');
          break;
      }
    } else {
      switch (event.key) {
        case 'Escape':
          setCurrentTool('select');
          if (drawingEngineRef.current) {
            drawingEngineRef.current.setTool('select');
          }
          break;
        case 'g':
          handleGridSettingsChange({ visible: !gridSettings.visible });
          break;
        case 'h':
          handleGridSettingsChange({ snapEnabled: !gridSettings.snapEnabled });
          break;
      }
    }
  }, [gridSettings, handleSave]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={`blueprint-editor ${className || ''}`}>
      {/* Header Toolbar */}
      <div className="blueprint-header">
        <div className="header-title">
          <h2>Blueprint Editor</h2>
          <span className="file-status">Untitled Blueprint</span>
        </div>
        
        <div className="header-actions">
          <button className="header-btn" onClick={() => setShowTeamPanel(!showTeamPanel)}>
            👥 Team
          </button>
          <button className="header-btn" onClick={() => setShowLayersPanel(!showLayersPanel)}>
            Layers
          </button>
          <button className="header-btn" onClick={() => setShowPropertiesPanel(!showPropertiesPanel)}>
            Properties
          </button>
          <div className="header-divider" />
          <button className="header-btn" onClick={handleSave}>
            Save
          </button>
          <button className="header-btn" onClick={handleExportSVG}>
            Export SVG
          </button>
          <button className="header-btn" onClick={handleExportPNG}>
            Export PNG
          </button>
        </div>
      </div>

      {/* Main Editor Layout */}
      <div className="blueprint-workspace">
        {/* Left Sidebar - Tools */}
        <div className="left-sidebar">
          <ToolPalette
            currentTool={currentTool}
            onToolChange={handleToolChange}
          />
          
          <div className="grid-controls">
            <h3>Grid Settings</h3>
            <label className="control-row">
              <input
                type="checkbox"
                checked={gridSettings.visible}
                onChange={(e) => handleGridSettingsChange({ visible: e.target.checked })}
              />
              Show Grid
            </label>
            <label className="control-row">
              <input
                type="checkbox"
                checked={gridSettings.snapEnabled}
                onChange={(e) => handleGridSettingsChange({ snapEnabled: e.target.checked })}
              />
              Snap to Grid
            </label>
            <label className="control-row">
              Grid Size:
              <input
                type="number"
                value={gridSettings.size}
                onChange={(e) => handleGridSettingsChange({ size: parseInt(e.target.value) })}
                min="5"
                max="100"
                step="5"
              />
            </label>
          </div>
        </div>

        {/* Center Canvas Area */}
        <div className="canvas-container">
          <div className="canvas-header">
            <ZoomControls
              zoomLevel={zoomLevel}
              onZoomIn={() => handleZoom(1)}
              onZoomOut={() => handleZoom(-1)}
              onResetView={handleResetView}
              onFitToScreen={() => {/* Implement fit to screen */}}
            />
            
            <div className="canvas-info">
              <span>Tool: {currentTool}</span>
              <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
              <span>Selected: {selectedElements.length}</span>
            </div>
          </div>
          
          <div className="canvas-wrapper">
            <canvas
              ref={canvasRef}
              className="blueprint-canvas"
              width="1200"
              height="800"
            />
            {/* Position Overlay for real-time tracking */}
            <PositionOverlay
              canvasWidth={1200}
              canvasHeight={800}
              zoomLevel={zoomLevel}
              panOffset={panOffset}
              showTrails={trackingOptions.showTrails}
              showInvestigatorNames={trackingOptions.showNames}
              trailLength={trackingOptions.trailLength}
              onInvestigatorClick={handleInvestigatorClick}
            />
          </div>
        </div>

        {/* Right Sidebar - Properties and Layers */}
        <div className="right-sidebar">
          {showPropertiesPanel && (
            <PropertiesPanel
              selectedElements={selectedElements}
              onElementUpdate={(elementId, properties) => {
                // Update element properties through drawing engine
                const element = drawingEngineRef.current?.getElementById(elementId);
                if (element) {
                  Object.assign(element.properties, properties);
                  // Trigger visual update
                }
              }}
            />
          )}
          
          {showLayersPanel && (
            <LayersPanel
              elements={drawingEngineRef.current?.getAllElements() || []}
              onElementVisibilityChange={(elementId, visible) => {
                const element = drawingEngineRef.current?.getElementById(elementId);
                if (element) {
                  element.visible = visible;
                  element.paperItem.visible = visible;
                }
              }}
              onElementLockChange={(elementId, locked) => {
                const element = drawingEngineRef.current?.getElementById(elementId);
                if (element) {
                  element.locked = locked;
                }
              }}
            />
          )}

          {showTeamPanel && (
            <TeamPanel
              currentInvestigator={currentInvestigator}
              onInvestigatorChange={setCurrentInvestigator}
              onTrackingToggle={handleTrackingToggle}
              onTrackingOptionsChange={handleTrackingOptionsChange}
              isTrackingEnabled={isTrackingEnabled}
            />
          )}
        </div>
      </div>

      {/* Evidence Preview Modal */}
      {evidencePreview && (
        <EvidencePreviewModal
          element={evidencePreview.element}
          visible={evidencePreview.visible}
          onClose={() => setEvidencePreview(null)}
        />
      )}

      <style jsx>{`
        .blueprint-editor {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--surface-primary, #121212);
          color: var(--text-primary, #ffffff);
        }

        .blueprint-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: var(--surface-secondary, #1e1e1e);
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .header-title h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .file-status {
          font-size: 0.875rem;
          color: var(--text-secondary, #aaaaaa);
          margin-left: 12px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-btn {
          padding: 8px 16px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .header-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .header-divider {
          width: 1px;
          height: 24px;
          background: var(--border-color, #444444);
          margin: 0 8px;
        }

        .blueprint-workspace {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .left-sidebar {
          width: 280px;
          background: var(--surface-secondary, #1e1e1e);
          border-right: 1px solid var(--border-color, #333333);
          overflow-y: auto;
        }

        .grid-controls {
          padding: 16px;
          border-top: 1px solid var(--border-color, #333333);
        }

        .grid-controls h3 {
          margin: 0 0 12px 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
        }

        .control-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .control-row input[type="checkbox"] {
          margin-right: 8px;
        }

        .control-row input[type="number"] {
          width: 60px;
          padding: 4px 8px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          color: var(--text-primary, #ffffff);
          font-size: 0.875rem;
        }

        .canvas-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--surface-primary, #181818);
        }

        .canvas-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: var(--surface-secondary, #1e1e1e);
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .canvas-info {
          display: flex;
          gap: 24px;
          font-size: 0.875rem;
          color: var(--text-secondary, #aaaaaa);
        }

        .canvas-wrapper {
          flex: 1;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .blueprint-canvas {
          background: var(--surface-primary, #181818);
          cursor: crosshair;
          border-radius: 4px;
        }

        .right-sidebar {
          width: 320px;
          background: var(--surface-secondary, #1e1e1e);
          border-left: 1px solid var(--border-color, #333333);
          overflow-y: auto;
        }

        /* Dark theme Material 3 colors */
        :root {
          --surface-primary: #121212;
          --surface-secondary: #1e1e1e;
          --surface-tertiary: #2d2d2d;
          --surface-hover: #3d3d3d;
          --text-primary: #ffffff;
          --text-secondary: #aaaaaa;
          --border-color: #333333;
          --accent-color: #bb86fc;
          --accent-hover: #985eff;
        }

        /* Responsive adjustments */
        @media (max-width: 1200px) {
          .left-sidebar, .right-sidebar {
            width: 240px;
          }
        }

        @media (max-width: 900px) {
          .blueprint-workspace {
            flex-direction: column;
          }
          
          .left-sidebar, .right-sidebar {
            width: 100%;
            height: 200px;
          }
        }
      `}</style>
    </div>
  );
};