import React, { useState, useEffect } from 'react';

interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitToScreen: () => void;
  onSetZoom?: (level: number) => void;
  minZoom?: number;
  maxZoom?: number;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToScreen,
  onSetZoom,
  minZoom = 0.1,
  maxZoom = 10
}) => {
  const [showZoomInput, setShowZoomInput] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setInputValue(Math.round(zoomLevel * 100).toString());
  }, [zoomLevel]);

  const handleZoomInputSubmit = () => {
    if (!onSetZoom) return;
    
    const value = parseFloat(inputValue) / 100;
    if (!isNaN(value) && value >= minZoom && value <= maxZoom) {
      onSetZoom(value);
    }
    setShowZoomInput(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleZoomInputSubmit();
    } else if (e.key === 'Escape') {
      setShowZoomInput(false);
      setInputValue(Math.round(zoomLevel * 100).toString());
    }
  };

  const presetZoomLevels = [
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.5 },
    { label: '75%', value: 0.75 },
    { label: '100%', value: 1 },
    { label: '125%', value: 1.25 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2 }
  ];

  const canZoomIn = zoomLevel < maxZoom;
  const canZoomOut = zoomLevel > minZoom;

  return (
    <div className="zoom-controls">
      <div className="zoom-buttons">
        <button
          className={`zoom-btn ${!canZoomOut ? 'disabled' : ''}`}
          onClick={onZoomOut}
          disabled={!canZoomOut}
          title="Zoom Out (Ctrl + -)"
        >
          <span className="zoom-icon">🔍</span>
          <span className="zoom-symbol">−</span>
        </button>

        <div className="zoom-level-container">
          {showZoomInput ? (
            <input
              type="text"
              className="zoom-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleZoomInputSubmit}
              onKeyDown={handleKeyPress}
              autoFocus
              selectOnFocus
            />
          ) : (
            <button
              className="zoom-level"
              onClick={() => setShowZoomInput(true)}
              title="Click to edit zoom level"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
          )}
        </div>

        <button
          className={`zoom-btn ${!canZoomIn ? 'disabled' : ''}`}
          onClick={onZoomIn}
          disabled={!canZoomIn}
          title="Zoom In (Ctrl + +)"
        >
          <span className="zoom-icon">🔍</span>
          <span className="zoom-symbol">+</span>
        </button>
      </div>

      <div className="zoom-divider" />

      <div className="view-buttons">
        <button
          className="view-btn"
          onClick={onFitToScreen}
          title="Fit to Screen (Ctrl + 0)"
        >
          <span className="view-icon">⬛</span>
          <span className="view-text">Fit</span>
        </button>

        <button
          className="view-btn"
          onClick={onResetView}
          title="Reset View (Ctrl + 1)"
        >
          <span className="view-icon">🎯</span>
          <span className="view-text">100%</span>
        </button>
      </div>

      {onSetZoom && (
        <>
          <div className="zoom-divider" />
          
          <div className="preset-dropdown">
            <button className="preset-trigger">
              <span>⚙️</span>
            </button>
            
            <div className="preset-menu">
              <div className="preset-header">Zoom Presets</div>
              {presetZoomLevels.map(preset => (
                <button
                  key={preset.value}
                  className={`preset-option ${Math.abs(zoomLevel - preset.value) < 0.01 ? 'active' : ''}`}
                  onClick={() => onSetZoom(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
              <div className="preset-divider" />
              <button
                className="preset-option"
                onClick={() => onSetZoom(0.1)}
              >
                Minimum (10%)
              </button>
              <button
                className="preset-option"
                onClick={() => onSetZoom(10)}
              >
                Maximum (1000%)
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .zoom-controls {
          display: flex;
          align-items: center;
          background: var(--surface-secondary, #1e1e1e);
          border: 1px solid var(--border-color, #333333);
          border-radius: 8px;
          padding: 4px;
          gap: 4px;
        }

        .zoom-buttons {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .zoom-btn {
          position: relative;
          width: 32px;
          height: 32px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
        }

        .zoom-btn:hover:not(.disabled) {
          background: var(--surface-hover, #3d3d3d);
          border-color: var(--accent-color, #bb86fc);
        }

        .zoom-btn.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .zoom-icon {
          position: absolute;
          top: 2px;
          left: 2px;
          font-size: 0.625rem;
          opacity: 0.7;
        }

        .zoom-symbol {
          font-size: 1.125rem;
          font-weight: bold;
          color: var(--text-primary, #ffffff);
        }

        .zoom-level-container {
          margin: 0 4px;
        }

        .zoom-level {
          min-width: 60px;
          height: 32px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .zoom-level:hover {
          background: var(--surface-hover, #3d3d3d);
          border-color: var(--accent-color, #bb86fc);
        }

        .zoom-input {
          min-width: 60px;
          height: 30px;
          background: var(--surface-primary, #121212);
          border: 2px solid var(--accent-color, #bb86fc);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          text-align: center;
          font-size: 0.875rem;
          font-weight: 500;
          outline: none;
        }

        .zoom-divider {
          width: 1px;
          height: 24px;
          background: var(--border-color, #444444);
          margin: 0 4px;
        }

        .view-buttons {
          display: flex;
          gap: 2px;
        }

        .view-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s ease;
        }

        .view-btn:hover {
          background: var(--surface-hover, #3d3d3d);
          border-color: var(--accent-color, #bb86fc);
        }

        .view-icon {
          font-size: 0.875rem;
        }

        .view-text {
          font-weight: 500;
        }

        .preset-dropdown {
          position: relative;
        }

        .preset-trigger {
          width: 32px;
          height: 32px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .preset-trigger:hover {
          background: var(--surface-hover, #3d3d3d);
          border-color: var(--accent-color, #bb86fc);
        }

        .preset-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: var(--surface-secondary, #1e1e1e);
          border: 1px solid var(--border-color, #333333);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          min-width: 120px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-8px);
          transition: all 0.2s ease;
        }

        .preset-dropdown:hover .preset-menu {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .preset-header {
          padding: 8px 12px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary, #aaaaaa);
          border-bottom: 1px solid var(--border-color, #333333);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .preset-option {
          width: 100%;
          padding: 6px 12px;
          background: none;
          border: none;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.875rem;
          text-align: left;
          transition: background-color 0.2s ease;
        }

        .preset-option:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .preset-option.active {
          background: rgba(187, 134, 252, 0.1);
          color: var(--accent-color, #bb86fc);
        }

        .preset-divider {
          height: 1px;
          background: var(--border-color, #333333);
          margin: 4px 0;
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

        /* Focus styles for accessibility */
        .zoom-btn:focus,
        .zoom-level:focus,
        .view-btn:focus,
        .preset-trigger:focus {
          outline: 2px solid var(--accent-color, #bb86fc);
          outline-offset: 2px;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .zoom-controls {
            flex-wrap: wrap;
            gap: 2px;
          }
          
          .view-text {
            display: none;
          }
          
          .preset-dropdown {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};