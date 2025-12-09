/**
 * Navigation tool configuration
 * Preserved from TopHeaderBar for use in Phase 3 tool repositioning
 */

export interface NavTool {
  id: string;
  icon: string;
  label: string;
  tooltip: string;
}

export const NAV_TOOLS: NavTool[] = [
  { id: 'home', icon: 'home', label: 'Home', tooltip: 'Home - Sessions & Storage' },
  { id: 'session', icon: 'calendar_month', label: 'Session', tooltip: 'Session Timeline' },
  { id: 'video', icon: 'movie', label: 'Video', tooltip: 'Video Analysis' },
  { id: 'audio', icon: 'graphic_eq', label: 'Audio', tooltip: 'Audio Analysis' },
  { id: 'images', icon: 'photo_library', label: 'Images', tooltip: 'Image Analysis' },
  { id: 'streaming', icon: 'cell_tower', label: 'Streaming', tooltip: 'Live Streaming' },
  { id: 'export', icon: 'download', label: 'Export', tooltip: 'Export Data' },
  { id: 'notes', icon: 'sticky_note_2', label: 'Notes', tooltip: 'Case Notes' },
  { id: 'team', icon: 'group', label: 'Team', tooltip: 'Team Collaboration' },
  { id: 'settings', icon: 'settings', label: 'Settings', tooltip: 'Settings' },
];
