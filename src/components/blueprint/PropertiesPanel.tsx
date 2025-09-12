import React, { useState, useEffect } from 'react';
import { DrawingElement } from '../../services/blueprint/DrawingEngine';

interface PropertiesPanelProps {
  selectedElements: DrawingElement[];
  onElementUpdate: (elementId: string, properties: Record<string, any>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElements,
  onElementUpdate
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['general']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handlePropertyChange = (elementId: string, key: string, value: any) => {
    const element = selectedElements.find(el => el.id === elementId);
    if (element) {
      const updatedProperties = { ...element.properties, [key]: value };
      onElementUpdate(elementId, updatedProperties);
    }
  };

  const renderNoSelection = () => (
    <div className="no-selection">
      <div className="no-selection-icon">📝</div>
      <h3>No Selection</h3>
      <p>Select an element to view and edit its properties.</p>
    </div>
  );

  const renderMultipleSelection = () => (
    <div className="multiple-selection">
      <div className="selection-info">
        <h3>{selectedElements.length} Elements Selected</h3>
        <div className="selection-types">
          {Array.from(new Set(selectedElements.map(el => el.type))).map(type => (
            <span key={type} className="type-chip">{type}</span>
          ))}
        </div>
      </div>

      <div className="bulk-actions">
        <h4>Bulk Actions</h4>
        <div className="action-buttons">
          <button className="action-btn">Delete All</button>
          <button className="action-btn">Group</button>
          <button className="action-btn">Align</button>
        </div>
      </div>
    </div>
  );

  const renderElementProperties = (element: DrawingElement) => {
    const sections = [
      {
        id: 'general',
        title: 'General Properties',
        content: renderGeneralProperties(element)
      },
      {
        id: 'appearance',
        title: 'Appearance',
        content: renderAppearanceProperties(element)
      },
      {
        id: 'specific',
        title: `${element.type} Properties`,
        content: renderSpecificProperties(element)
      }
    ];

    return (
      <div className="element-properties">
        <div className="element-header">
          <div className="element-type-icon">
            {getTypeIcon(element.type)}
          </div>
          <div className="element-info">
            <h3>{getTypeName(element.type)}</h3>
            <span className="element-id">ID: {element.id.slice(-8)}</span>
          </div>
        </div>

        {sections.map(section => (
          <div key={section.id} className="property-section">
            <button
              className="section-header"
              onClick={() => toggleSection(section.id)}
            >
              <span>{section.title}</span>
              <span className={`expand-icon ${expandedSections.has(section.id) ? 'expanded' : ''}`}>
                ▼
              </span>
            </button>
            {expandedSections.has(section.id) && (
              <div className="section-content">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderGeneralProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Layer</label>
        <select 
          value={element.layer} 
          onChange={(e) => handlePropertyChange(element.id, 'layer', e.target.value)}
        >
          <option value="walls">Walls</option>
          <option value="doors">Doors</option>
          <option value="windows">Windows</option>
          <option value="rooms">Rooms</option>
          <option value="annotations">Annotations</option>
          <option value="evidence">Evidence</option>
        </select>
      </div>

      <div className="property-row">
        <label>
          <input
            type="checkbox"
            checked={element.visible}
            onChange={(e) => handlePropertyChange(element.id, 'visible', e.target.checked)}
          />
          Visible
        </label>
      </div>

      <div className="property-row">
        <label>
          <input
            type="checkbox"
            checked={element.locked}
            onChange={(e) => handlePropertyChange(element.id, 'locked', e.target.checked)}
          />
          Locked
        </label>
      </div>

      {element.paperItem.position && (
        <>
          <div className="property-row">
            <label>X Position</label>
            <input
              type="number"
              value={Math.round(element.paperItem.position.x)}
              onChange={(e) => {
                element.paperItem.position.x = parseInt(e.target.value);
              }}
            />
          </div>
          <div className="property-row">
            <label>Y Position</label>
            <input
              type="number"
              value={Math.round(element.paperItem.position.y)}
              onChange={(e) => {
                element.paperItem.position.y = parseInt(e.target.value);
              }}
            />
          </div>
        </>
      )}
    </div>
  );

  const renderAppearanceProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Color</label>
        <input
          type="color"
          value={element.properties.color || '#000000'}
          onChange={(e) => handlePropertyChange(element.id, 'color', e.target.value)}
        />
      </div>

      {element.type !== 'text' && (
        <div className="property-row">
          <label>Line Width</label>
          <input
            type="number"
            min="1"
            max="10"
            value={element.paperItem.strokeWidth || 1}
            onChange={(e) => {
              element.paperItem.strokeWidth = parseInt(e.target.value);
            }}
          />
        </div>
      )}

      {element.properties.fillColor && (
        <div className="property-row">
          <label>Fill Color</label>
          <input
            type="color"
            value={element.properties.fillColor || '#ffffff'}
            onChange={(e) => handlePropertyChange(element.id, 'fillColor', e.target.value)}
          />
        </div>
      )}

      {element.properties.opacity !== undefined && (
        <div className="property-row">
          <label>Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={element.properties.opacity}
            onChange={(e) => handlePropertyChange(element.id, 'opacity', parseFloat(e.target.value))}
          />
          <span className="range-value">{Math.round(element.properties.opacity * 100)}%</span>
        </div>
      )}
    </div>
  );

  const renderSpecificProperties = (element: DrawingElement) => {
    switch (element.type) {
      case 'wall':
        return renderWallProperties(element);
      case 'door':
        return renderDoorProperties(element);
      case 'window':
        return renderWindowProperties(element);
      case 'room':
        return renderRoomProperties(element);
      case 'text':
        return renderTextProperties(element);
      case 'evidence-pin':
        return renderEvidencePinProperties(element);
      default:
        return <div>No specific properties available</div>;
    }
  };

  const renderWallProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Thickness (inches)</label>
        <input
          type="number"
          min="1"
          max="24"
          value={element.properties.thickness || 6}
          onChange={(e) => handlePropertyChange(element.id, 'thickness', parseInt(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>Material</label>
        <select
          value={element.properties.material || 'drywall'}
          onChange={(e) => handlePropertyChange(element.id, 'material', e.target.value)}
        >
          <option value="drywall">Drywall</option>
          <option value="concrete">Concrete</option>
          <option value="brick">Brick</option>
          <option value="wood">Wood</option>
          <option value="metal">Metal</option>
          <option value="glass">Glass</option>
        </select>
      </div>

      {element.properties.length && (
        <div className="property-row">
          <label>Length</label>
          <input
            type="text"
            value={`${Math.round(element.properties.length)}"` }
            readOnly
          />
        </div>
      )}
    </div>
  );

  const renderDoorProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Width (inches)</label>
        <input
          type="number"
          min="24"
          max="96"
          value={element.properties.width || 36}
          onChange={(e) => handlePropertyChange(element.id, 'width', parseInt(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>Height (inches)</label>
        <input
          type="number"
          min="72"
          max="96"
          value={element.properties.height || 80}
          onChange={(e) => handlePropertyChange(element.id, 'height', parseInt(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>Opening Direction</label>
        <select
          value={element.properties.openDirection || 'right'}
          onChange={(e) => handlePropertyChange(element.id, 'openDirection', e.target.value)}
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>

      <div className="property-row">
        <label>Door Type</label>
        <select
          value={element.properties.doorType || 'single'}
          onChange={(e) => handlePropertyChange(element.id, 'doorType', e.target.value)}
        >
          <option value="single">Single</option>
          <option value="double">Double</option>
          <option value="sliding">Sliding</option>
        </select>
      </div>
    </div>
  );

  const renderWindowProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Width (inches)</label>
        <input
          type="number"
          min="12"
          max="120"
          value={element.properties.width || 48}
          onChange={(e) => handlePropertyChange(element.id, 'width', parseInt(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>Height (inches)</label>
        <input
          type="number"
          min="12"
          max="96"
          value={element.properties.height || 36}
          onChange={(e) => handlePropertyChange(element.id, 'height', parseInt(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>Sill Height (inches)</label>
        <input
          type="number"
          min="0"
          max="60"
          value={element.properties.sillHeight || 30}
          onChange={(e) => handlePropertyChange(element.id, 'sillHeight', parseInt(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>Window Type</label>
        <select
          value={element.properties.windowType || 'double'}
          onChange={(e) => handlePropertyChange(element.id, 'windowType', e.target.value)}
        >
          <option value="single">Single Hung</option>
          <option value="double">Double Hung</option>
          <option value="sliding">Sliding</option>
          <option value="casement">Casement</option>
        </select>
      </div>
    </div>
  );

  const renderRoomProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Room Name</label>
        <input
          type="text"
          value={element.properties.name || ''}
          onChange={(e) => handlePropertyChange(element.id, 'name', e.target.value)}
          placeholder="Enter room name"
        />
      </div>

      {element.properties.area && (
        <div className="property-row">
          <label>Area</label>
          <input
            type="text"
            value={`${Math.round(element.properties.area)} sq ft`}
            readOnly
          />
        </div>
      )}

      <div className="property-row">
        <label>Fill Color</label>
        <input
          type="color"
          value={element.properties.fillColor || '#ff6347'}
          onChange={(e) => handlePropertyChange(element.id, 'fillColor', e.target.value)}
        />
      </div>
    </div>
  );

  const renderTextProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Text Content</label>
        <textarea
          value={element.properties.content || ''}
          onChange={(e) => handlePropertyChange(element.id, 'content', e.target.value)}
          rows={3}
        />
      </div>

      <div className="property-row">
        <label>Font Size</label>
        <input
          type="number"
          min="8"
          max="72"
          value={element.properties.fontSize || 14}
          onChange={(e) => handlePropertyChange(element.id, 'fontSize', parseInt(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>Font Family</label>
        <select
          value={element.properties.fontFamily || 'Arial'}
          onChange={(e) => handlePropertyChange(element.id, 'fontFamily', e.target.value)}
        >
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Courier New">Courier New</option>
        </select>
      </div>
    </div>
  );

  const renderEvidencePinProperties = (element: DrawingElement) => (
    <div className="property-group">
      <div className="property-row">
        <label>Evidence Type</label>
        <select
          value={element.properties.evidenceType || 'photo'}
          onChange={(e) => handlePropertyChange(element.id, 'evidenceType', e.target.value)}
        >
          <option value="photo">Photo</option>
          <option value="audio">Audio/EVP</option>
          <option value="video">Video</option>
          <option value="emf">EMF Reading</option>
          <option value="temperature">Temperature</option>
          <option value="motion">Motion Detection</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="property-row">
        <label>Description</label>
        <textarea
          value={element.properties.description || ''}
          onChange={(e) => handlePropertyChange(element.id, 'description', e.target.value)}
          rows={3}
          placeholder="Describe the evidence..."
        />
      </div>

      <div className="property-row">
        <label>Timestamp</label>
        <input
          type="datetime-local"
          value={element.properties.timestamp ? new Date(element.properties.timestamp).toISOString().slice(0, -1) : ''}
          onChange={(e) => handlePropertyChange(element.id, 'timestamp', new Date(e.target.value))}
        />
      </div>

      <div className="property-row">
        <label>File Path</label>
        <div className="file-input-group">
          <input
            type="text"
            value={element.properties.filePath || ''}
            onChange={(e) => handlePropertyChange(element.id, 'filePath', e.target.value)}
            placeholder="Path to evidence file"
          />
          <button className="browse-btn">Browse</button>
        </div>
      </div>
    </div>
  );

  const getTypeIcon = (type: string): string => {
    const icons = {
      wall: '╱',
      door: '⌒',
      window: '⬜',
      room: '▢',
      text: 'T',
      'evidence-pin': '📍'
    };
    return icons[type] || '?';
  };

  const getTypeName = (type: string): string => {
    const names = {
      wall: 'Wall',
      door: 'Door',
      window: 'Window',
      room: 'Room',
      text: 'Text Label',
      'evidence-pin': 'Evidence Pin'
    };
    return names[type] || type;
  };

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <h3>Properties</h3>
      </div>
      
      <div className="panel-content">
        {selectedElements.length === 0 && renderNoSelection()}
        {selectedElements.length > 1 && renderMultipleSelection()}
        {selectedElements.length === 1 && renderElementProperties(selectedElements[0])}
      </div>

      <style jsx>{`
        .properties-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface-secondary, #1e1e1e);
        }

        .panel-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .panel-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .no-selection, .multiple-selection {
          text-align: center;
          color: var(--text-secondary, #aaaaaa);
        }

        .no-selection-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .no-selection h3 {
          margin: 0 0 8px 0;
          color: var(--text-primary, #ffffff);
        }

        .selection-info h3 {
          margin: 0 0 12px 0;
          color: var(--text-primary, #ffffff);
        }

        .selection-types {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 20px;
        }

        .type-chip {
          background: var(--accent-color, #bb86fc);
          color: var(--surface-primary, #121212);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .bulk-actions h4 {
          margin: 0 0 12px 0;
          color: var(--text-primary, #ffffff);
          font-size: 0.875rem;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .action-btn {
          padding: 8px 12px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.875rem;
        }

        .action-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .element-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 12px;
          background: var(--surface-tertiary, #2d2d2d);
          border-radius: 8px;
        }

        .element-type-icon {
          font-size: 1.5rem;
          color: var(--accent-color, #bb86fc);
        }

        .element-info h3 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary, #ffffff);
        }

        .element-id {
          font-size: 0.75rem;
          color: var(--text-secondary, #aaaaaa);
        }

        .property-section {
          margin-bottom: 16px;
          border: 1px solid var(--border-color, #333333);
          border-radius: 8px;
          overflow: hidden;
        }

        .section-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--surface-tertiary, #2d2d2d);
          border: none;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-weight: 500;
        }

        .section-header:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .expand-icon {
          transition: transform 0.2s ease;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .section-content {
          padding: 16px;
          background: var(--surface-secondary, #1e1e1e);
        }

        .property-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .property-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .property-row label {
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          min-width: 80px;
        }

        .property-row input,
        .property-row select,
        .property-row textarea {
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          color: var(--text-primary, #ffffff);
          padding: 6px 8px;
          font-size: 0.875rem;
          flex: 1;
        }

        .property-row input[type="color"] {
          width: 40px;
          height: 32px;
          padding: 2px;
        }

        .property-row input[type="checkbox"] {
          flex: none;
          margin-right: 8px;
          accent-color: var(--accent-color, #bb86fc);
        }

        .property-row input[type="range"] {
          flex: 1;
        }

        .range-value {
          font-size: 0.75rem;
          color: var(--text-secondary, #aaaaaa);
          min-width: 40px;
          text-align: right;
        }

        .file-input-group {
          display: flex;
          gap: 4px;
          flex: 1;
        }

        .browse-btn {
          background: var(--accent-color, #bb86fc);
          color: var(--surface-primary, #121212);
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 0.75rem;
          cursor: pointer;
          font-weight: 500;
        }

        .browse-btn:hover {
          background: var(--accent-hover, #985eff);
        }

        textarea {
          resize: vertical;
          min-height: 60px;
        }

        /* Material 3 Dark Theme Variables */
        :root {
          --surface-secondary: #1e1e1e;
          --surface-tertiary: #2d2d2d;
          --surface-hover: #3d3d3d;
          --text-primary: #ffffff;
          --text-secondary: #aaaaaa;
          --border-color: #333333;
          --accent-color: #bb86fc;
          --accent-hover: #985eff;
        }
      `}</style>
    </div>
  );
};