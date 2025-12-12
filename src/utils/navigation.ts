// Tool types mapped to their routes/identifiers
export type ToolType = 'timeline' | 'video' | 'audio' | 'image' | 'streaming';

// Map file types to tools
export const FILE_TYPE_TO_TOOL: Record<string, ToolType> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
};

// Get the appropriate tool for a file type
export const getToolForFileType = (type: string): ToolType => {
  return FILE_TYPE_TO_TOOL[type] || 'timeline';
};
