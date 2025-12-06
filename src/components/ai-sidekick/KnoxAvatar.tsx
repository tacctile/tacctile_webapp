/**
 * KnoxAvatar Component
 * Animated AI avatar with personality states
 */

import React from 'react';
import { Box, keyframes } from '@mui/material';
import { styled } from '@mui/material/styles';

// ============================================================================
// TYPES
// ============================================================================

export type KnoxState = 'idle' | 'typing' | 'thinking' | 'responding' | 'complete';

interface KnoxAvatarProps {
  state: KnoxState;
  size?: number;
}

// ============================================================================
// KEYFRAME ANIMATIONS
// ============================================================================

// Idle state: gentle breathing pulse
const idlePulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
`;

// Typing state: quickened pulse with brightness
const typingPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.95;
    filter: brightness(1);
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
    filter: brightness(1.15);
  }
`;

// Complete state: micro-bounce celebration
const completeBounce = keyframes`
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.15);
  }
  50% {
    transform: scale(0.95);
  }
  75% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

// Thinking swirl rotation
const swirlRotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Swirl gradient animation
const swirlGradient = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

// Swirl pulse effect
const swirlPulse = keyframes`
  0%, 100% {
    opacity: 0.6;
    transform: rotate(0deg) scale(1);
  }
  25% {
    opacity: 0.9;
    transform: rotate(90deg) scale(1.1);
  }
  50% {
    opacity: 0.7;
    transform: rotate(180deg) scale(1.05);
  }
  75% {
    opacity: 0.85;
    transform: rotate(270deg) scale(1.08);
  }
`;

// Responding state: calming swirl
const respondingPulse = keyframes`
  0%, 100% {
    opacity: 0.4;
    transform: rotate(0deg) scale(1);
  }
  50% {
    opacity: 0.6;
    transform: rotate(180deg) scale(1.02);
  }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const AvatarContainer = styled(Box)<{ size: number }>(({ size }) => ({
  position: 'relative',
  width: size,
  height: size,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const AvatarCircle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'knoxState' && prop !== 'size',
})<{ knoxState: KnoxState; size: number }>(({ knoxState, size }) => {
  const baseStyles = {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: '#19abb5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Inter", "Roboto", sans-serif',
    fontWeight: 600,
    fontSize: size * 0.55,
    color: '#ffffff',
    position: 'relative' as const,
    zIndex: 2,
    transition: 'all 180ms ease-out',
    boxShadow: '0 2px 8px rgba(25, 171, 181, 0.3)',
  };

  switch (knoxState) {
    case 'idle':
      return {
        ...baseStyles,
        animation: `${idlePulse} 3.5s ease-in-out infinite`,
      };
    case 'typing':
      return {
        ...baseStyles,
        animation: `${typingPulse} 1.8s ease-in-out infinite`,
        boxShadow: '0 2px 12px rgba(25, 171, 181, 0.45)',
      };
    case 'thinking':
      return {
        ...baseStyles,
        animation: `${typingPulse} 1.2s ease-in-out infinite`,
        boxShadow: '0 2px 16px rgba(25, 171, 181, 0.5)',
      };
    case 'responding':
      return {
        ...baseStyles,
        animation: `${idlePulse} 2.5s ease-in-out infinite`,
        boxShadow: '0 2px 12px rgba(25, 171, 181, 0.4)',
      };
    case 'complete':
      return {
        ...baseStyles,
        animation: `${completeBounce} 400ms ease-out forwards`,
        boxShadow: '0 2px 14px rgba(25, 171, 181, 0.5)',
      };
    default:
      return baseStyles;
  }
});

// Swirl effect container - positioned behind avatar
const SwirlContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'knoxState' && prop !== 'size',
})<{ knoxState: KnoxState; size: number }>(({ knoxState, size }) => {
  const swirlSize = size * 1.6;
  const isThinking = knoxState === 'thinking';
  const isResponding = knoxState === 'responding';
  const showSwirl = isThinking || isResponding;

  return {
    position: 'absolute',
    width: swirlSize,
    height: swirlSize,
    borderRadius: '50%',
    opacity: showSwirl ? 1 : 0,
    transition: 'opacity 300ms ease-out',
    pointerEvents: 'none',
    zIndex: 1,
  };
});

// Individual swirl rings
const SwirlRing = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'knoxState' && prop !== 'ringIndex',
})<{ knoxState: KnoxState; ringIndex: number }>(({ knoxState, ringIndex }) => {
  const isThinking = knoxState === 'thinking';
  const isResponding = knoxState === 'responding';

  // Different timing for each ring for organic feel
  const durations = [2.5, 3.2, 4];
  const delays = [0, 0.5, 1];
  const scales = [1, 1.15, 1.3];

  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    transform: `translate(-50%, -50%) scale(${scales[ringIndex]})`,
    background: `conic-gradient(
      from ${ringIndex * 120}deg,
      transparent 0deg,
      rgba(25, 171, 181, ${0.4 - ringIndex * 0.1}) 60deg,
      rgba(25, 171, 181, ${0.6 - ringIndex * 0.1}) 120deg,
      rgba(40, 200, 210, ${0.4 - ringIndex * 0.1}) 180deg,
      rgba(25, 171, 181, ${0.3 - ringIndex * 0.05}) 240deg,
      transparent 300deg,
      transparent 360deg
    )`,
    animation: isThinking
      ? `${swirlPulse} ${durations[ringIndex]}s ease-in-out ${delays[ringIndex]}s infinite`
      : isResponding
        ? `${respondingPulse} ${durations[ringIndex] * 1.5}s ease-in-out ${delays[ringIndex]}s infinite`
        : 'none',
    opacity: isThinking ? 0.8 : isResponding ? 0.4 : 0,
    transition: 'opacity 300ms ease-out',
  };
});

// Soft glow behind everything
const GlowEffect = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'knoxState' && prop !== 'size',
})<{ knoxState: KnoxState; size: number }>(({ knoxState, size }) => {
  const glowSize = size * 2;
  const isThinking = knoxState === 'thinking';
  const isResponding = knoxState === 'responding';

  return {
    position: 'absolute',
    width: glowSize,
    height: glowSize,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(25, 171, 181, 0.3) 0%, transparent 70%)',
    opacity: isThinking ? 0.8 : isResponding ? 0.5 : 0,
    transition: 'opacity 300ms ease-out',
    pointerEvents: 'none',
    zIndex: 0,
  };
});

// ============================================================================
// COMPONENT
// ============================================================================

export const KnoxAvatar: React.FC<KnoxAvatarProps> = ({ state, size = 28 }) => {
  return (
    <AvatarContainer size={size * 2}>
      {/* Background glow */}
      <GlowEffect knoxState={state} size={size} />

      {/* Swirl effect rings */}
      <SwirlContainer knoxState={state} size={size}>
        <SwirlRing knoxState={state} ringIndex={0} />
        <SwirlRing knoxState={state} ringIndex={1} />
        <SwirlRing knoxState={state} ringIndex={2} />
      </SwirlContainer>

      {/* Main avatar circle with "K" */}
      <AvatarCircle knoxState={state} size={size}>
        K
      </AvatarCircle>
    </AvatarContainer>
  );
};

export default KnoxAvatar;
