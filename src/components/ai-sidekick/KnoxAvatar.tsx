/**
 * KnoxAvatar Component
 * Lottie-based animated AI avatar with personality states
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, keyframes } from '@mui/material';
import { styled } from '@mui/material/styles';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';

// ============================================================================
// TYPES
// ============================================================================

export type KnoxState = 'idle' | 'typing' | 'thinking' | 'responding' | 'complete';

interface KnoxAvatarProps {
  state: KnoxState;
  size?: number;
}

// Animation speed mapping for each state
const STATE_SPEEDS: Record<KnoxState, number> = {
  idle: 0.3,       // Slow gentle breathing
  typing: 0.5,     // More alert
  thinking: 1.0,   // Full active
  responding: 0.7, // Calming down
  complete: 0.3,   // Return to idle speed
};

// ============================================================================
// KEYFRAME ANIMATIONS (for micro-interactions)
// ============================================================================

// Complete state: micro-bounce celebration
const completeBounce = keyframes`
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.1);
  }
  60% {
    transform: scale(0.98);
  }
  100% {
    transform: scale(1);
  }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const AvatarContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'size' && prop !== 'isComplete',
})<{ size: number; isComplete: boolean }>(({ size, isComplete }) => ({
  position: 'relative',
  width: size,
  height: size,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'visible', // Allow animation to bleed outside bounds
  // Micro-bounce animation on complete
  animation: isComplete ? `${completeBounce} 350ms ease-out` : 'none',
  transition: 'transform 180ms ease-out',
}));

const LottieWrapper = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'size',
})<{ size: number }>(({ size }) => ({
  position: 'absolute',
  width: size * 1.4, // Slightly larger to allow glow bleed (4-8px)
  height: size * 1.4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'visible',
  // Center the larger animation
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  // Soft edges for organic feel
  filter: 'drop-shadow(0 0 4px rgba(25, 171, 181, 0.3))',
  transition: 'filter 200ms ease-out',
}));

// ============================================================================
// COMPONENT
// ============================================================================

export const KnoxAvatar: React.FC<KnoxAvatarProps> = ({ state, size = 36 }) => {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(STATE_SPEEDS.idle);
  const [isComplete, setIsComplete] = useState(false);
  const previousStateRef = useRef<KnoxState>(state);
  const [animationData, setAnimationData] = useState<object | null>(null);

  // Load animation data from public folder
  useEffect(() => {
    fetch('/animation/knoxorb.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error('Failed to load Knox orb animation:', err));
  }, []);

  // Smooth speed transition function
  const transitionSpeed = useCallback((targetSpeed: number, duration: number = 150) => {
    const startSpeed = currentSpeed;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out function for smooth transition
      const easeOut = 1 - Math.pow(1 - progress, 2);
      const newSpeed = startSpeed + (targetSpeed - startSpeed) * easeOut;

      if (lottieRef.current) {
        lottieRef.current.setSpeed(newSpeed);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrentSpeed(targetSpeed);
      }
    };

    requestAnimationFrame(animate);
  }, [currentSpeed]);

  // Handle state changes
  useEffect(() => {
    if (!animationData) return;

    const prevState = previousStateRef.current;
    previousStateRef.current = state;

    if (state === 'complete') {
      // Trigger micro-bounce
      setIsComplete(true);

      // Brief pause effect
      if (lottieRef.current) {
        // Slight pause then resume at idle speed
        setTimeout(() => {
          transitionSpeed(STATE_SPEEDS.idle, 200);
        }, 100);
      }

      // Reset complete state after animation
      setTimeout(() => {
        setIsComplete(false);
      }, 400);
    } else {
      // Smooth transition to target speed
      const targetSpeed = STATE_SPEEDS[state];
      transitionSpeed(targetSpeed, 180);
    }
  }, [state, transitionSpeed, animationData]);

  // Set initial speed on mount
  useEffect(() => {
    if (lottieRef.current && animationData) {
      lottieRef.current.setSpeed(STATE_SPEEDS.idle);
    }
  }, [animationData]);

  // Show nothing while loading (prevents flash)
  if (!animationData) {
    return <AvatarContainer size={size} isComplete={false} />;
  }

  return (
    <AvatarContainer size={size} isComplete={isComplete}>
      <LottieWrapper size={size}>
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={true}
          autoplay={true}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </LottieWrapper>
    </AvatarContainer>
  );
};

export default KnoxAvatar;
