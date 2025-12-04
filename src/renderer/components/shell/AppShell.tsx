import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';

import TopBar from './TopBar';
import LeftRail from './LeftRail';
import SessionTimeline from './SessionTimeline';
import { Investigation, User, TimelineItem } from '../../types';

const ShellContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const MainLayout = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const ContentArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0,
});

const ToolContainer = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

interface AppShellProps {
  investigation?: Investigation;
  user?: User;
}

const AppShell: React.FC<AppShellProps> = ({ investigation, user }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date(Date.now() - 1800000));

  // Demo timeline items
  const demoTimelineItems: TimelineItem[] = [
    {
      id: '1',
      type: 'video',
      timestamp: new Date(Date.now() - 3500000),
      duration: 600,
      source: 'Camera 1',
      metadata: {},
      markers: [
        { id: 'm1', timestamp: new Date(Date.now() - 3400000), label: 'Motion detected', type: 'anomaly', color: '#ef4444' },
      ],
    },
    {
      id: '2',
      type: 'audio',
      timestamp: new Date(Date.now() - 3000000),
      duration: 1200,
      source: 'EVP Recorder',
      metadata: {},
      markers: [
        { id: 'm2', timestamp: new Date(Date.now() - 2800000), label: 'Voice anomaly', type: 'evidence', color: '#f59e0b' },
      ],
    },
    {
      id: '3',
      type: 'image',
      timestamp: new Date(Date.now() - 2500000),
      source: 'DSLR Camera',
      metadata: {},
    },
    {
      id: '4',
      type: 'sensor_event',
      timestamp: new Date(Date.now() - 2200000),
      duration: 30,
      source: 'EMF Detector',
      metadata: { value: 8.5, unit: 'mG' },
    },
    {
      id: '5',
      type: 'video',
      timestamp: new Date(Date.now() - 1800000),
      duration: 900,
      source: 'Camera 2',
      metadata: {},
    },
    {
      id: '6',
      type: 'stream_clip',
      timestamp: new Date(Date.now() - 1200000),
      duration: 300,
      source: 'YouTube Live',
      metadata: {},
    },
  ];

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: Date) => {
    setCurrentTime(time);
  };

  const handleItemSelect = (item: TimelineItem) => {
    console.log('Selected item:', item);
    setCurrentTime(item.timestamp);
  };

  const handleOpenInvestigation = () => {
    console.log('Open investigation selector');
  };

  const handleOpenSettings = () => {
    console.log('Open settings');
  };

  const handleOpenNotifications = () => {
    console.log('Open notifications');
  };

  return (
    <ShellContainer>
      {/* Top Bar */}
      <TopBar
        investigation={investigation}
        user={user}
        onOpenInvestigation={handleOpenInvestigation}
        onOpenSettings={handleOpenSettings}
        onOpenNotifications={handleOpenNotifications}
      />

      {/* Main Layout */}
      <MainLayout>
        {/* Left Rail - Tool Navigation */}
        <LeftRail />

        {/* Content Area */}
        <ContentArea>
          {/* Tool-specific content rendered via router outlet */}
          <ToolContainer>
            <Outlet />
          </ToolContainer>

          {/* Session Timeline - Always visible at bottom */}
          <SessionTimeline
            items={demoTimelineItems}
            sessionStart={new Date(Date.now() - 3600000)}
            sessionEnd={new Date()}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onItemSelect={handleItemSelect}
          />
        </ContentArea>
      </MainLayout>
    </ShellContainer>
  );
};

export default AppShell;
