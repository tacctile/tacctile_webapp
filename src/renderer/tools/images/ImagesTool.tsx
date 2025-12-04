/**
 * ImagesTool - Adobe Lightroom-inspired image viewer/editor
 *
 * Features for paranormal investigation photography:
 * - Non-destructive adjustments (exposure, contrast, etc.)
 * - Annotation tools (circles, arrows, text)
 * - Full-spectrum/IR image enhancement
 * - Before/after comparison
 * - Metadata viewer with EXIF data
 * - Filmstrip navigation
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { styled, alpha } from '@mui/material/styles';

// Icons
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import Crop169Icon from '@mui/icons-material/Crop169';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import FlipIcon from '@mui/icons-material/Flip';
import CompareIcon from '@mui/icons-material/Compare';
import TuneIcon from '@mui/icons-material/Tune';
import BrushIcon from '@mui/icons-material/Brush';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ContrastIcon from '@mui/icons-material/Contrast';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HighlightIcon from '@mui/icons-material/Highlight';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import StarIcon from '@mui/icons-material/Star';

const ToolContainer = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
});

const FilmstripPanel = styled(Box)({
  width: 100,
  backgroundColor: '#0d0d0d',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const FilmstripHeader = styled(Box)({
  padding: '8px',
  borderBottom: '1px solid #1a1a1a',
  textAlign: 'center',
});

const FilmstripContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 4,
});

const ThumbnailItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  width: '100%',
  aspectRatio: '1',
  backgroundColor: '#1a1a1a',
  borderRadius: 4,
  marginBottom: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: selected ? '2px solid #19abb5' : '2px solid transparent',
  position: 'relative',
  '&:hover': {
    borderColor: selected ? '#19abb5' : '#2a2a2a',
  },
}));

const RatingStars = styled(Box)({
  position: 'absolute',
  bottom: 2,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 1,
});

const MainArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const Toolbar = styled(Box)({
  height: 44,
  backgroundColor: '#0f0f0f',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const ToolbarSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const ToolbarButton = styled(IconButton)({
  width: 32,
  height: 32,
  color: '#707070',
  '&:hover': {
    color: '#b0b0b0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
  '&.active': {
    color: '#19abb5',
    backgroundColor: alpha('#19abb5', 0.1),
  },
});

const ImageViewerArea = styled(Box)({
  flex: 1,
  backgroundColor: '#000000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
});

const ImagePlaceholder = styled(Box)({
  width: '80%',
  maxWidth: 900,
  aspectRatio: '3/2',
  backgroundColor: '#0a0a0a',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  border: '1px dashed #2a2a2a',
});

const ZoomIndicator = styled(Box)({
  position: 'absolute',
  bottom: 16,
  left: 16,
  padding: '4px 8px',
  backgroundColor: alpha('#000000', 0.7),
  borderRadius: 4,
  fontSize: 12,
  color: '#808080',
});

const AdjustmentsPanel = styled(Box)({
  width: 280,
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const PanelTabs = styled(Tabs)({
  minHeight: 40,
  borderBottom: '1px solid #1a1a1a',
  '& .MuiTab-root': {
    minHeight: 40,
    fontSize: 12,
    color: '#707070',
    '&.Mui-selected': {
      color: '#19abb5',
    },
  },
  '& .MuiTabs-indicator': {
    backgroundColor: '#19abb5',
  },
});

const PanelContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 16,
});

const AdjustmentSection = styled(Box)({
  marginBottom: 20,
});

const SectionTitle = styled(Typography)({
  fontSize: 11,
  fontWeight: 600,
  color: '#808080',
  textTransform: 'uppercase',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const AdjustmentRow = styled(Box)({
  marginBottom: 12,
});

const AdjustmentLabel = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 4,
});

const AdjustmentName = styled(Typography)({
  fontSize: 12,
  color: '#a0a0a0',
});

const AdjustmentValue = styled(Typography)({
  fontSize: 11,
  color: '#606060',
  fontFamily: 'monospace',
  minWidth: 40,
  textAlign: 'right',
});

const AdjustmentSlider = styled(Slider)({
  color: '#19abb5',
  height: 3,
  '& .MuiSlider-thumb': {
    width: 10,
    height: 10,
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#2a2a2a',
  },
});

const MetadataRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 8,
});

const MetadataLabel = styled(Typography)({
  fontSize: 11,
  color: '#505050',
});

const MetadataValue = styled(Typography)({
  fontSize: 11,
  color: '#909090',
  textAlign: 'right',
});

const ImagesTool: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [activeTool, setActiveTool] = useState<'none' | 'circle' | 'arrow' | 'text'>('none');
  const [zoom, setZoom] = useState(100);

  // Adjustment values
  const [exposure, setExposure] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [highlights, setHighlights] = useState(0);
  const [shadows, setShadows] = useState(0);
  const [whites, setWhites] = useState(0);
  const [blacks, setBlacks] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [tint, setTint] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [dehaze, setDehaze] = useState(0);

  const images = [
    { id: 1, name: 'IMG_0234.jpg', rating: 3 },
    { id: 2, name: 'IMG_0235.jpg', rating: 5 },
    { id: 3, name: 'IR_0001.jpg', rating: 4 },
    { id: 4, name: 'FS_0012.jpg', rating: 2 },
    { id: 5, name: 'IMG_0240.jpg', rating: 0 },
    { id: 6, name: 'IR_0003.jpg', rating: 4 },
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Box key={i} sx={{ '& svg': { fontSize: 8, color: i < rating ? '#f59e0b' : '#303030' } }}>
        {i < rating ? <StarIcon /> : <StarOutlineIcon />}
      </Box>
    ));
  };

  return (
    <ToolContainer>
      {/* Filmstrip Panel */}
      <FilmstripPanel>
        <FilmstripHeader>
          <Typography sx={{ fontSize: 10, color: '#606060' }}>
            {images.length} Photos
          </Typography>
        </FilmstripHeader>
        <FilmstripContent>
          {images.map((image, index) => (
            <ThumbnailItem
              key={image.id}
              selected={selectedImage === index}
              onClick={() => setSelectedImage(index)}
            >
              <PhotoLibraryIcon sx={{ fontSize: 24, color: '#303030' }} />
              <RatingStars>{renderStars(image.rating)}</RatingStars>
            </ThumbnailItem>
          ))}
        </FilmstripContent>
      </FilmstripPanel>

      {/* Main Area */}
      <MainArea>
        {/* Toolbar */}
        <Toolbar>
          <ToolbarSection>
            <Tooltip title="Zoom Out">
              <ToolbarButton onClick={() => setZoom(Math.max(10, zoom - 25))}>
                <ZoomOutIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Typography sx={{ fontSize: 12, color: '#606060', minWidth: 45, textAlign: 'center' }}>
              {zoom}%
            </Typography>
            <Tooltip title="Zoom In">
              <ToolbarButton onClick={() => setZoom(Math.min(400, zoom + 25))}>
                <ZoomInIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Fit to Screen">
              <ToolbarButton onClick={() => setZoom(100)}>
                <FitScreenIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2a2a', mx: 1 }} />

          <ToolbarSection>
            <Tooltip title="Rotate Left">
              <ToolbarButton>
                <RotateLeftIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Rotate Right">
              <ToolbarButton>
                <RotateRightIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Flip Horizontal">
              <ToolbarButton>
                <FlipIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Crop">
              <ToolbarButton>
                <Crop169Icon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2a2a', mx: 1 }} />

          <ToolbarSection>
            <Tooltip title="Circle Annotation">
              <ToolbarButton
                className={activeTool === 'circle' ? 'active' : ''}
                onClick={() => setActiveTool(activeTool === 'circle' ? 'none' : 'circle')}
              >
                <CircleOutlinedIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Arrow Annotation">
              <ToolbarButton
                className={activeTool === 'arrow' ? 'active' : ''}
                onClick={() => setActiveTool(activeTool === 'arrow' ? 'none' : 'arrow')}
              >
                <ArrowForwardIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Text Annotation">
              <ToolbarButton
                className={activeTool === 'text' ? 'active' : ''}
                onClick={() => setActiveTool(activeTool === 'text' ? 'none' : 'text')}
              >
                <TextFieldsIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Brush">
              <ToolbarButton>
                <BrushIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>

          <Box sx={{ flex: 1 }} />

          <ToolbarSection>
            <Tooltip title="Before/After Compare">
              <ToolbarButton>
                <CompareIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Auto Enhance">
              <ToolbarButton>
                <AutoFixHighIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2a2a', mx: 1 }} />

          <ToolbarSection>
            <Tooltip title="Undo">
              <ToolbarButton>
                <UndoIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Redo">
              <ToolbarButton>
                <RedoIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Save">
              <ToolbarButton>
                <SaveIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>
        </Toolbar>

        {/* Image Viewer */}
        <ImageViewerArea>
          <ImagePlaceholder>
            <PhotoLibraryIcon sx={{ fontSize: 64, color: '#252525' }} />
            <Typography sx={{ color: '#404040', fontSize: 14 }}>
              Adobe Lightroom-inspired Image Viewer
            </Typography>
            <Typography sx={{ color: '#303030', fontSize: 12 }}>
              Non-destructive adjustments and annotations
            </Typography>
          </ImagePlaceholder>
          <ZoomIndicator>{zoom}%</ZoomIndicator>
        </ImageViewerArea>
      </MainArea>

      {/* Adjustments Panel */}
      <AdjustmentsPanel>
        <PanelTabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="fullWidth"
        >
          <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Adjust" />
          <Tab icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Info" />
        </PanelTabs>

        <PanelContent>
          {activeTab === 0 ? (
            <>
              <AdjustmentSection>
                <SectionTitle>
                  <WbSunnyIcon sx={{ fontSize: 14 }} />
                  Light
                </SectionTitle>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Exposure</AdjustmentName>
                    <AdjustmentValue>{exposure > 0 ? `+${exposure}` : exposure}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={exposure}
                    onChange={(_, v) => setExposure(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Contrast</AdjustmentName>
                    <AdjustmentValue>{contrast > 0 ? `+${contrast}` : contrast}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={contrast}
                    onChange={(_, v) => setContrast(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Highlights</AdjustmentName>
                    <AdjustmentValue>{highlights > 0 ? `+${highlights}` : highlights}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={highlights}
                    onChange={(_, v) => setHighlights(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Shadows</AdjustmentName>
                    <AdjustmentValue>{shadows > 0 ? `+${shadows}` : shadows}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={shadows}
                    onChange={(_, v) => setShadows(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
              </AdjustmentSection>

              <AdjustmentSection>
                <SectionTitle>
                  <ColorLensIcon sx={{ fontSize: 14 }} />
                  Color
                </SectionTitle>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Temperature</AdjustmentName>
                    <AdjustmentValue>{temperature > 0 ? `+${temperature}` : temperature}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={temperature}
                    onChange={(_, v) => setTemperature(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Saturation</AdjustmentName>
                    <AdjustmentValue>{saturation > 0 ? `+${saturation}` : saturation}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={saturation}
                    onChange={(_, v) => setSaturation(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
              </AdjustmentSection>

              <AdjustmentSection>
                <SectionTitle>
                  <BlurOnIcon sx={{ fontSize: 14 }} />
                  Effects
                </SectionTitle>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Clarity</AdjustmentName>
                    <AdjustmentValue>{clarity > 0 ? `+${clarity}` : clarity}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={clarity}
                    onChange={(_, v) => setClarity(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
                <AdjustmentRow>
                  <AdjustmentLabel>
                    <AdjustmentName>Dehaze</AdjustmentName>
                    <AdjustmentValue>{dehaze > 0 ? `+${dehaze}` : dehaze}</AdjustmentValue>
                  </AdjustmentLabel>
                  <AdjustmentSlider
                    value={dehaze}
                    onChange={(_, v) => setDehaze(v as number)}
                    min={-100}
                    max={100}
                  />
                </AdjustmentRow>
              </AdjustmentSection>
            </>
          ) : (
            <>
              <AdjustmentSection>
                <SectionTitle>File Information</SectionTitle>
                <MetadataRow>
                  <MetadataLabel>Filename</MetadataLabel>
                  <MetadataValue>{images[selectedImage]?.name}</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Dimensions</MetadataLabel>
                  <MetadataValue>4000 x 2667</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>File Size</MetadataLabel>
                  <MetadataValue>8.2 MB</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Format</MetadataLabel>
                  <MetadataValue>JPEG</MetadataValue>
                </MetadataRow>
              </AdjustmentSection>

              <AdjustmentSection>
                <SectionTitle>Camera Settings</SectionTitle>
                <MetadataRow>
                  <MetadataLabel>Camera</MetadataLabel>
                  <MetadataValue>Sony A7S III</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Lens</MetadataLabel>
                  <MetadataValue>24-70mm f/2.8</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Focal Length</MetadataLabel>
                  <MetadataValue>35mm</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Aperture</MetadataLabel>
                  <MetadataValue>f/2.8</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Shutter Speed</MetadataLabel>
                  <MetadataValue>1/60s</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>ISO</MetadataLabel>
                  <MetadataValue>6400</MetadataValue>
                </MetadataRow>
              </AdjustmentSection>

              <AdjustmentSection>
                <SectionTitle>Capture Info</SectionTitle>
                <MetadataRow>
                  <MetadataLabel>Date</MetadataLabel>
                  <MetadataValue>Jan 15, 2024</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Time</MetadataLabel>
                  <MetadataValue>22:45:32</MetadataValue>
                </MetadataRow>
                <MetadataRow>
                  <MetadataLabel>Location</MetadataLabel>
                  <MetadataValue>Main Hall</MetadataValue>
                </MetadataRow>
              </AdjustmentSection>
            </>
          )}
        </PanelContent>
      </AdjustmentsPanel>
    </ToolContainer>
  );
};

export default ImagesTool;
