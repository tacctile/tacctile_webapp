// Tool types mapped to their routes/identifiers
export type ToolType = 'session' | 'video' | 'audio' | 'image' | 'streaming';

// Map evidence types to tools
export const EVIDENCE_TYPE_TO_TOOL: Record<string, ToolType> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
};

// Get the appropriate tool for an evidence type
export const getToolForEvidenceType = (type: string): ToolType => {
  return EVIDENCE_TYPE_TO_TOOL[type] || 'session';
};
