/**
 * LoadingSkeleton Component
 * Provides skeleton loading states for different tool layouts
 */

import React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { styled, keyframes } from '@mui/material/styles';

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const SkeletonContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#121212',
  overflow: 'hidden',
});

const SkeletonToolbar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  gap: 8,
});

const SkeletonMainContent = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const SkeletonSidePanel = styled(Box)({
  width: 280,
  backgroundColor: '#141414',
  borderLeft: '1px solid #2b2b2b',
  padding: 16,
});

const SkeletonCenterArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: 16,
  gap: 16,
});

const AnimatedSkeleton = styled(Skeleton)({
  backgroundColor: '#252525',
  '&::after': {
    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)`,
    animation: `${shimmer} 1.5s infinite`,
  },
});

interface LoadingSkeletonProps {
  variant?: 'audio' | 'video' | 'image' | 'streaming' | 'timeline' | 'generic';
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ variant = 'generic' }) => {
  if (variant === 'audio') {
    return (
      <SkeletonContainer>
        <SkeletonToolbar>
          <AnimatedSkeleton variant="rectangular" width={100} height={28} sx={{ borderRadius: 1 }} />
          <Box sx={{ flex: 1 }} />
          <AnimatedSkeleton variant="rectangular" width={80} height={28} sx={{ borderRadius: 1 }} />
        </SkeletonToolbar>
        <SkeletonMainContent>
          <SkeletonCenterArea>
            {/* Waveform area */}
            <AnimatedSkeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
            {/* Spectrogram area */}
            <AnimatedSkeleton variant="rectangular" height="100%" sx={{ borderRadius: 1, flex: 1 }} />
          </SkeletonCenterArea>
          <SkeletonSidePanel>
            <AnimatedSkeleton variant="text" width="60%" height={24} />
            <Box sx={{ mt: 2 }}>
              {[...Array(5)].map((_, i) => (
                <AnimatedSkeleton key={i} variant="rectangular" height={32} sx={{ borderRadius: 1, mb: 1 }} />
              ))}
            </Box>
          </SkeletonSidePanel>
        </SkeletonMainContent>
        {/* Transport bar */}
        <Box sx={{ p: 2, backgroundColor: '#1a1a1a', borderTop: '1px solid #2b2b2b', display: 'flex', justifyContent: 'center', gap: 2 }}>
          <AnimatedSkeleton variant="circular" width={48} height={48} />
          <AnimatedSkeleton variant="rectangular" width={200} height={48} sx={{ borderRadius: 1 }} />
        </Box>
      </SkeletonContainer>
    );
  }

  if (variant === 'image') {
    return (
      <SkeletonContainer>
        <SkeletonToolbar>
          <AnimatedSkeleton variant="rectangular" width={100} height={28} sx={{ borderRadius: 1 }} />
          <AnimatedSkeleton variant="rectangular" width={120} height={28} sx={{ borderRadius: 1 }} />
          <Box sx={{ flex: 1 }} />
          <AnimatedSkeleton variant="rectangular" width={80} height={28} sx={{ borderRadius: 1 }} />
        </SkeletonToolbar>
        <SkeletonMainContent>
          <SkeletonCenterArea>
            <AnimatedSkeleton variant="rectangular" height="100%" sx={{ borderRadius: 1 }} />
          </SkeletonCenterArea>
          <SkeletonSidePanel>
            <AnimatedSkeleton variant="text" width="60%" height={24} />
            {[...Array(8)].map((_, i) => (
              <Box key={i} sx={{ mt: 2 }}>
                <AnimatedSkeleton variant="text" width="40%" height={16} />
                <AnimatedSkeleton variant="rectangular" height={8} sx={{ borderRadius: 1, mt: 1 }} />
              </Box>
            ))}
          </SkeletonSidePanel>
        </SkeletonMainContent>
      </SkeletonContainer>
    );
  }

  if (variant === 'streaming') {
    return (
      <SkeletonContainer>
        <SkeletonToolbar>
          <AnimatedSkeleton variant="rectangular" width={100} height={28} sx={{ borderRadius: 1 }} />
          <Box sx={{ flex: 1 }} />
          <AnimatedSkeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
          <AnimatedSkeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
        </SkeletonToolbar>
        <SkeletonMainContent>
          {/* Left panel */}
          <Box sx={{ width: 280, backgroundColor: '#141414', borderRight: '1px solid #2b2b2b', p: 2 }}>
            <AnimatedSkeleton variant="text" width="60%" height={24} />
            {[...Array(4)].map((_, i) => (
              <AnimatedSkeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1, mt: 1 }} />
            ))}
          </Box>
          {/* Center preview */}
          <SkeletonCenterArea>
            <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
              <AnimatedSkeleton variant="rectangular" sx={{ flex: 1, borderRadius: 1 }} />
              <AnimatedSkeleton variant="rectangular" sx={{ flex: 1, borderRadius: 1 }} />
            </Box>
            <AnimatedSkeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
          </SkeletonCenterArea>
          {/* Right panel */}
          <SkeletonSidePanel sx={{ width: 320 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              {[...Array(3)].map((_, i) => (
                <AnimatedSkeleton key={i} variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
              ))}
            </Box>
            {[...Array(5)].map((_, i) => (
              <AnimatedSkeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1, mt: 1 }} />
            ))}
          </SkeletonSidePanel>
        </SkeletonMainContent>
      </SkeletonContainer>
    );
  }

  if (variant === 'timeline') {
    return (
      <SkeletonContainer>
        <SkeletonToolbar>
          <AnimatedSkeleton variant="text" width={150} height={24} />
          <AnimatedSkeleton variant="rectangular" width={200} height={28} sx={{ borderRadius: 1, ml: 2 }} />
          <Box sx={{ flex: 1 }} />
          <AnimatedSkeleton variant="rectangular" width={100} height={28} sx={{ borderRadius: 1 }} />
        </SkeletonToolbar>
        <SkeletonMainContent>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Ruler */}
            <AnimatedSkeleton variant="rectangular" height={40} sx={{ borderRadius: 0 }} />
            {/* Tracks */}
            <Box sx={{ flex: 1, p: 2 }}>
              {[...Array(5)].map((_, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AnimatedSkeleton variant="rectangular" width={100} height={40} sx={{ borderRadius: 1 }} />
                  <AnimatedSkeleton variant="rectangular" height={40} sx={{ borderRadius: 1, flex: 1, ml: 1 }} />
                </Box>
              ))}
            </Box>
          </Box>
          <SkeletonSidePanel>
            <AnimatedSkeleton variant="text" width="60%" height={24} />
            {[...Array(6)].map((_, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <AnimatedSkeleton variant="text" width="40%" height={16} />
                <AnimatedSkeleton variant="text" width="30%" height={16} />
              </Box>
            ))}
          </SkeletonSidePanel>
        </SkeletonMainContent>
      </SkeletonContainer>
    );
  }

  // Generic skeleton
  return (
    <SkeletonContainer>
      <SkeletonToolbar>
        <AnimatedSkeleton variant="rectangular" width={100} height={28} sx={{ borderRadius: 1 }} />
        <Box sx={{ flex: 1 }} />
        <AnimatedSkeleton variant="rectangular" width={80} height={28} sx={{ borderRadius: 1 }} />
      </SkeletonToolbar>
      <SkeletonMainContent>
        <SkeletonCenterArea>
          <AnimatedSkeleton variant="rectangular" height="100%" sx={{ borderRadius: 1 }} />
        </SkeletonCenterArea>
      </SkeletonMainContent>
    </SkeletonContainer>
  );
};

export default LoadingSkeleton;
