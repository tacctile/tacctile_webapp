/**
 * ImagesViewer Component
 * Simplified images viewer for multi-view pop-out window
 * Displays session images in a grid with basic zoom
 */

import React, { useState, useCallback } from 'react';
import { Box, Typography, IconButton, Dialog } from '@mui/material';
import { styled } from '@mui/material/styles';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

// Styled components
const ViewerContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const ImagesHeader = styled(Box)({
  height: 40,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const ImagesGrid = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 12,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: 8,
  alignContent: 'start',
});

const ImageCard = styled(Box)({
  aspectRatio: '4/3',
  backgroundColor: '#1a1a1a',
  borderRadius: 4,
  border: '1px solid #2a2a2a',
  overflow: 'hidden',
  cursor: 'pointer',
  position: 'relative',
  transition: 'all 0.15s ease',
  '&:hover': {
    borderColor: '#19abb5',
    transform: 'scale(1.02)',
  },
});

const ImagePlaceholder = styled(Box)({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#161616',
});

const ImageTimestamp = styled(Box)({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '4px 8px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  fontSize: 10,
  fontFamily: 'monospace',
  color: '#888',
});

const PlaceholderContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  padding: 24,
  textAlign: 'center',
  gridColumn: '1 / -1',
});

const LightboxContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#000',
  padding: 24,
  maxWidth: '90vw',
  maxHeight: '90vh',
});

const MaterialSymbol: React.FC<{ icon: string; size?: number }> = ({ icon, size = 20 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size }}
  >
    {icon}
  </span>
);

interface SessionImage {
  id: string;
  timestamp: number;
  filename: string;
  url?: string;
}

interface ImagesViewerProps {
  className?: string;
}

// Helper to format time
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const ImagesViewer: React.FC<ImagesViewerProps> = ({ className }) => {
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  // Demo images for placeholder
  const [images] = useState<SessionImage[]>([
    { id: '1', timestamp: 3000, filename: 'frame_001.jpg' },
    { id: '2', timestamp: 8000, filename: 'frame_002.jpg' },
    { id: '3', timestamp: 15000, filename: 'frame_003.jpg' },
    { id: '4', timestamp: 22000, filename: 'frame_004.jpg' },
    { id: '5', timestamp: 30000, filename: 'frame_005.jpg' },
    { id: '6', timestamp: 35000, filename: 'frame_006.jpg' },
  ]);

  const [selectedImage, setSelectedImage] = useState<SessionImage | null>(null);

  // Handle image click
  const handleImageClick = useCallback((image: SessionImage) => {
    setSelectedImage(image);
  }, []);

  // Handle lightbox close
  const handleCloseLightbox = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Jump to image timestamp
  const handleJumpToTimestamp = useCallback((timestamp: number) => {
    setTimestamp(timestamp);
    setSelectedImage(null);
  }, [setTimestamp]);

  return (
    <ViewerContainer className={className}>
      {/* Header */}
      <ImagesHeader>
        <MaterialSymbol icon="photo_library" size={18} />
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>
          Images
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: '#666' }}>
          {images.length} images
        </Typography>
      </ImagesHeader>

      {/* Images grid */}
      <ImagesGrid>
        {images.length === 0 ? (
          <PlaceholderContent>
            <MaterialSymbol icon="photo_library" size={48} />
            <Typography sx={{ mt: 2, color: '#666', fontSize: 14 }}>
              No images in session
            </Typography>
            <Typography sx={{ color: '#444', fontSize: 12, mt: 1 }}>
              Images will appear here
            </Typography>
          </PlaceholderContent>
        ) : (
          images.map((image) => (
            <ImageCard key={image.id} onClick={() => handleImageClick(image)}>
              {image.url ? (
                <img
                  src={image.url}
                  alt={image.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <ImagePlaceholder>
                  <MaterialSymbol icon="image" size={32} />
                </ImagePlaceholder>
              )}
              <ImageTimestamp>
                {formatTime(image.timestamp)}
              </ImageTimestamp>
            </ImageCard>
          ))
        )}
      </ImagesGrid>

      {/* Lightbox dialog */}
      <Dialog
        open={!!selectedImage}
        onClose={handleCloseLightbox}
        maxWidth={false}
        PaperProps={{
          sx: {
            backgroundColor: '#000',
            maxWidth: '90vw',
            maxHeight: '90vh',
          },
        }}
      >
        {selectedImage && (
          <LightboxContent>
            {selectedImage.url ? (
              <img
                src={selectedImage.url}
                alt={selectedImage.filename}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(90vh - 100px)',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 400,
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1a1a1a',
                  borderRadius: 2,
                }}
              >
                <MaterialSymbol icon="image" size={64} />
              </Box>
            )}
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography sx={{ color: '#888', fontSize: 12 }}>
                {selectedImage.filename}
              </Typography>
              <Typography sx={{ color: '#19abb5', fontSize: 12, fontFamily: 'monospace' }}>
                {formatTime(selectedImage.timestamp)}
              </Typography>
              <IconButton
                size="small"
                onClick={() => handleJumpToTimestamp(selectedImage.timestamp)}
                sx={{ color: '#888', '&:hover': { color: '#19abb5' } }}
              >
                <MaterialSymbol icon="play_arrow" size={18} />
              </IconButton>
            </Box>
          </LightboxContent>
        )}
      </Dialog>
    </ViewerContainer>
  );
};

export default ImagesViewer;
