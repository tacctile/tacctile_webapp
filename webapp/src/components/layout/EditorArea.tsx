import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import AddIcon from '@mui/icons-material/Add';
import PhotoIcon from '@mui/icons-material/Photo';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import TimelineIcon from '@mui/icons-material/Timeline';

const TabBar = styled(Box)(({ theme }) => ({
  height: 35,
  backgroundColor: '#252525',
  borderBottom: '1px solid #2b2b2b',
  display: 'flex',
  alignItems: 'flex-end',
  overflowX: 'auto',
  overflowY: 'hidden',
  '&::-webkit-scrollbar': {
    height: 3,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#4b4b4b',
  },
}));

const Tab = styled(Box)<{ active?: boolean; isDragging?: boolean }>(({ active, isDragging }) => ({
  height: 35,
  minWidth: 120,
  maxWidth: 200,
  backgroundColor: active ? '#1e1e1e' : '#2d2d2d',
  borderRight: '1px solid #2b2b2b',
  borderTop: active ? '2px solid #19abb5' : '1px solid transparent',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  cursor: 'pointer',
  position: 'relative',
  opacity: isDragging ? 0.5 : 1,
  transition: 'all 0.2s',
  '&:hover': {
    backgroundColor: active ? '#1e1e1e' : '#353535',
    borderTop: active ? '2px solid #36d1da' : '1px solid #1f5f6b',
    '& .tab-close': {
      opacity: 1,
    },
  },
}));

const TabLabel = styled(Typography)({
  flex: 1,
  fontSize: 13,
  marginLeft: 4,
  marginRight: 4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  userSelect: 'none',
});

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  backgroundColor: '#1e1e1e',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'auto',
}));

const WelcomeScreen = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4),
  color: '#858585',
}));

interface Tab {
  id: string;
  title: string;
  pinned: boolean;
}

interface EditorAreaProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabPin: (tabId: string) => void;
  onTabReorder: (tabs: Tab[]) => void;
}

const EditorArea: React.FC<EditorAreaProps> = ({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onTabPin,
  onTabReorder,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);

  const handleTabDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTabDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== tabId) {
      setDragOverTab(tabId);
    }
  };

  const handleTabDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== targetId) {
      const draggedIndex = tabs.findIndex(t => t.id === draggedTab);
      const targetIndex = tabs.findIndex(t => t.id === targetId);

      const newTabs = [...tabs];
      const [removed] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, removed);

      onTabReorder(newTabs);
    }
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleTabDragEnd = () => {
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    // Handle file drops
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      // Process dropped files (evidence, etc.)
      console.log('Dropped file:', file.name);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <PhotoIcon fontSize="small" />;
    if (['wav', 'mp3', 'ogg'].includes(ext || '')) return <AudioFileIcon fontSize="small" />;
    if (['mp4', 'avi', 'mov'].includes(ext || '')) return <VideoFileIcon fontSize="small" />;
    if (['csv', 'json'].includes(ext || '')) return <TimelineIcon fontSize="small" />;
    return null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      {/* Tab bar */}
      <TabBar>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            active={activeTab === tab.id}
            isDragging={draggedTab === tab.id}
            draggable={!tab.pinned}
            onDragStart={(e) => handleTabDragStart(e, tab.id)}
            onDragOver={(e) => handleTabDragOver(e, tab.id)}
            onDrop={(e) => handleTabDrop(e, tab.id)}
            onDragEnd={handleTabDragEnd}
            onClick={() => onTabSelect(tab.id)}
            sx={{
              borderLeft: dragOverTab === tab.id ? '2px solid #19abb5' : undefined,
            }}
          >
            {getFileIcon(tab.title)}
            <TabLabel>{tab.title}</TabLabel>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onTabPin(tab.id);
              }}
              sx={{
                p: 0.25,
                mr: 0.5,
                color: '#858585',
                '&:hover': { color: '#e1e1e1' },
              }}
            >
              {tab.pinned ? (
                <PushPinIcon sx={{ fontSize: 14 }} />
              ) : (
                <PushPinOutlinedIcon sx={{ fontSize: 14 }} />
              )}
            </IconButton>
            {!tab.pinned && (
              <IconButton
                className="tab-close"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                sx={{
                  p: 0.25,
                  color: '#858585',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  '&:hover': { color: '#e1e1e1' },
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Tab>
        ))}
        <IconButton
          size="small"
          sx={{
            ml: 0.5,
            color: '#858585',
            '&:hover': { color: '#e1e1e1' },
          }}
        >
          <AddIcon />
        </IconButton>
      </TabBar>

      {/* Content area */}
      <ContentArea
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          border: isDraggingOver ? '2px dashed #19abb5' : 'none',
          backgroundColor: isDraggingOver ? 'rgba(25, 171, 181, 0.05)' : '#1e1e1e',
        }}
      >
        {tabs.length === 0 || !activeTab ? (
          <WelcomeScreen>
            <Typography variant="h5" sx={{ mb: 2, color: '#e1e1e1' }}>
              Welcome to Tacctile
            </Typography>
            <Typography variant="body2" sx={{ mb: 3 }}>
              Professional Paranormal Investigation Platform
            </Typography>
            <Typography variant="caption" display="block" sx={{ mb: 1 }}>
              • Select a tool from the activity bar to begin
            </Typography>
            <Typography variant="caption" display="block" sx={{ mb: 1 }}>
              • Drop evidence files here to analyze
            </Typography>
            <Typography variant="caption" display="block">
              • Press Ctrl+N to start a new investigation
            </Typography>
          </WelcomeScreen>
        ) : (
          <Box sx={{ p: 2, width: '100%', height: '100%' }}>
            <Typography variant="h6">
              {tabs.find(t => t.id === activeTab)?.title}
            </Typography>
            {/* Content for each tab would go here */}
          </Box>
        )}
      </ContentArea>
    </Box>
  );
};

export default EditorArea;