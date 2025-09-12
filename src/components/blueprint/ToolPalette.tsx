import React from 'react';
import { DrawingTool } from '../../services/blueprint/DrawingEngine';

interface ToolPaletteProps {
  currentTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
}

interface ToolDefinition {
  id: DrawingTool;
  name: string;
  icon: string;
  description: string;
  shortcut?: string;
}

export const ToolPalette: React.FC<ToolPaletteProps> = ({
  currentTool,
  onToolChange
}) => {
  const tools: ToolDefinition[] = [
    {
      id: 'select',
      name: 'Select',
      icon: '⬚',
      description: 'Select and move objects',
      shortcut: 'Ctrl+1'
    },
    {
      id: 'wall',
      name: 'Wall',
      icon: '╱',
      description: 'Draw walls and structural elements',
      shortcut: 'Ctrl+2'
    },
    {
      id: 'door',
      name: 'Door',
      icon: '⌒',
      description: 'Place doors with swing indicators',
      shortcut: 'Ctrl+3'
    },
    {
      id: 'window',
      name: 'Window',
      icon: '⬜',
      description: 'Place windows and openings',
      shortcut: 'Ctrl+4'
    },
    {
      id: 'room',
      name: 'Room',
      icon: '▢',
      description: 'Define room boundaries and areas',
      shortcut: 'Ctrl+5'
    },
    {
      id: 'text',
      name: 'Text',
      icon: 'T',
      description: 'Add text labels and annotations',
      shortcut: 'T'
    },
    {
      id: 'evidence-pin',
      name: 'Evidence Pin',
      icon: '📍',
      description: 'Mark evidence locations',
      shortcut: 'E'
    }
  ];

  return (
    <div className="tool-palette">
      <div className="palette-header">
        <h3>Tools</h3>
        <span className="tool-hint">Click or use shortcuts</span>
      </div>
      
      <div className="tools-grid">
        {tools.map(tool => (
          <button
            key={tool.id}
            className={`tool-button ${currentTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.description}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          >
            <div className="tool-icon">{tool.icon}</div>
            <div className="tool-name">{tool.name}</div>
            {tool.shortcut && (
              <div className="tool-shortcut">{tool.shortcut}</div>
            )}
          </button>
        ))}
      </div>

      <div className="palette-section">
        <h4>Drawing Options</h4>
        <div className="drawing-options">
          <label className="option-row">
            <input type="checkbox" defaultChecked />
            <span>Show dimensions</span>
          </label>
          <label className="option-row">
            <input type="checkbox" defaultChecked />
            <span>Auto-connect walls</span>
          </label>
          <label className="option-row">
            <input type="checkbox" />
            <span>Orthogonal mode</span>
          </label>
        </div>
      </div>

      <div className="palette-section">
        <h4>Quick Actions</h4>
        <div className="quick-actions">
          <button className="quick-btn">
            <span>📐</span>
            Measure
          </button>
          <button className="quick-btn">
            <span>🔍</span>
            Zoom Fit
          </button>
          <button className="quick-btn">
            <span>📱</span>
            Template
          </button>
        </div>
      </div>

      <style jsx>{`
        .tool-palette {
          padding: 16px;
          background: var(--surface-secondary, #1e1e1e);
        }

        .palette-header {
          margin-bottom: 16px;
        }

        .palette-header h3 {
          margin: 0 0 4px 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
        }

        .tool-hint {
          font-size: 0.75rem;
          color: var(--text-secondary, #aaaaaa);
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 24px;
        }

        .tool-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 8px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .tool-button:hover {
          background: var(--surface-hover, #3d3d3d);
          border-color: var(--accent-color, #bb86fc);
        }

        .tool-button.active {
          background: var(--accent-color, #bb86fc);
          color: var(--surface-primary, #121212);
          border-color: var(--accent-color, #bb86fc);
        }

        .tool-icon {
          font-size: 1.5rem;
          margin-bottom: 4px;
          line-height: 1;
        }

        .tool-name {
          font-size: 0.75rem;
          font-weight: 500;
          text-align: center;
          line-height: 1.2;
        }

        .tool-shortcut {
          position: absolute;
          top: 2px;
          right: 2px;
          font-size: 0.625rem;
          background: rgba(0, 0, 0, 0.3);
          padding: 1px 3px;
          border-radius: 2px;
          opacity: 0.7;
        }

        .palette-section {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .palette-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .palette-section h4 {
          margin: 0 0 12px 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
        }

        .drawing-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .option-row {
          display: flex;
          align-items: center;
          font-size: 0.875rem;
          cursor: pointer;
          color: var(--text-secondary, #aaaaaa);
        }

        .option-row:hover {
          color: var(--text-primary, #ffffff);
        }

        .option-row input[type="checkbox"] {
          margin-right: 8px;
          accent-color: var(--accent-color, #bb86fc);
        }

        .quick-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .quick-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .quick-btn:hover {
          background: var(--surface-hover, #3d3d3d);
          border-color: var(--accent-color, #bb86fc);
        }

        .quick-btn span {
          font-size: 1rem;
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
        }

        /* Accessibility improvements */
        .tool-button:focus {
          outline: 2px solid var(--accent-color, #bb86fc);
          outline-offset: 2px;
        }

        .option-row:focus-within {
          color: var(--text-primary, #ffffff);
        }

        /* Responsive design */
        @media (max-width: 320px) {
          .tools-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};