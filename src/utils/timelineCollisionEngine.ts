/**
 * Timeline Collision Engine
 * NLE-style collision detection and movement validation.
 * Pure functions - no side effects, easy to test.
 */

export interface TimelineItem {
  id: string;
  type: 'video' | 'audio' | 'photo';
  startTime: number;  // ms from session start
  duration: number;   // ms (images use IMAGE_MIN_DURATION)
  rowIndex: number;   // assigned row within type section
  isLocked: boolean;
  hasRealTimestamp: boolean;  // if true, cannot move horizontally
}

export interface CollisionResult {
  valid: boolean;
  reason?: string;
  snappedTime?: number;
  snappedRow?: number;
}

export const IMAGE_MIN_DURATION = 1000; // 1 second minimum for collision detection

/**
 * Check if a time range is occupied by any item in a row
 */
export function isTimeRangeOccupied(
  items: TimelineItem[],
  rowIndex: number,
  startTime: number,
  endTime: number,
  excludeItemId?: string
): boolean {
  return items.some(item => {
    if (item.id === excludeItemId) return false;
    if (item.rowIndex !== rowIndex) return false;
    const itemEnd = item.startTime + item.duration;
    return startTime < itemEnd && endTime > item.startTime;
  });
}

/**
 * Find all items that overlap with a time range in a specific row
 */
export function findItemsInTimeRange(
  items: TimelineItem[],
  rowIndex: number,
  startTime: number,
  endTime: number
): TimelineItem[] {
  return items.filter(item => {
    if (item.rowIndex !== rowIndex) return false;
    const itemEnd = item.startTime + item.duration;
    return startTime < itemEnd && endTime > item.startTime;
  });
}

/**
 * Check if an item can be placed at a target position
 */
export function canPlaceItem(
  items: TimelineItem[],
  movingItem: TimelineItem,
  targetRowIndex: number,
  targetStartTime: number,
  timelineBounds: { start: number; end: number }
): CollisionResult {
  // Check bounds
  if (targetStartTime < timelineBounds.start) {
    return { valid: false, reason: 'Cannot move before timeline start' };
  }

  const endTime = targetStartTime + movingItem.duration;
  if (endTime > timelineBounds.end) {
    return { valid: false, reason: 'Cannot move past timeline end' };
  }

  // Check for overlaps
  const hasOverlap = isTimeRangeOccupied(
    items,
    targetRowIndex,
    targetStartTime,
    endTime,
    movingItem.id
  );

  if (hasOverlap) {
    return { valid: false, reason: 'Position blocked by another item' };
  }

  return { valid: true };
}

/**
 * Find the nearest valid row in a direction (for lane skipping)
 * Returns null if no valid row exists
 */
export function findNearestValidRow(
  items: TimelineItem[],
  movingItem: TimelineItem,
  direction: 'up' | 'down',
  currentRowCount: number
): number | null {
  const step = direction === 'up' ? -1 : 1;
  const itemStart = movingItem.startTime;
  const itemEnd = itemStart + movingItem.duration;

  // For down, allow creating new row (currentRowCount)
  const maxRow = direction === 'down' ? currentRowCount : currentRowCount - 1;
  const minRow = 0;

  let targetRow = movingItem.rowIndex + step;

  while (targetRow >= minRow && targetRow <= maxRow) {
    const hasOverlap = isTimeRangeOccupied(
      items,
      targetRow,
      itemStart,
      itemEnd,
      movingItem.id
    );

    if (!hasOverlap) {
      return targetRow;
    }

    targetRow += step;
  }

  return null; // No valid row found
}

/**
 * Find nearest valid time position on a row (for snapping after failed placement)
 */
export function findNearestValidTime(
  items: TimelineItem[],
  movingItem: TimelineItem,
  targetRowIndex: number,
  desiredStartTime: number,
  timelineBounds: { start: number; end: number }
): number | null {
  const duration = movingItem.duration;

  // Get all items in target row (excluding moving item)
  const rowItems = items
    .filter(i => i.rowIndex === targetRowIndex && i.id !== movingItem.id)
    .sort((a, b) => a.startTime - b.startTime);

  if (rowItems.length === 0) {
    // Row is empty, just clamp to bounds
    const clamped = Math.max(timelineBounds.start, Math.min(desiredStartTime, timelineBounds.end - duration));
    return clamped;
  }

  // Find gaps and check which one is closest to desired position
  const validPositions: number[] = [];

  // Before first item
  if (rowItems[0].startTime >= timelineBounds.start + duration) {
    const pos = Math.min(desiredStartTime, rowItems[0].startTime - duration);
    if (pos >= timelineBounds.start) {
      validPositions.push(Math.max(timelineBounds.start, pos));
    }
  }

  // Between items
  for (let i = 0; i < rowItems.length - 1; i++) {
    const gapStart = rowItems[i].startTime + rowItems[i].duration;
    const gapEnd = rowItems[i + 1].startTime;
    if (gapEnd - gapStart >= duration) {
      const pos = Math.max(gapStart, Math.min(desiredStartTime, gapEnd - duration));
      validPositions.push(pos);
    }
  }

  // After last item
  const lastItem = rowItems[rowItems.length - 1];
  const afterLast = lastItem.startTime + lastItem.duration;
  if (afterLast + duration <= timelineBounds.end) {
    const pos = Math.max(afterLast, desiredStartTime);
    if (pos + duration <= timelineBounds.end) {
      validPositions.push(pos);
    }
  }

  if (validPositions.length === 0) {
    return null; // No valid position
  }

  // Return closest to desired
  return validPositions.reduce((closest, pos) =>
    Math.abs(pos - desiredStartTime) < Math.abs(closest - desiredStartTime) ? pos : closest
  );
}

/**
 * Clamp a start time to timeline bounds
 */
export function clampToTimelineBounds(
  startTime: number,
  duration: number,
  bounds: { start: number; end: number }
): { startTime: number; clamped: boolean } {
  if (startTime < bounds.start) {
    return { startTime: bounds.start, clamped: true };
  }
  if (startTime + duration > bounds.end) {
    return { startTime: bounds.end - duration, clamped: true };
  }
  return { startTime, clamped: false };
}
