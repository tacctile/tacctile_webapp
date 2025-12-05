import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { styled } from '@mui/material/styles';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ImageIcon from '@mui/icons-material/Image';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import DescriptionIcon from '@mui/icons-material/Description';

const StyledSidePanel = styled(Box)(({ theme }) => ({
  backgroundColor: '#1e1e1e',
  borderRight: '1px solid #2b2b2b',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
}));

const Header = styled(Box)(({ theme }) => ({
  padding: '8px 12px',
  borderBottom: '1px solid #2b2b2b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: 35,
}));

const ResizeHandle = styled(Box)(({ theme }) => ({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 4,
  cursor: 'col-resize',
  '&:hover': {
    backgroundColor: 'rgba(25, 171, 181, 0.3)',
  },
}));

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FileNode[];
  extension?: string;
}

const mockFileTree: FileNode[] = [
  {
    id: '1',
    name: 'Investigation_2024_01',
    type: 'folder',
    children: [
      {
        id: '2',
        name: 'Evidence',
        type: 'folder',
        children: [
          { id: '3', name: 'photo_001.jpg', type: 'file', extension: 'jpg' },
          { id: '4', name: 'audio_recording.wav', type: 'file', extension: 'wav' },
          { id: '5', name: 'sensor_data.csv', type: 'file', extension: 'csv' },
        ],
      },
      {
        id: '6',
        name: 'Reports',
        type: 'folder',
        children: [
          { id: '7', name: 'preliminary_report.md', type: 'file', extension: 'md' },
          { id: '8', name: 'analysis.pdf', type: 'file', extension: 'pdf' },
        ],
      },
      { id: '9', name: 'notes.txt', type: 'file', extension: 'txt' },
    ],
  },
];

interface SidePanelProps {
  width: number;
  selectedTool: string;
  onResize: (width: number) => void;
  onClose: () => void;
  onFileOpen: (file: { id: string; name: string }) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  width,
  selectedTool,
  onResize,
  onClose,
  onFileOpen,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['1']);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(150, Math.min(600, startWidthRef.current + deltaX));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onResize]);

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const getFileIcon = (extension?: string) => {
    if (!extension) return <InsertDriveFileIcon fontSize="small" />;
    const ext = extension.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return <ImageIcon fontSize="small" />;
    if (['wav', 'mp3', 'ogg', 'm4a'].includes(ext)) return <AudioFileIcon fontSize="small" />;
    if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return <VideoFileIcon fontSize="small" />;
    if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(ext)) return <DescriptionIcon fontSize="small" />;
    return <InsertDriveFileIcon fontSize="small" />;
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.includes(node.id);
      const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch && node.type === 'file') return null;

      return (
        <React.Fragment key={node.id}>
          <ListItem
            button
            onClick={() => {
              if (node.type === 'folder') {
                toggleFolder(node.id);
              } else {
                onFileOpen({ id: node.id, name: node.name });
              }
            }}
            sx={{
              pl: 2 + level * 2,
              py: 0.5,
              minHeight: 28,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 24, mr: 1 }}>
              {node.type === 'folder' ? (
                isExpanded ? (
                  <ExpandMoreIcon fontSize="small" />
                ) : (
                  <ChevronRightIcon fontSize="small" />
                )
              ) : null}
            </ListItemIcon>
            <ListItemIcon sx={{ minWidth: 20, mr: 1 }}>
              {node.type === 'folder' ? (
                isExpanded ? (
                  <FolderOpenIcon fontSize="small" />
                ) : (
                  <FolderIcon fontSize="small" />
                )
              ) : (
                getFileIcon(node.extension)
              )}
            </ListItemIcon>
            <ListItemText
              primary={node.name}
              primaryTypographyProps={{
                fontSize: 13,
                noWrap: true,
              }}
            />
          </ListItem>
          {node.type === 'folder' && node.children && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              {renderFileTree(node.children, level + 1)}
            </Collapse>
          )}
        </React.Fragment>
      );
    });
  };

  const getPanelTitle = () => {
    const titles: { [key: string]: string } = {
      photo: 'Photo Evidence',
      video: 'Video Recordings',
      audio: 'Audio Sessions',
      sensor: 'Sensor Readings',
      analysis: 'Data Analysis',
      thermal: 'Thermal Images',
      motion: 'Motion Events',
      radiosweep: 'Radio Sweep Sessions',
      settings: 'Settings',
    };
    return titles[selectedTool] || 'Explorer';
  };

  return (
    <StyledSidePanel sx={{ width }}>
      <Header>
        <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500, color: '#e1e1e1' }}>
          {getPanelTitle()}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: '#858585', '&:hover': { color: '#e1e1e1' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Header>

      {/* Search bar */}
      <Box sx={{ p: 1, borderBottom: '1px solid #2b2b2b' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: '#858585' }} />
              </InputAdornment>
            ),
            sx: {
              fontSize: 13,
              backgroundColor: '#252525',
              '& fieldset': { border: 'none' },
            },
          }}
        />
      </Box>

      {/* File tree */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <List dense disablePadding>
          {renderFileTree(mockFileTree)}
        </List>
      </Box>

      {/* Resize handle */}
      <ResizeHandle onMouseDown={handleResizeStart} />
    </StyledSidePanel>
  );
};

export default SidePanel;