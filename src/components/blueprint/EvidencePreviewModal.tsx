import React, { useState, useEffect } from 'react';
import { DrawingElement } from '../../services/blueprint/DrawingEngine';

interface EvidencePreviewModalProps {
  element: DrawingElement;
  visible: boolean;
  onClose: () => void;
  onEdit?: (element: DrawingElement) => void;
  onDelete?: (elementId: string) => void;
}

interface EvidenceFile {
  id: string;
  name: string;
  type: 'photo' | 'audio' | 'video' | 'emf' | 'temp' | 'note';
  path: string;
  size: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export const EvidencePreviewModal: React.FC<EvidencePreviewModalProps> = ({
  element,
  visible,
  onClose,
  onEdit,
  onDelete
}) => {
  const [loading, setLoading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<EvidenceFile | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);

  useEffect(() => {
    if (visible && element) {
      loadEvidenceFiles();
    }
  }, [visible, element]);

  const loadEvidenceFiles = async () => {
    setLoading(true);
    try {
      // Simulate loading evidence files linked to this pin
      // In a real implementation, this would query the database
      const mockFiles: EvidenceFile[] = [
        {
          id: 'ev1',
          name: 'EMF_Reading_001.jpg',
          type: 'photo',
          path: '/evidence/photos/EMF_Reading_001.jpg',
          size: 2048576,
          timestamp: new Date('2024-01-15T14:30:00Z'),
          metadata: {
            camera: 'Canon EOS R5',
            location: { lat: 40.7128, lng: -74.0060 },
            temperature: '68°F',
            emfReading: '2.3 mG'
          }
        },
        {
          id: 'ev2',
          name: 'Audio_Recording_001.wav',
          type: 'audio',
          path: '/evidence/audio/Audio_Recording_001.wav',
          size: 15728640,
          timestamp: new Date('2024-01-15T14:32:00Z'),
          metadata: {
            duration: '00:03:45',
            sampleRate: '44.1 kHz',
            bitDepth: '16-bit',
            anomalies: ['EVP detected at 1:23', 'Frequency spike at 2:10']
          }
        },
        {
          id: 'ev3',
          name: 'Temperature_Log.csv',
          type: 'temp',
          path: '/evidence/data/Temperature_Log.csv',
          size: 4096,
          timestamp: new Date('2024-01-15T14:35:00Z'),
          metadata: {
            minTemp: '65°F',
            maxTemp: '72°F',
            avgTemp: '68.5°F',
            coldSpots: ['14:33:12 - 58°F drop detected']
          }
        }
      ];

      // Filter files based on evidence pin type
      const filteredFiles = mockFiles.filter(file => 
        element.properties.evidenceType === 'mixed' || 
        file.type === element.properties.evidenceType
      );

      setEvidenceFiles(filteredFiles);
      if (filteredFiles.length > 0) {
        setSelectedFile(filteredFiles[0]);
      }
    } catch (error) {
      console.error('Failed to load evidence files:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEvidenceIcon = (type: string) => {
    const icons = {
      photo: '📷',
      audio: '🎵',
      video: '🎥',
      emf: '📡',
      temp: '🌡️',
      note: '📝',
      mixed: '📁'
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const renderFilePreview = (file: EvidenceFile) => {
    switch (file.type) {
      case 'photo':
        return (
          <div className="file-preview photo-preview">
            <img src={file.path} alt={file.name} />
            {file.metadata?.emfReading && (
              <div className="overlay-info">
                EMF: {file.metadata.emfReading}
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="file-preview audio-preview">
            <div className="audio-controls">
              <button className="play-btn">▶️</button>
              <div className="waveform-placeholder">
                <div className="waveform-bar" style={{ height: '20%' }} />
                <div className="waveform-bar" style={{ height: '60%' }} />
                <div className="waveform-bar" style={{ height: '40%' }} />
                <div className="waveform-bar" style={{ height: '80%' }} />
                <div className="waveform-bar" style={{ height: '30%' }} />
                <div className="waveform-bar" style={{ height: '70%' }} />
                <div className="waveform-bar" style={{ height: '50%' }} />
              </div>
            </div>
            <div className="audio-info">
              Duration: {file.metadata?.duration}
            </div>
          </div>
        );

      case 'temp':
        return (
          <div className="file-preview data-preview">
            <div className="data-chart">
              <div className="chart-title">Temperature Readings</div>
              <div className="temperature-graph">
                {/* Simplified temperature graph visualization */}
                <div className="graph-line"></div>
                <div className="data-points">
                  <span className="temp-point">68°F</span>
                  <span className="temp-point cold">58°F</span>
                  <span className="temp-point">69°F</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'emf':
        return (
          <div className="file-preview data-preview">
            <div className="emf-meter">
              <div className="meter-display">2.3 mG</div>
              <div className="meter-scale">
                <div className="scale-bar active" />
                <div className="scale-bar active" />
                <div className="scale-bar" />
                <div className="scale-bar" />
                <div className="scale-bar" />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="file-preview generic-preview">
            <div className="file-icon">{getEvidenceIcon(file.type)}</div>
            <div className="file-name">{file.name}</div>
          </div>
        );
    }
  };

  if (!visible) return null;

  return (
    <div className="evidence-modal-overlay" onClick={onClose}>
      <div className="evidence-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-info">
            <div className="pin-info">
              <span className="pin-icon">{getEvidenceIcon(element.properties.evidenceType || 'mixed')}</span>
              <div className="pin-details">
                <h3>{element.properties.name || 'Evidence Pin'}</h3>
                <span className="pin-location">
                  Location: ({Math.round(element.paperItem.position.x)}, {Math.round(element.paperItem.position.y)})
                </span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="action-btn"
              onClick={() => setShowMetadata(!showMetadata)}
              title="Toggle Metadata"
            >
              ℹ️
            </button>
            {onEdit && (
              <button
                className="action-btn"
                onClick={() => onEdit(element)}
                title="Edit Pin"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                className="action-btn delete"
                onClick={() => onDelete(element.id)}
                title="Delete Pin"
              >
                🗑️
              </button>
            )}
            <button className="close-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>Loading evidence files...</span>
            </div>
          ) : (
            <div className="evidence-content">
              {/* File List Sidebar */}
              <div className="file-list">
                <h4>Linked Evidence ({evidenceFiles.length})</h4>
                <div className="files">
                  {evidenceFiles.map(file => (
                    <div
                      key={file.id}
                      className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <span className="file-icon">{getEvidenceIcon(file.type)}</span>
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-meta">
                          {formatFileSize(file.size)} • {formatTimestamp(file.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="file-actions">
                  <button className="add-evidence-btn">
                    ➕ Add Evidence
                  </button>
                </div>
              </div>

              {/* Preview Area */}
              <div className="preview-area">
                {selectedFile ? (
                  <div className="file-preview-container">
                    {renderFilePreview(selectedFile)}
                    
                    {showMetadata && selectedFile.metadata && (
                      <div className="metadata-panel">
                        <h5>Metadata</h5>
                        <div className="metadata-grid">
                          {Object.entries(selectedFile.metadata).map(([key, value]) => (
                            <div key={key} className="metadata-item">
                              <span className="metadata-key">{key}:</span>
                              <span className="metadata-value">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-preview">
                    <div className="no-preview-icon">🔍</div>
                    <p>Select a file to preview</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .evidence-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }

        .evidence-modal {
          background: var(--surface-primary, #121212);
          border: 1px solid var(--border-color, #333333);
          border-radius: 12px;
          width: 90vw;
          height: 80vh;
          max-width: 1200px;
          max-height: 800px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: var(--surface-secondary, #1e1e1e);
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .header-info {
          display: flex;
          align-items: center;
        }

        .pin-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pin-icon {
          font-size: 2rem;
        }

        .pin-details h3 {
          margin: 0;
          font-size: 1.25rem;
          color: var(--text-primary, #ffffff);
        }

        .pin-location {
          font-size: 0.875rem;
          color: var(--text-secondary, #aaaaaa);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-btn, .close-btn {
          width: 36px;
          height: 36px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-btn:hover, .close-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .action-btn.delete:hover {
          background: #ff4444;
          border-color: #ff4444;
        }

        .modal-body {
          flex: 1;
          overflow: hidden;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 16px;
          color: var(--text-secondary, #aaaaaa);
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color, #333333);
          border-top: 3px solid var(--accent-color, #bb86fc);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .evidence-content {
          display: flex;
          height: 100%;
        }

        .file-list {
          width: 300px;
          background: var(--surface-secondary, #1e1e1e);
          border-right: 1px solid var(--border-color, #333333);
          display: flex;
          flex-direction: column;
        }

        .file-list h4 {
          margin: 0;
          padding: 16px;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .files {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .file-item:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .file-item.selected {
          background: rgba(187, 134, 252, 0.1);
          border: 1px solid var(--accent-color, #bb86fc);
        }

        .file-item .file-icon {
          font-size: 1.5rem;
        }

        .file-info {
          flex: 1;
          min-width: 0;
        }

        .file-name {
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-meta {
          font-size: 0.75rem;
          color: var(--text-secondary, #aaaaaa);
          margin-top: 2px;
        }

        .file-actions {
          padding: 16px;
          border-top: 1px solid var(--border-color, #333333);
        }

        .add-evidence-btn {
          width: 100%;
          padding: 10px;
          background: var(--accent-color, #bb86fc);
          border: none;
          border-radius: 6px;
          color: var(--surface-primary, #121212);
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .add-evidence-btn:hover {
          background: var(--accent-hover, #985eff);
        }

        .preview-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .file-preview-container {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .file-preview {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-tertiary, #2d2d2d);
          margin: 16px;
          border-radius: 8px;
          position: relative;
        }

        .photo-preview img {
          max-width: 100%;
          max-height: 100%;
          border-radius: 8px;
        }

        .overlay-info {
          position: absolute;
          bottom: 16px;
          left: 16px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .audio-preview {
          flex-direction: column;
          gap: 16px;
          padding: 24px;
        }

        .audio-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .play-btn {
          width: 48px;
          height: 48px;
          background: var(--accent-color, #bb86fc);
          border: none;
          border-radius: 50%;
          font-size: 1.5rem;
          cursor: pointer;
        }

        .waveform-placeholder {
          display: flex;
          align-items: end;
          gap: 2px;
          height: 40px;
          flex: 1;
        }

        .waveform-bar {
          width: 3px;
          background: var(--accent-color, #bb86fc);
          border-radius: 2px;
        }

        .data-preview {
          padding: 24px;
          flex-direction: column;
        }

        .data-chart, .emf-meter {
          background: var(--surface-primary, #121212);
          border-radius: 8px;
          padding: 16px;
        }

        .chart-title {
          font-size: 1rem;
          color: var(--text-primary, #ffffff);
          margin-bottom: 16px;
        }

        .temperature-graph {
          position: relative;
          height: 100px;
          border-left: 2px solid var(--border-color, #333333);
          border-bottom: 2px solid var(--border-color, #333333);
        }

        .graph-line {
          position: absolute;
          top: 20%;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent-color, #bb86fc);
        }

        .data-points {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: space-around;
        }

        .temp-point {
          background: var(--accent-color, #bb86fc);
          color: var(--surface-primary, #121212);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: bold;
        }

        .temp-point.cold {
          background: #4fc3f7;
        }

        .meter-display {
          font-size: 2rem;
          font-weight: bold;
          color: var(--accent-color, #bb86fc);
          text-align: center;
          margin-bottom: 16px;
        }

        .meter-scale {
          display: flex;
          gap: 4px;
          justify-content: center;
        }

        .scale-bar {
          width: 20px;
          height: 6px;
          background: var(--border-color, #333333);
          border-radius: 3px;
        }

        .scale-bar.active {
          background: var(--accent-color, #bb86fc);
        }

        .generic-preview {
          flex-direction: column;
          gap: 16px;
        }

        .generic-preview .file-icon {
          font-size: 4rem;
        }

        .no-preview {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary, #aaaaaa);
        }

        .no-preview-icon {
          font-size: 4rem;
          margin-bottom: 16px;
        }

        .metadata-panel {
          background: var(--surface-secondary, #1e1e1e);
          border-top: 1px solid var(--border-color, #333333);
          padding: 16px;
          max-height: 200px;
          overflow-y: auto;
        }

        .metadata-panel h5 {
          margin: 0 0 12px 0;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
        }

        .metadata-grid {
          display: grid;
          gap: 8px;
        }

        .metadata-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          font-size: 0.8rem;
        }

        .metadata-key {
          color: var(--text-secondary, #aaaaaa);
          font-weight: 500;
        }

        .metadata-value {
          color: var(--text-primary, #ffffff);
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
          --accent-hover: #985eff;
        }

        /* Scrollbar styling */
        .files::-webkit-scrollbar,
        .metadata-panel::-webkit-scrollbar {
          width: 6px;
        }

        .files::-webkit-scrollbar-track,
        .metadata-panel::-webkit-scrollbar-track {
          background: var(--surface-primary, #121212);
        }

        .files::-webkit-scrollbar-thumb,
        .metadata-panel::-webkit-scrollbar-thumb {
          background: var(--border-color, #333333);
          border-radius: 3px;
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .evidence-modal {
            width: 95vw;
            height: 90vh;
          }
          
          .evidence-content {
            flex-direction: column;
          }
          
          .file-list {
            width: 100%;
            height: 200px;
          }
        }
      `}</style>
    </div>
  );
};