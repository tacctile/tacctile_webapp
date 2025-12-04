/**
 * useAudioFindingsSync Hook
 * Syncs audio findings to EvidenceFlag system
 */

import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { evidenceFlaggingService } from '../services/evidence/EvidenceFlaggingService';
import { useAudioToolStore } from '../stores/useAudioToolStore';
import type { AudioFinding } from '../types/audio';
import type { EvidenceFlag, FlagType } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface SyncResult {
  success: boolean;
  flagId?: string;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAudioFindingsSync(evidenceId: string) {
  const { user } = useAuth();
  const { findings, updateFinding } = useAudioToolStore();

  /**
   * Determine flag type based on finding characteristics
   */
  const determineFlagType = useCallback((finding: AudioFinding): FlagType => {
    const title = finding.title.toLowerCase();
    const notes = (finding.notes || '').toLowerCase();
    const combined = `${title} ${notes}`;

    // EVP-related keywords
    if (
      combined.includes('evp') ||
      combined.includes('voice') ||
      combined.includes('whisper') ||
      combined.includes('talking') ||
      combined.includes('speaking') ||
      combined.includes('word')
    ) {
      return 'evp';
    }

    // Anomaly keywords
    if (
      combined.includes('anomaly') ||
      combined.includes('unusual') ||
      combined.includes('strange') ||
      combined.includes('unexplained')
    ) {
      return 'anomaly';
    }

    // Audio artifact keywords
    if (
      combined.includes('artifact') ||
      combined.includes('noise') ||
      combined.includes('distortion') ||
      combined.includes('interference')
    ) {
      return 'audio_artifact';
    }

    // Default to EVP for audio tool findings
    return 'evp';
  }, []);

  /**
   * Sync a finding to the EvidenceFlag system
   */
  const syncFinding = useCallback(
    async (findingId: string): Promise<SyncResult> => {
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const finding = findings.find((f) => f.id === findingId);
      if (!finding) {
        return { success: false, error: 'Finding not found' };
      }

      if (finding.flagId) {
        return { success: false, error: 'Finding already synced to flag' };
      }

      try {
        // Initialize service if needed
        await evidenceFlaggingService.init();

        // Create flag from finding
        const flagType = determineFlagType(finding);
        const flag = await evidenceFlaggingService.createFlag({
          evidenceId,
          user,
          type: flagType,
          timestamp: finding.selection.startTime,
          endTimestamp: finding.selection.endTime,
          title: finding.title,
          description: buildFlagDescription(finding),
          confidence: finding.confidence,
          tags: ['audio-tool', 'spectral-selection', ...finding.tags],
          generateAISummary: true,
        });

        // Update finding with flag ID
        updateFinding(findingId, { flagId: flag.id });

        return { success: true, flagId: flag.id };
      } catch (error) {
        console.error('[useAudioFindingsSync] Failed to sync finding:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [user, findings, evidenceId, determineFlagType, updateFinding]
  );

  /**
   * Sync all unsynchronized findings
   */
  const syncAllFindings = useCallback(async (): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> => {
    const unsyncedFindings = findings.filter((f) => !f.flagId);
    const results = await Promise.all(unsyncedFindings.map((f) => syncFinding(f.id)));

    const synced = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const errors = results.filter((r) => r.error).map((r) => r.error!);

    return { synced, failed, errors };
  }, [findings, syncFinding]);

  /**
   * Update an existing flag from finding changes
   */
  const updateFlag = useCallback(
    async (findingId: string): Promise<SyncResult> => {
      const finding = findings.find((f) => f.id === findingId);
      if (!finding || !finding.flagId) {
        return { success: false, error: 'Finding not synced to flag' };
      }

      try {
        const flagType = determineFlagType(finding);
        await evidenceFlaggingService.updateFlag(finding.flagId, {
          type: flagType,
          title: finding.title,
          description: buildFlagDescription(finding),
          confidence: finding.confidence,
          tags: ['audio-tool', 'spectral-selection', ...finding.tags],
        });

        return { success: true, flagId: finding.flagId };
      } catch (error) {
        console.error('[useAudioFindingsSync] Failed to update flag:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [findings, determineFlagType]
  );

  /**
   * Get flags that correspond to audio findings
   */
  const getSyncedFlags = useCallback(async (): Promise<EvidenceFlag[]> => {
    const syncedFindingIds = findings.filter((f) => f.flagId).map((f) => f.flagId!);
    if (syncedFindingIds.length === 0) return [];

    const allFlags = await evidenceFlaggingService.getFlags(evidenceId);
    return allFlags.filter((flag) => syncedFindingIds.includes(flag.id));
  }, [findings, evidenceId]);

  /**
   * Check if a finding is synced
   */
  const isFindingSynced = useCallback(
    (findingId: string): boolean => {
      const finding = findings.find((f) => f.id === findingId);
      return !!finding?.flagId;
    },
    [findings]
  );

  /**
   * Get sync status for all findings
   */
  const getSyncStatus = useCallback((): {
    total: number;
    synced: number;
    unsynced: number;
  } => {
    const synced = findings.filter((f) => f.flagId).length;
    return {
      total: findings.length,
      synced,
      unsynced: findings.length - synced,
    };
  }, [findings]);

  return {
    syncFinding,
    syncAllFindings,
    updateFlag,
    getSyncedFlags,
    isFindingSynced,
    getSyncStatus,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function buildFlagDescription(finding: AudioFinding): string {
  const parts: string[] = [];

  if (finding.notes) {
    parts.push(finding.notes);
  }

  // Add frequency range info
  const lowFreq = finding.selection.lowFrequency;
  const highFreq = finding.selection.highFrequency;
  const freqRange =
    lowFreq >= 1000
      ? `${(lowFreq / 1000).toFixed(1)}kHz - ${(highFreq / 1000).toFixed(1)}kHz`
      : `${Math.round(lowFreq)}Hz - ${Math.round(highFreq)}Hz`;
  parts.push(`Frequency range: ${freqRange}`);

  // Add iteration info if available
  if (finding.iterationId) {
    parts.push(`Processing iteration: ${finding.iterationId}`);
  }

  return parts.join('\n\n');
}

export default useAudioFindingsSync;
