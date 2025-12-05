import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const Container = styled(Box)({
  padding: '8px',
  height: '100%',
});

const Row = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: 20,
  padding: '0 4px',
});

const Label = styled(Typography)({
  fontSize: '10px',
  color: '#666',
});

const Value = styled(Typography)({
  fontSize: '11px',
  color: '#ccc',
  textAlign: 'right',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '65%',
});

interface MetadataPanelProps {
  data: {
    fileName?: string;
    capturedAt?: number;
    duration?: number;      // seconds - for video/audio
    resolution?: string;    // for images, or video resolution
    user?: string;
    device?: string;
    format?: string;        // codec, sample rate, color space, etc.
    gps?: string;
    flagCount?: number;
  } | null;
  type?: 'video' | 'audio' | 'image';
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ data, type = 'video' }) => {
  const formatTimestamp = (ts?: number): string => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '—';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Row 3 label changes based on type
  const row3Label = type === 'image' ? 'Resolution' : 'Duration';
  const row3Value = type === 'image'
    ? (data?.resolution || '—')
    : formatDuration(data?.duration);

  return (
    <Container>
      <Row>
        <Label>Filename</Label>
        <Value>{data?.fileName || '—'}</Value>
      </Row>
      <Row>
        <Label>Captured</Label>
        <Value>{formatTimestamp(data?.capturedAt)}</Value>
      </Row>
      <Row>
        <Label>{row3Label}</Label>
        <Value>{row3Value}</Value>
      </Row>
      <Row>
        <Label>User</Label>
        <Value>{data?.user || '—'}</Value>
      </Row>
      <Row>
        <Label>Device</Label>
        <Value>{data?.device || '—'}</Value>
      </Row>
      <Row>
        <Label>Format</Label>
        <Value>{data?.format || '—'}</Value>
      </Row>
      <Row>
        <Label>GPS</Label>
        <Value>{data?.gps || '—'}</Value>
      </Row>
      <Row>
        <Label>Flags</Label>
        <Value sx={{ color: data?.flagCount ? '#19abb5' : '#666' }}>
          {data?.flagCount ?? '—'}
        </Value>
      </Row>
    </Container>
  );
};

export default MetadataPanel;
