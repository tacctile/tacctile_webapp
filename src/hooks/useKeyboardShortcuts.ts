/**
 * useKeyboardShortcuts Hook
 * Provides centralized keyboard shortcut handling for power users
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: () => void;
  category: 'navigation' | 'playback' | 'editing' | 'view' | 'file' | 'tool';
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onShortcutTriggered?: (shortcut: KeyboardShortcut) => void;
}

// Global shortcuts registry
const globalShortcuts: Map<string, KeyboardShortcut> = new Map();

// Helper to create shortcut key string
const getShortcutKey = (e: KeyboardEvent | KeyboardShortcut): string => {
  const key = 'key' in e ? e.key.toLowerCase() : e.key.toLowerCase();
  const ctrl = 'ctrlKey' in e ? e.ctrlKey : e.ctrl;
  const shift = 'shiftKey' in e ? e.shiftKey : e.shift;
  const alt = 'altKey' in e ? e.altKey : e.alt;
  const meta = 'metaKey' in e ? e.metaKey : e.meta;

  const parts: string[] = [];
  if (ctrl || meta) parts.push('ctrl');
  if (shift) parts.push('shift');
  if (alt) parts.push('alt');
  parts.push(key);

  return parts.join('+');
};

// Format shortcut for display
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');

  // Format key nicely
  let key = shortcut.key.toUpperCase();
  switch (key) {
    case ' ':
      key = 'Space';
      break;
    case 'ARROWLEFT':
      key = '←';
      break;
    case 'ARROWRIGHT':
      key = '→';
      break;
    case 'ARROWUP':
      key = '↑';
      break;
    case 'ARROWDOWN':
      key = '↓';
      break;
    case 'ESCAPE':
      key = 'Esc';
      break;
    case 'DELETE':
      key = 'Del';
      break;
    case 'BACKSPACE':
      key = '⌫';
      break;
  }
  parts.push(key);

  return parts.join(isMac ? '' : '+');
};

export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) => {
  const { enabled = true, onShortcutTriggered } = options;
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;

    // Register shortcuts globally
    shortcuts.forEach((shortcut) => {
      const key = getShortcutKey(shortcut);
      globalShortcuts.set(key, shortcut);
    });

    return () => {
      // Cleanup on unmount
      shortcuts.forEach((shortcut) => {
        const key = getShortcutKey(shortcut);
        globalShortcuts.delete(key);
      });
    };
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow some shortcuts in inputs (like Ctrl+S for save)
        const shortcutKey = getShortcutKey(e);
        const shortcut = shortcutsRef.current.find(
          (s) => getShortcutKey(s) === shortcutKey && s.category === 'file'
        );
        if (!shortcut) return;
      }

      const shortcutKey = getShortcutKey(e);
      const shortcut = shortcutsRef.current.find(
        (s) => getShortcutKey(s) === shortcutKey && (s.enabled ?? true)
      );

      if (shortcut) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.handler();
        onShortcutTriggered?.(shortcut);
      }
    },
    [enabled, onShortcutTriggered]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts: shortcutsRef.current,
    formatShortcut,
  };
};

// Pre-defined shortcut sets for different contexts
export const createPlaybackShortcuts = (handlers: {
  play?: () => void;
  pause?: () => void;
  stop?: () => void;
  seekForward?: () => void;
  seekBackward?: () => void;
  toggleLoop?: () => void;
  toggleMute?: () => void;
  volumeUp?: () => void;
  volumeDown?: () => void;
}): KeyboardShortcut[] => [
  {
    key: ' ',
    description: 'Play/Pause',
    handler: () => handlers.play?.() || handlers.pause?.(),
    category: 'playback',
  },
  {
    key: 's',
    description: 'Stop',
    handler: () => handlers.stop?.(),
    category: 'playback',
    enabled: !!handlers.stop,
  },
  {
    key: 'ArrowRight',
    description: 'Seek forward 5s',
    handler: () => handlers.seekForward?.(),
    category: 'playback',
    enabled: !!handlers.seekForward,
  },
  {
    key: 'ArrowLeft',
    description: 'Seek backward 5s',
    handler: () => handlers.seekBackward?.(),
    category: 'playback',
    enabled: !!handlers.seekBackward,
  },
  {
    key: 'ArrowRight',
    shift: true,
    description: 'Seek forward 30s',
    handler: () => handlers.seekForward?.(),
    category: 'playback',
    enabled: !!handlers.seekForward,
  },
  {
    key: 'ArrowLeft',
    shift: true,
    description: 'Seek backward 30s',
    handler: () => handlers.seekBackward?.(),
    category: 'playback',
    enabled: !!handlers.seekBackward,
  },
  {
    key: 'l',
    description: 'Toggle loop',
    handler: () => handlers.toggleLoop?.(),
    category: 'playback',
    enabled: !!handlers.toggleLoop,
  },
  {
    key: 'm',
    description: 'Toggle mute',
    handler: () => handlers.toggleMute?.(),
    category: 'playback',
    enabled: !!handlers.toggleMute,
  },
  {
    key: 'ArrowUp',
    description: 'Volume up',
    handler: () => handlers.volumeUp?.(),
    category: 'playback',
    enabled: !!handlers.volumeUp,
  },
  {
    key: 'ArrowDown',
    description: 'Volume down',
    handler: () => handlers.volumeDown?.(),
    category: 'playback',
    enabled: !!handlers.volumeDown,
  },
];

export const createEditingShortcuts = (handlers: {
  undo?: () => void;
  redo?: () => void;
  save?: () => void;
  delete?: () => void;
  selectAll?: () => void;
  copy?: () => void;
  paste?: () => void;
  cut?: () => void;
  duplicate?: () => void;
}): KeyboardShortcut[] => [
  {
    key: 'z',
    ctrl: true,
    description: 'Undo',
    handler: () => handlers.undo?.(),
    category: 'editing',
    enabled: !!handlers.undo,
  },
  {
    key: 'z',
    ctrl: true,
    shift: true,
    description: 'Redo',
    handler: () => handlers.redo?.(),
    category: 'editing',
    enabled: !!handlers.redo,
  },
  {
    key: 'y',
    ctrl: true,
    description: 'Redo',
    handler: () => handlers.redo?.(),
    category: 'editing',
    enabled: !!handlers.redo,
  },
  {
    key: 's',
    ctrl: true,
    description: 'Save',
    handler: () => handlers.save?.(),
    category: 'file',
    enabled: !!handlers.save,
  },
  {
    key: 'Delete',
    description: 'Delete selected',
    handler: () => handlers.delete?.(),
    category: 'editing',
    enabled: !!handlers.delete,
  },
  {
    key: 'Backspace',
    description: 'Delete selected',
    handler: () => handlers.delete?.(),
    category: 'editing',
    enabled: !!handlers.delete,
  },
  {
    key: 'a',
    ctrl: true,
    description: 'Select all',
    handler: () => handlers.selectAll?.(),
    category: 'editing',
    enabled: !!handlers.selectAll,
  },
  {
    key: 'c',
    ctrl: true,
    description: 'Copy',
    handler: () => handlers.copy?.(),
    category: 'editing',
    enabled: !!handlers.copy,
  },
  {
    key: 'v',
    ctrl: true,
    description: 'Paste',
    handler: () => handlers.paste?.(),
    category: 'editing',
    enabled: !!handlers.paste,
  },
  {
    key: 'x',
    ctrl: true,
    description: 'Cut',
    handler: () => handlers.cut?.(),
    category: 'editing',
    enabled: !!handlers.cut,
  },
  {
    key: 'd',
    ctrl: true,
    description: 'Duplicate',
    handler: () => handlers.duplicate?.(),
    category: 'editing',
    enabled: !!handlers.duplicate,
  },
];

export const createViewShortcuts = (handlers: {
  zoomIn?: () => void;
  zoomOut?: () => void;
  fitToView?: () => void;
  toggleFullscreen?: () => void;
  toggleSidePanel?: () => void;
  toggleBottomPanel?: () => void;
}): KeyboardShortcut[] => [
  {
    key: '=',
    ctrl: true,
    description: 'Zoom in',
    handler: () => handlers.zoomIn?.(),
    category: 'view',
    enabled: !!handlers.zoomIn,
  },
  {
    key: '-',
    ctrl: true,
    description: 'Zoom out',
    handler: () => handlers.zoomOut?.(),
    category: 'view',
    enabled: !!handlers.zoomOut,
  },
  {
    key: '0',
    ctrl: true,
    description: 'Fit to view',
    handler: () => handlers.fitToView?.(),
    category: 'view',
    enabled: !!handlers.fitToView,
  },
  {
    key: 'F11',
    description: 'Toggle fullscreen',
    handler: () => handlers.toggleFullscreen?.(),
    category: 'view',
    enabled: !!handlers.toggleFullscreen,
  },
  {
    key: 'b',
    ctrl: true,
    description: 'Toggle side panel',
    handler: () => handlers.toggleSidePanel?.(),
    category: 'view',
    enabled: !!handlers.toggleSidePanel,
  },
  {
    key: 'j',
    ctrl: true,
    description: 'Toggle bottom panel',
    handler: () => handlers.toggleBottomPanel?.(),
    category: 'view',
    enabled: !!handlers.toggleBottomPanel,
  },
];

export const createNavigationShortcuts = (handlers: {
  goToHome?: () => void;
  goToSession?: () => void;
  goToVideo?: () => void;
  goToAudio?: () => void;
  goToImages?: () => void;
  goToStreaming?: () => void;
  prevTool?: () => void;
  nextTool?: () => void;
  openSearch?: () => void;
  openSettings?: () => void;
}): KeyboardShortcut[] => [
  {
    key: '`',
    alt: true,
    description: 'Go to Home',
    handler: () => handlers.goToHome?.(),
    category: 'navigation',
    enabled: !!handlers.goToHome,
  },
  {
    key: '1',
    alt: true,
    description: 'Go to Session Timeline',
    handler: () => handlers.goToSession?.(),
    category: 'navigation',
    enabled: !!handlers.goToSession,
  },
  {
    key: '2',
    alt: true,
    description: 'Go to Video Tool',
    handler: () => handlers.goToVideo?.(),
    category: 'navigation',
    enabled: !!handlers.goToVideo,
  },
  {
    key: '3',
    alt: true,
    description: 'Go to Audio Tool',
    handler: () => handlers.goToAudio?.(),
    category: 'navigation',
    enabled: !!handlers.goToAudio,
  },
  {
    key: '4',
    alt: true,
    description: 'Go to Images Tool',
    handler: () => handlers.goToImages?.(),
    category: 'navigation',
    enabled: !!handlers.goToImages,
  },
  {
    key: '5',
    alt: true,
    description: 'Go to Streaming Tool',
    handler: () => handlers.goToStreaming?.(),
    category: 'navigation',
    enabled: !!handlers.goToStreaming,
  },
  {
    key: '[',
    ctrl: true,
    description: 'Previous tool',
    handler: () => handlers.prevTool?.(),
    category: 'navigation',
    enabled: !!handlers.prevTool,
  },
  {
    key: ']',
    ctrl: true,
    description: 'Next tool',
    handler: () => handlers.nextTool?.(),
    category: 'navigation',
    enabled: !!handlers.nextTool,
  },
  {
    key: 'p',
    ctrl: true,
    description: 'Quick search',
    handler: () => handlers.openSearch?.(),
    category: 'navigation',
    enabled: !!handlers.openSearch,
  },
  {
    key: ',',
    ctrl: true,
    description: 'Settings',
    handler: () => handlers.openSettings?.(),
    category: 'navigation',
    enabled: !!handlers.openSettings,
  },
];

export default useKeyboardShortcuts;
