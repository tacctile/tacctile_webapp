/**
 * Investigation Hooks
 * Provides investigation and evidence management with real-time collaboration
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabaseService } from '@/services/supabase/SupabaseService';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import type {
  Investigation,
  Evidence,
  TeamMember,
  InvestigationFilter,
  PresenceState,
  EvidenceFlag,
  FlagComment,
} from '@/types';

// ============================================================================
// INVESTIGATIONS LIST HOOK
// ============================================================================

export function useInvestigations(filter?: InvestigationFilter) {
  const { user } = useAuth();
  const { hasReachedLimit, limits } = useSubscription();

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load investigations
  const loadInvestigations = useCallback(async () => {
    if (!user) {
      setInvestigations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await supabaseService.getInvestigations(user.id, filter);
      setInvestigations(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [user, filter]);

  // Initial load
  useEffect(() => {
    loadInvestigations();
  }, [loadInvestigations]);

  // Can create new investigation
  const canCreateInvestigation = !hasReachedLimit(
    'maxInvestigations',
    investigations.length
  );

  // Create investigation
  const createInvestigation = useCallback(
    async (
      data: Pick<Investigation, 'title' | 'description' | 'location' | 'startDate' | 'tags'>
    ): Promise<Investigation> => {
      if (!user) throw new Error('User not authenticated');
      if (!canCreateInvestigation) {
        throw new Error(
          `You've reached the maximum of ${limits.maxInvestigations} investigations on your plan`
        );
      }

      const investigation = await supabaseService.createInvestigation({
        ...data,
        userId: user.id,
        status: 'planning',
        teamMembers: [
          {
            userId: user.id,
            email: user.email,
            displayName: user.displayName || user.email,
            photoURL: user.photoURL || undefined,
            role: 'owner',
            joinedAt: new Date(),
            invitedBy: user.id,
          },
        ],
      });

      setInvestigations((prev) => [investigation, ...prev]);
      return investigation;
    },
    [user, canCreateInvestigation, limits.maxInvestigations]
  );

  // Delete investigation
  const deleteInvestigation = useCallback(
    async (investigationId: string): Promise<void> => {
      await supabaseService.deleteInvestigation(investigationId);
      setInvestigations((prev) => prev.filter((i) => i.id !== investigationId));
    },
    []
  );

  return {
    investigations,
    isLoading,
    error,
    canCreateInvestigation,
    createInvestigation,
    deleteInvestigation,
    refresh: loadInvestigations,
  };
}

// ============================================================================
// SINGLE INVESTIGATION HOOK
// ============================================================================

export function useInvestigation(investigationId: string | null) {
  const { user } = useAuth();
  const { isPro } = useSubscription();

  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Load investigation data
  const loadInvestigation = useCallback(async () => {
    if (!investigationId) {
      setInvestigation(null);
      setEvidence([]);
      setTeamMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [inv, evid, members] = await Promise.all([
        supabaseService.getInvestigation(investigationId),
        supabaseService.getEvidence(investigationId),
        supabaseService.getTeamMembers(investigationId),
      ]);

      setInvestigation(inv);
      setEvidence(evid);
      setTeamMembers(members);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [investigationId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!investigationId || !isPro) return;

    // Unsubscribe from previous
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Subscribe to changes
    unsubscribeRef.current = supabaseService.subscribeToInvestigation(
      investigationId,
      {
        onEvidenceChange: (item, event) => {
          setEvidence((prev) => {
            if (event === 'INSERT') return [item, ...prev];
            if (event === 'UPDATE')
              return prev.map((e) => (e.id === item.id ? item : e));
            if (event === 'DELETE') return prev.filter((e) => e.id !== item.id);
            return prev;
          });
        },
        onPresenceChange: (presenceList) => {
          setPresence(presenceList);
        },
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [investigationId, isPro]);

  // Track own presence
  useEffect(() => {
    if (!investigationId || !user || !isPro) return;

    supabaseService.trackPresence(investigationId, {
      oderId: user.id,
      displayName: user.displayName || user.email,
      photoURL: user.photoURL || undefined,
      currentInvestigationId: investigationId,
      lastActiveAt: new Date(),
    });
  }, [investigationId, user, isPro]);

  // Initial load
  useEffect(() => {
    loadInvestigation();
  }, [loadInvestigation]);

  // Update investigation
  const updateInvestigation = useCallback(
    async (updates: Partial<Investigation>): Promise<Investigation> => {
      if (!investigationId) throw new Error('No investigation loaded');

      const updated = await supabaseService.updateInvestigation(
        investigationId,
        updates
      );
      setInvestigation(updated);
      return updated;
    },
    [investigationId]
  );

  // Get user's role
  const userRole = teamMembers.find((m) => m.userId === user?.id)?.role || null;

  // Check permissions
  const canEdit = userRole === 'owner' || userRole === 'admin';
  const canManageTeam = userRole === 'owner' || userRole === 'admin';
  const canDelete = userRole === 'owner';

  return {
    investigation,
    evidence,
    teamMembers,
    presence,
    isLoading,
    error,
    userRole,
    canEdit,
    canManageTeam,
    canDelete,
    updateInvestigation,
    refresh: loadInvestigation,
  };
}

// ============================================================================
// EVIDENCE HOOK
// ============================================================================

export function useEvidence(investigationId: string | null) {
  const { user } = useAuth();
  const { hasReachedLimit, limits } = useSubscription();

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load evidence
  const loadEvidence = useCallback(async () => {
    if (!investigationId) {
      setEvidence([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await supabaseService.getEvidence(investigationId);
      setEvidence(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [investigationId]);

  // Initial load
  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  // Can add evidence
  const canAddEvidence = !hasReachedLimit(
    'maxEvidencePerInvestigation',
    evidence.length
  );

  // Add evidence
  const addEvidence = useCallback(
    async (
      data: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt' | 'flagCount' | 'flags'>
    ): Promise<Evidence> => {
      if (!user) throw new Error('User not authenticated');
      if (!investigationId) throw new Error('No investigation loaded');
      if (!canAddEvidence) {
        throw new Error(
          `You've reached the maximum of ${limits.maxEvidencePerInvestigation} evidence items on your plan`
        );
      }

      const item = await supabaseService.createEvidence(data);
      setEvidence((prev) => [item, ...prev]);
      return item;
    },
    [user, investigationId, canAddEvidence, limits.maxEvidencePerInvestigation]
  );

  // Update evidence
  const updateEvidence = useCallback(
    async (evidenceId: string, updates: Partial<Evidence>): Promise<Evidence> => {
      const updated = await supabaseService.updateEvidence(evidenceId, updates);
      setEvidence((prev) =>
        prev.map((e) => (e.id === evidenceId ? updated : e))
      );
      return updated;
    },
    []
  );

  // Delete evidence
  const deleteEvidence = useCallback(
    async (evidenceId: string): Promise<void> => {
      if (!investigationId) throw new Error('No investigation loaded');

      await supabaseService.deleteEvidence(evidenceId, investigationId);
      setEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
    },
    [investigationId]
  );

  return {
    evidence,
    isLoading,
    error,
    canAddEvidence,
    addEvidence,
    updateEvidence,
    deleteEvidence,
    refresh: loadEvidence,
  };
}

// ============================================================================
// TEAM MANAGEMENT HOOK
// ============================================================================

export function useTeamMembers(investigationId: string | null) {
  const { user } = useAuth();
  const { hasReachedLimit, limits, isPro } = useSubscription();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load team members
  const loadMembers = useCallback(async () => {
    if (!investigationId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await supabaseService.getTeamMembers(investigationId);
      setMembers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [investigationId]);

  // Initial load
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Can add members
  const canAddMember = isPro && !hasReachedLimit('maxTeamMembers', members.length);

  // Add member
  const addMember = useCallback(
    async (member: Omit<TeamMember, 'joinedAt'>): Promise<TeamMember> => {
      if (!user) throw new Error('User not authenticated');
      if (!investigationId) throw new Error('No investigation loaded');
      if (!isPro) throw new Error('Team collaboration requires Pro plan');
      if (!canAddMember) {
        throw new Error(
          `You've reached the maximum of ${limits.maxTeamMembers} team members on your plan`
        );
      }

      const added = await supabaseService.addTeamMember(investigationId, member);
      setMembers((prev) => [...prev, added]);
      return added;
    },
    [user, investigationId, isPro, canAddMember, limits.maxTeamMembers]
  );

  // Update member role
  const updateMemberRole = useCallback(
    async (userId: string, role: TeamMember['role']): Promise<void> => {
      if (!investigationId) throw new Error('No investigation loaded');

      await supabaseService.updateTeamMemberRole(investigationId, userId, role);
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );
    },
    [investigationId]
  );

  // Remove member
  const removeMember = useCallback(
    async (userId: string): Promise<void> => {
      if (!investigationId) throw new Error('No investigation loaded');

      await supabaseService.removeTeamMember(investigationId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    },
    [investigationId]
  );

  // Get current user's role
  const userRole = members.find((m) => m.userId === user?.id)?.role || null;

  return {
    members,
    isLoading,
    error,
    userRole,
    canAddMember,
    addMember,
    updateMemberRole,
    removeMember,
    refresh: loadMembers,
  };
}

// ============================================================================
// SYNCED PLAYBACK HOOK
// ============================================================================

export function useSyncedPlayback(evidenceId: string | null) {
  const { user } = useAuth();
  const { isPro } = useSubscription();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlledBy, setControlledBy] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to playback updates
  useEffect(() => {
    if (!evidenceId || !isPro) return;

    unsubscribeRef.current = supabaseService.subscribeToSyncedPlayback(
      evidenceId,
      (state) => {
        setIsPlaying(state.isPlaying);
        setCurrentTime(state.currentTime);
        setPlaybackRate(state.playbackRate);
        setControlledBy(state.controlledBy);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [evidenceId, isPro]);

  // Broadcast playback state
  const broadcastState = useCallback(
    async (state: { isPlaying?: boolean; currentTime?: number; playbackRate?: number }) => {
      if (!evidenceId || !user || !isPro) return;

      await supabaseService.broadcastPlaybackState(evidenceId, {
        evidenceId,
        isPlaying: state.isPlaying ?? isPlaying,
        currentTime: state.currentTime ?? currentTime,
        playbackRate: state.playbackRate ?? playbackRate,
        controlledBy: user.id,
        updatedAt: new Date(),
      });
    },
    [evidenceId, user, isPro, isPlaying, currentTime, playbackRate]
  );

  // Control functions
  const play = useCallback(() => broadcastState({ isPlaying: true }), [broadcastState]);
  const pause = useCallback(() => broadcastState({ isPlaying: false }), [broadcastState]);
  const seek = useCallback(
    (time: number) => broadcastState({ currentTime: time }),
    [broadcastState]
  );
  const setRate = useCallback(
    (rate: number) => broadcastState({ playbackRate: rate }),
    [broadcastState]
  );

  // Is current user controlling playback
  const isControlling = controlledBy === user?.id;

  return {
    isPlaying,
    currentTime,
    playbackRate,
    controlledBy,
    isControlling,
    play,
    pause,
    seek,
    setRate,
  };
}
