import React, { useState } from 'react';
import { Box } from '@mui/material';
import { WorkspaceLayout } from '@/components/layout';
import { FileLibrary, FileItem } from '@/components/file-library';

// Mock data for testing
const mockFiles: FileItem[] = [
  {
    id: '1',
    type: 'video',
    fileName: 'camera_01_main_hall.mp4',
    duration: 3847,
    capturedAt: Date.now() - 7200000,
    user: 'Sarah',
    deviceInfo: 'Sony A7III',
    flagCount: 3,
    hasFindings: true,
  },
  {
    id: '2',
    type: 'video',
    fileName: 'camera_02_basement.mp4',
    duration: 3902,
    capturedAt: Date.now() - 7000000,
    user: 'Mike',
    deviceInfo: 'GoPro Hero 11',
    flagCount: 1,
    hasFindings: false,
  },
  {
    id: '3',
    type: 'audio',
    fileName: 'recorder_01_audio_session.wav',
    duration: 1834,
    capturedAt: Date.now() - 6500000,
    user: 'Sarah',
    deviceInfo: 'Zoom H6',
    flagCount: 7,
    hasFindings: true,
  },
  {
    id: '4',
    type: 'audio',
    fileName: 'recorder_02_radio_sweep.wav',
    duration: 923,
    capturedAt: Date.now() - 5800000,
    user: 'Jen',
    deviceInfo: 'Tascam DR-40X',
    flagCount: 2,
    hasFindings: true,
  },
  {
    id: '5',
    type: 'image',
    fileName: 'thermal_anomaly_001.jpg',
    capturedAt: Date.now() - 5400000,
    user: 'Mike',
    deviceInfo: 'FLIR E8',
    flagCount: 1,
    hasFindings: true,
  },
  {
    id: '6',
    type: 'image',
    fileName: 'full_spectrum_023.jpg',
    capturedAt: Date.now() - 5200000,
    user: 'Sarah',
    deviceInfo: 'Modified Canon',
    flagCount: 0,
    hasFindings: false,
  },
  {
    id: '7',
    type: 'video',
    fileName: 'static_cam_attic.mp4',
    duration: 7200,
    capturedAt: Date.now() - 4800000,
    user: 'Jen',
    deviceInfo: 'Wyze Cam v3',
    flagCount: 0,
    hasFindings: false,
  },
];

// Extended mock data with full metadata
const getFullMetadata = (item: FileItem) => ({
  ...item,
  fileSize: Math.floor(Math.random() * 2000000000) + 100000000,
  resolution: item.type === 'video' ? '3840x2160' : item.type === 'image' ? '4000x3000' : undefined,
  codec: item.type === 'video' ? 'H.265' : item.type === 'audio' ? 'PCM 24-bit' : 'JPEG',
  gpsLocation: '39.9526° N, 75.1652° W',
  hash: 'a1b2c3d4e5f6789012345678901234567890abcdef',
});

export const WorkspaceDemo: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);

  const handleSelect = (item: FileItem) => {
    setSelectedItem(item);
  };

  const handleDoubleClick = (item: FileItem) => {
    console.log('Open in tool:', item.type, item.fileName);
    // This will eventually navigate to the appropriate tool
    alert(`Would open ${item.fileName} in ${item.type} tool`);
  };

  // Placeholder main content
  const mainContent = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#666',
      fontSize: '14px',
      backgroundColor: '#0d0d0d',
    }}>
      Main viewer area - Timeline or Tool content goes here
    </Box>
  );

  // Placeholder timeline
  const timelineContent = (
    <Box sx={{
      height: 150,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#555',
      fontSize: '13px',
    }}>
      Timeline with swim lanes goes here
    </Box>
  );

  // Metadata inspector content
  const inspectorContent = (
    <Box sx={{ padding: 2 }}>
      {!selectedItem ? (
        <Box sx={{ color: '#666', fontSize: '13px', textAlign: 'center', marginTop: 4 }}>
          Select file to view metadata
        </Box>
      ) : (
        <>
          <Box sx={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#e1e1e1',
            marginBottom: 2,
            wordBreak: 'break-word',
          }}>
            {selectedItem.fileName}
          </Box>

          <Box sx={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 1,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: 2,
            backgroundColor: selectedItem.type === 'video' ? '#f44336' : selectedItem.type === 'audio' ? '#4caf50' : '#2196f3',
            color: '#fff',
          }}>
            {selectedItem.type}
          </Box>

          <Box sx={{ marginTop: 2 }}>
            {[
              ['Captured', new Date(selectedItem.capturedAt).toLocaleString()],
              ['User', selectedItem.user],
              ['Device', selectedItem.deviceInfo],
              ['Duration', selectedItem.duration ? `${Math.floor(selectedItem.duration / 60)}:${(selectedItem.duration % 60).toString().padStart(2, '0')}` : '—'],
              ['Flags', selectedItem.flagCount],
            ].map(([label, value]) => (
              <Box key={label} sx={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid #252525',
              }}>
                <Box sx={{ fontSize: '12px', color: '#888' }}>{label}</Box>
                <Box sx={{ fontSize: '12px', color: '#e1e1e1' }}>{value}</Box>
              </Box>
            ))}
          </Box>

          {selectedItem.hasFindings && (
            <Box sx={{
              marginTop: 2,
              padding: '8px 12px',
              backgroundColor: 'rgba(25, 171, 181, 0.1)',
              border: '1px solid rgba(25, 171, 181, 0.3)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#19abb5',
                boxShadow: '0 0 6px #19abb5',
              }} />
              <Box sx={{ fontSize: '12px', color: '#19abb5' }}>
                Has findings
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', width: '100vw' }}>
      <WorkspaceLayout
        filesPanel={
          <FileLibrary
            items={mockFiles}
            selectedId={selectedItem?.id}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
          />
        }
        inspectorPanel={inspectorContent}
        mainContent={mainContent}
        timelineContent={timelineContent}
        filesTitle="Files"
        inspectorTitle="Metadata"
        showTransport={true}
      />
    </Box>
  );
};

export default WorkspaceDemo;
