/**
 * Supabase Service
 * Handles user data, investigations, findings, and real-time collaboration
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabaseConfig } from '@/config';
import type {
  User,
  Investigation,
  Evidence,
  EvidenceFlag,
  FlagComment,
  TeamMember,
  InvestigationInvite,
  Subscription,
  PresenceState,
  CollaborationCursor,
  SyncedPlaybackState,
  InvestigationFilter,
  EvidenceFlagFilter,
  CloudStorageProvider,
} from '@/types';

// ============================================================================
// DATABASE TYPES (for Supabase type safety)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserRow, 'id'>>;
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Omit<SubscriptionRow, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SubscriptionRow, 'id'>>;
      };
      investigations: {
        Row: InvestigationRow;
        Insert: Omit<InvestigationRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<InvestigationRow, 'id'>>;
      };
      team_members: {
        Row: TeamMemberRow;
        Insert: Omit<TeamMemberRow, 'joined_at'>;
        Update: Partial<Omit<TeamMemberRow, 'investigation_id' | 'user_id'>>;
      };
      investigation_invites: {
        Row: InviteRow;
        Insert: Omit<InviteRow, 'id' | 'created_at'>;
        Update: Partial<Omit<InviteRow, 'id'>>;
      };
      evidence: {
        Row: EvidenceRow;
        Insert: Omit<EvidenceRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<EvidenceRow, 'id'>>;
      };
      evidence_flags: {
        Row: FlagRow;
        Insert: Omit<FlagRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FlagRow, 'id'>>;
      };
      flag_comments: {
        Row: CommentRow;
        Insert: Omit<CommentRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CommentRow, 'id'>>;
      };
      cloud_storage_connections: {
        Row: CloudStorageRow;
        Insert: Omit<CloudStorageRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CloudStorageRow, 'id'>>;
      };
    };
  };
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  provider_id: string;
  created_at: string;
  updated_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

interface InvestigationRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  location: Record<string, unknown>;
  start_date: string;
  end_date: string | null;
  status: string;
  cloud_storage_provider: string | null;
  cloud_folder_id: string | null;
  tags: string[];
  evidence_count: number;
  flag_count: number;
  created_at: string;
  updated_at: string;
}

interface TeamMemberRow {
  investigation_id: string;
  user_id: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  role: string;
  joined_at: string;
  invited_by: string;
}

interface InviteRow {
  id: string;
  investigation_id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface EvidenceRow {
  id: string;
  investigation_id: string;
  user_id: string;
  type: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  duration: number | null;
  cloud_file_id: string;
  cloud_provider: string;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  flag_count: number;
  created_at: string;
  updated_at: string;
}

interface FlagRow {
  id: string;
  evidence_id: string;
  user_id: string;
  user_display_name: string;
  user_photo_url: string | null;
  type: string;
  custom_type: string | null;
  timestamp: number;
  end_timestamp: number | null;
  title: string;
  description: string | null;
  confidence: string;
  ai_summary: string | null;
  ai_analysis: Record<string, unknown> | null;
  tags: string[];
  comment_count: number;
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: string;
  flag_id: string;
  user_id: string;
  user_display_name: string;
  user_photo_url: string | null;
  content: string;
  mentions: string[];
  reactions: Record<string, unknown>[];
  edited: boolean;
  created_at: string;
  updated_at: string;
}

interface CloudStorageRow {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  root_folder_id: string | null;
  root_folder_name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SUPABASE SERVICE
// ============================================================================

class SupabaseService {
  private client: SupabaseClient<Database> | null = null;
  private realtimeChannels: Map<string, RealtimeChannel> = new Map();
  private initialized = false;

  /**
   * Initialize Supabase client
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!supabaseConfig.url || !supabaseConfig.anonKey) {
        console.warn('[Supabase] Missing configuration, running in mock mode');
        this.initialized = true;
        return;
      }

      this.client = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          persistSession: false, // We use Firebase for auth
          autoRefreshToken: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      this.initialized = true;
      console.log('[Supabase] Initialized successfully');
    } catch (error) {
      console.error('[Supabase] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get Supabase client
   */
  getClient(): SupabaseClient<Database> | null {
    return this.client;
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Create or update user profile
   */
  async upsertUser(user: User): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        photo_url: user.photoURL,
        provider_id: user.providerId,
      });

    if (error) throw this.handleError(error);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw this.handleError(error);
    }

    return this.rowToUser(data);
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Get user subscription
   */
  async getSubscription(userId: string): Promise<Subscription | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw this.handleError(error);
    }

    return this.rowToSubscription(data);
  }

  /**
   * Create or update subscription
   */
  async upsertSubscription(subscription: Subscription): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('subscriptions')
      .upsert({
        id: subscription.id,
        user_id: subscription.userId,
        tier: subscription.tier,
        status: subscription.status,
        stripe_customer_id: subscription.stripeCustomerId,
        stripe_subscription_id: subscription.stripeSubscriptionId,
        current_period_start: subscription.currentPeriodStart.toISOString(),
        current_period_end: subscription.currentPeriodEnd.toISOString(),
        cancel_at_period_end: subscription.cancelAtPeriodEnd,
      });

    if (error) throw this.handleError(error);
  }

  // ============================================================================
  // INVESTIGATION MANAGEMENT
  // ============================================================================

  /**
   * Create investigation
   */
  async createInvestigation(
    investigation: Omit<Investigation, 'id' | 'createdAt' | 'updatedAt' | 'evidenceCount' | 'flagCount'>
  ): Promise<Investigation> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('investigations')
      .insert({
        user_id: investigation.userId,
        title: investigation.title,
        description: investigation.description,
        location: investigation.location as unknown as Record<string, unknown>,
        start_date: investigation.startDate.toISOString(),
        end_date: investigation.endDate?.toISOString() || null,
        status: investigation.status,
        cloud_storage_provider: investigation.cloudStorageProvider || null,
        cloud_folder_id: investigation.cloudFolderId || null,
        tags: investigation.tags,
        evidence_count: 0,
        flag_count: 0,
      })
      .select()
      .single();

    if (error) throw this.handleError(error);
    return this.rowToInvestigation(data);
  }

  /**
   * Get investigation by ID
   */
  async getInvestigation(investigationId: string): Promise<Investigation | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('investigations')
      .select('*')
      .eq('id', investigationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw this.handleError(error);
    }

    return this.rowToInvestigation(data);
  }

  /**
   * Get investigations for user
   */
  async getInvestigations(
    userId: string,
    filter?: InvestigationFilter
  ): Promise<Investigation[]> {
    if (!this.client) return [];

    let query = this.client
      .from('investigations')
      .select('*')
      .eq('user_id', userId);

    // Apply filters
    if (filter?.status?.length) {
      query = query.in('status', filter.status);
    }
    if (filter?.dateRange) {
      query = query
        .gte('start_date', filter.dateRange.start.toISOString())
        .lte('start_date', filter.dateRange.end.toISOString());
    }
    if (filter?.searchQuery) {
      query = query.or(
        `title.ilike.%${filter.searchQuery}%,description.ilike.%${filter.searchQuery}%`
      );
    }
    if (filter?.tags?.length) {
      query = query.overlaps('tags', filter.tags);
    }

    // Apply sorting
    const sortBy = filter?.sortBy || 'created_at';
    const sortOrder = filter?.sortOrder || 'desc';
    const sortColumn = this.mapSortColumn(sortBy);
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    const { data, error } = await query;

    if (error) throw this.handleError(error);
    return (data || []).map((row) => this.rowToInvestigation(row));
  }

  /**
   * Update investigation
   */
  async updateInvestigation(
    investigationId: string,
    updates: Partial<Investigation>
  ): Promise<Investigation> {
    if (!this.client) throw new Error('Supabase not initialized');

    const updateData: Partial<InvestigationRow> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.location !== undefined) updateData.location = updates.location as unknown as Record<string, unknown>;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate.toISOString();
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate?.toISOString() || null;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.cloudStorageProvider !== undefined) updateData.cloud_storage_provider = updates.cloudStorageProvider || null;
    if (updates.cloudFolderId !== undefined) updateData.cloud_folder_id = updates.cloudFolderId || null;

    const { data, error } = await this.client
      .from('investigations')
      .update(updateData)
      .eq('id', investigationId)
      .select()
      .single();

    if (error) throw this.handleError(error);
    return this.rowToInvestigation(data);
  }

  /**
   * Delete investigation
   */
  async deleteInvestigation(investigationId: string): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { error } = await this.client
      .from('investigations')
      .delete()
      .eq('id', investigationId);

    if (error) throw this.handleError(error);
  }

  // ============================================================================
  // TEAM MANAGEMENT
  // ============================================================================

  /**
   * Get team members for investigation
   */
  async getTeamMembers(investigationId: string): Promise<TeamMember[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('team_members')
      .select('*')
      .eq('investigation_id', investigationId);

    if (error) throw this.handleError(error);
    return (data || []).map((row) => this.rowToTeamMember(row));
  }

  /**
   * Add team member
   */
  async addTeamMember(
    investigationId: string,
    member: Omit<TeamMember, 'joinedAt'>
  ): Promise<TeamMember> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('team_members')
      .insert({
        investigation_id: investigationId,
        user_id: member.userId,
        email: member.email,
        display_name: member.displayName,
        photo_url: member.photoURL || null,
        role: member.role,
        invited_by: member.invitedBy,
      })
      .select()
      .single();

    if (error) throw this.handleError(error);
    return this.rowToTeamMember(data);
  }

  /**
   * Update team member role
   */
  async updateTeamMemberRole(
    investigationId: string,
    userId: string,
    role: TeamMember['role']
  ): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { error } = await this.client
      .from('team_members')
      .update({ role })
      .eq('investigation_id', investigationId)
      .eq('user_id', userId);

    if (error) throw this.handleError(error);
  }

  /**
   * Remove team member
   */
  async removeTeamMember(investigationId: string, userId: string): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { error } = await this.client
      .from('team_members')
      .delete()
      .eq('investigation_id', investigationId)
      .eq('user_id', userId);

    if (error) throw this.handleError(error);
  }

  // ============================================================================
  // EVIDENCE MANAGEMENT
  // ============================================================================

  /**
   * Create evidence
   */
  async createEvidence(
    evidence: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt' | 'flagCount' | 'flags'>
  ): Promise<Evidence> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('evidence')
      .insert({
        investigation_id: evidence.investigationId,
        user_id: evidence.userId,
        type: evidence.type,
        title: evidence.title,
        description: evidence.description || null,
        file_name: evidence.fileName,
        file_size: evidence.fileSize,
        mime_type: evidence.mimeType,
        duration: evidence.duration || null,
        cloud_file_id: evidence.cloudFileId,
        cloud_provider: evidence.cloudProvider,
        thumbnail_url: evidence.thumbnailUrl || null,
        metadata: evidence.metadata as unknown as Record<string, unknown>,
        flag_count: 0,
      })
      .select()
      .single();

    if (error) throw this.handleError(error);

    // Update investigation evidence count
    await this.incrementEvidenceCount(evidence.investigationId);

    return this.rowToEvidence(data);
  }

  /**
   * Get evidence for investigation
   */
  async getEvidence(investigationId: string): Promise<Evidence[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('evidence')
      .select('*')
      .eq('investigation_id', investigationId)
      .order('created_at', { ascending: false });

    if (error) throw this.handleError(error);
    return (data || []).map((row) => this.rowToEvidence(row));
  }

  /**
   * Get single evidence by ID
   */
  async getEvidenceById(evidenceId: string): Promise<Evidence | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('evidence')
      .select('*')
      .eq('id', evidenceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw this.handleError(error);
    }

    return this.rowToEvidence(data);
  }

  /**
   * Update evidence
   */
  async updateEvidence(
    evidenceId: string,
    updates: Partial<Evidence>
  ): Promise<Evidence> {
    if (!this.client) throw new Error('Supabase not initialized');

    const updateData: Partial<EvidenceRow> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description || null;
    if (updates.thumbnailUrl !== undefined) updateData.thumbnail_url = updates.thumbnailUrl || null;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata as unknown as Record<string, unknown>;

    const { data, error } = await this.client
      .from('evidence')
      .update(updateData)
      .eq('id', evidenceId)
      .select()
      .single();

    if (error) throw this.handleError(error);
    return this.rowToEvidence(data);
  }

  /**
   * Delete evidence
   */
  async deleteEvidence(evidenceId: string, investigationId: string): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { error } = await this.client
      .from('evidence')
      .delete()
      .eq('id', evidenceId);

    if (error) throw this.handleError(error);

    // Update investigation evidence count
    await this.decrementEvidenceCount(investigationId);
  }

  // ============================================================================
  // EVIDENCE FLAGS MANAGEMENT
  // ============================================================================

  /**
   * Create evidence flag
   */
  async createFlag(
    flag: Omit<EvidenceFlag, 'id' | 'createdAt' | 'updatedAt' | 'commentCount' | 'comments'>
  ): Promise<EvidenceFlag> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('evidence_flags')
      .insert({
        evidence_id: flag.evidenceId,
        user_id: flag.userId,
        user_display_name: flag.userDisplayName,
        user_photo_url: flag.userPhotoURL || null,
        type: flag.type,
        custom_type: flag.customType || null,
        timestamp: flag.timestamp,
        end_timestamp: flag.endTimestamp || null,
        title: flag.title,
        description: flag.description || null,
        confidence: flag.confidence,
        ai_summary: flag.aiSummary || null,
        ai_analysis: flag.aiAnalysis as unknown as Record<string, unknown> || null,
        tags: flag.tags,
        comment_count: 0,
      })
      .select()
      .single();

    if (error) throw this.handleError(error);

    // Update evidence and investigation flag counts
    await this.incrementFlagCount(flag.evidenceId);

    return this.rowToFlag(data);
  }

  /**
   * Get flags for evidence
   */
  async getFlags(evidenceId: string, filter?: EvidenceFlagFilter): Promise<EvidenceFlag[]> {
    if (!this.client) return [];

    let query = this.client
      .from('evidence_flags')
      .select('*')
      .eq('evidence_id', evidenceId);

    // Apply filters
    if (filter?.types?.length) {
      query = query.in('type', filter.types);
    }
    if (filter?.userIds?.length) {
      query = query.in('user_id', filter.userIds);
    }
    if (filter?.timestampRange) {
      query = query
        .gte('timestamp', filter.timestampRange.start)
        .lte('timestamp', filter.timestampRange.end);
    }
    if (filter?.confidence?.length) {
      query = query.in('confidence', filter.confidence);
    }
    if (filter?.hasComments) {
      query = query.gt('comment_count', 0);
    }
    if (filter?.hasAiSummary) {
      query = query.not('ai_summary', 'is', null);
    }
    if (filter?.searchQuery) {
      query = query.or(
        `title.ilike.%${filter.searchQuery}%,description.ilike.%${filter.searchQuery}%`
      );
    }
    if (filter?.tags?.length) {
      query = query.overlaps('tags', filter.tags);
    }

    // Apply sorting
    const sortBy = filter?.sortBy || 'timestamp';
    const sortOrder = filter?.sortOrder || 'asc';
    query = query.order(sortBy === 'timestamp' ? 'timestamp' : `${sortBy}`, {
      ascending: sortOrder === 'asc',
    });

    const { data, error } = await query;

    if (error) throw this.handleError(error);
    return (data || []).map((row) => this.rowToFlag(row));
  }

  /**
   * Update flag
   */
  async updateFlag(
    flagId: string,
    updates: Partial<EvidenceFlag>
  ): Promise<EvidenceFlag> {
    if (!this.client) throw new Error('Supabase not initialized');

    const updateData: Partial<FlagRow> = {};
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.customType !== undefined) updateData.custom_type = updates.customType || null;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description || null;
    if (updates.confidence !== undefined) updateData.confidence = updates.confidence;
    if (updates.aiSummary !== undefined) updateData.ai_summary = updates.aiSummary || null;
    if (updates.aiAnalysis !== undefined) updateData.ai_analysis = updates.aiAnalysis as unknown as Record<string, unknown> || null;
    if (updates.tags !== undefined) updateData.tags = updates.tags;

    const { data, error } = await this.client
      .from('evidence_flags')
      .update(updateData)
      .eq('id', flagId)
      .select()
      .single();

    if (error) throw this.handleError(error);
    return this.rowToFlag(data);
  }

  /**
   * Delete flag
   */
  async deleteFlag(flagId: string, evidenceId: string): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { error } = await this.client
      .from('evidence_flags')
      .delete()
      .eq('id', flagId);

    if (error) throw this.handleError(error);

    // Update evidence flag count
    await this.decrementFlagCount(evidenceId);
  }

  // ============================================================================
  // FLAG COMMENTS
  // ============================================================================

  /**
   * Create comment on flag
   */
  async createComment(
    comment: Omit<FlagComment, 'id' | 'createdAt' | 'updatedAt' | 'edited' | 'reactions'>
  ): Promise<FlagComment> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('flag_comments')
      .insert({
        flag_id: comment.flagId,
        user_id: comment.userId,
        user_display_name: comment.userDisplayName,
        user_photo_url: comment.userPhotoURL || null,
        content: comment.content,
        mentions: comment.mentions,
        reactions: [],
        edited: false,
      })
      .select()
      .single();

    if (error) throw this.handleError(error);

    // Update flag comment count
    await this.incrementCommentCount(comment.flagId);

    return this.rowToComment(data);
  }

  /**
   * Get comments for flag
   */
  async getComments(flagId: string): Promise<FlagComment[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('flag_comments')
      .select('*')
      .eq('flag_id', flagId)
      .order('created_at', { ascending: true });

    if (error) throw this.handleError(error);
    return (data || []).map((row) => this.rowToComment(row));
  }

  /**
   * Update comment
   */
  async updateComment(commentId: string, content: string): Promise<FlagComment> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('flag_comments')
      .update({ content, edited: true })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw this.handleError(error);
    return this.rowToComment(data);
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId: string, flagId: string): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { error } = await this.client
      .from('flag_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw this.handleError(error);

    // Update flag comment count
    await this.decrementCommentCount(flagId);
  }

  // ============================================================================
  // CLOUD STORAGE CONNECTIONS
  // ============================================================================

  /**
   * Save cloud storage connection
   */
  async saveCloudStorageConnection(
    userId: string,
    provider: CloudStorageProvider,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    },
    rootFolder?: { id: string; name: string }
  ): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('cloud_storage_connections')
      .upsert({
        user_id: userId,
        provider,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        root_folder_id: rootFolder?.id || null,
        root_folder_name: rootFolder?.name || null,
      });

    if (error) throw this.handleError(error);
  }

  /**
   * Get cloud storage connection
   */
  async getCloudStorageConnection(
    userId: string,
    provider: CloudStorageProvider
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    rootFolderId?: string;
    rootFolderName?: string;
  } | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('cloud_storage_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw this.handleError(error);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at),
      rootFolderId: data.root_folder_id || undefined,
      rootFolderName: data.root_folder_name || undefined,
    };
  }

  /**
   * Delete cloud storage connection
   */
  async deleteCloudStorageConnection(
    userId: string,
    provider: CloudStorageProvider
  ): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from('cloud_storage_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) throw this.handleError(error);
  }

  // ============================================================================
  // REAL-TIME COLLABORATION
  // ============================================================================

  /**
   * Subscribe to investigation changes
   */
  subscribeToInvestigation(
    investigationId: string,
    callbacks: {
      onEvidenceChange?: (evidence: Evidence, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
      onFlagChange?: (flag: EvidenceFlag, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
      onCommentChange?: (comment: FlagComment, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
      onPresenceChange?: (presence: PresenceState[]) => void;
    }
  ): () => void {
    if (!this.client) return () => {};

    const channelName = `investigation:${investigationId}`;

    if (this.realtimeChannels.has(channelName)) {
      console.warn(`[Supabase] Channel ${channelName} already exists`);
      return () => this.unsubscribeFromChannel(channelName);
    }

    const channel = this.client.channel(channelName);

    // Evidence changes
    if (callbacks.onEvidenceChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evidence',
          filter: `investigation_id=eq.${investigationId}`,
        },
        (payload) => {
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const data = (event === 'DELETE' ? payload.old : payload.new) as EvidenceRow;
          callbacks.onEvidenceChange!(this.rowToEvidence(data), event);
        }
      );
    }

    // Flag changes
    if (callbacks.onFlagChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evidence_flags',
        },
        (payload) => {
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const data = (event === 'DELETE' ? payload.old : payload.new) as FlagRow;
          callbacks.onFlagChange!(this.rowToFlag(data), event);
        }
      );
    }

    // Comment changes
    if (callbacks.onCommentChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flag_comments',
        },
        (payload) => {
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const data = (event === 'DELETE' ? payload.old : payload.new) as CommentRow;
          callbacks.onCommentChange!(this.rowToComment(data), event);
        }
      );
    }

    // Presence tracking
    if (callbacks.onPresenceChange) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences: PresenceState[] = Object.values(state).flat().map((p: unknown) => p as PresenceState);
        callbacks.onPresenceChange!(presences);
      });
    }

    channel.subscribe();
    this.realtimeChannels.set(channelName, channel);

    return () => this.unsubscribeFromChannel(channelName);
  }

  /**
   * Track user presence
   */
  async trackPresence(
    investigationId: string,
    presence: Omit<PresenceState, 'status'>
  ): Promise<void> {
    const channelName = `investigation:${investigationId}`;
    const channel = this.realtimeChannels.get(channelName);

    if (!channel) {
      console.warn(`[Supabase] Channel ${channelName} not found for presence tracking`);
      return;
    }

    await channel.track({
      ...presence,
      status: 'online',
    });
  }

  /**
   * Subscribe to synced playback
   */
  subscribeToSyncedPlayback(
    evidenceId: string,
    onPlaybackChange: (state: SyncedPlaybackState) => void
  ): () => void {
    if (!this.client) return () => {};

    const channelName = `playback:${evidenceId}`;

    if (this.realtimeChannels.has(channelName)) {
      return () => this.unsubscribeFromChannel(channelName);
    }

    const channel = this.client.channel(channelName);

    channel.on('broadcast', { event: 'playback' }, (payload) => {
      onPlaybackChange(payload.payload as SyncedPlaybackState);
    });

    channel.subscribe();
    this.realtimeChannels.set(channelName, channel);

    return () => this.unsubscribeFromChannel(channelName);
  }

  /**
   * Broadcast playback state
   */
  async broadcastPlaybackState(
    evidenceId: string,
    state: SyncedPlaybackState
  ): Promise<void> {
    const channelName = `playback:${evidenceId}`;
    const channel = this.realtimeChannels.get(channelName);

    if (!channel) {
      console.warn(`[Supabase] Channel ${channelName} not found for playback broadcast`);
      return;
    }

    await channel.send({
      type: 'broadcast',
      event: 'playback',
      payload: state,
    });
  }

  /**
   * Unsubscribe from a channel
   */
  private unsubscribeFromChannel(channelName: string): void {
    const channel = this.realtimeChannels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.realtimeChannels.delete(channelName);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    this.realtimeChannels.forEach((channel) => channel.unsubscribe());
    this.realtimeChannels.clear();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async incrementEvidenceCount(investigationId: string): Promise<void> {
    if (!this.client) return;
    await this.client.rpc('increment_evidence_count', { investigation_id: investigationId });
  }

  private async decrementEvidenceCount(investigationId: string): Promise<void> {
    if (!this.client) return;
    await this.client.rpc('decrement_evidence_count', { investigation_id: investigationId });
  }

  private async incrementFlagCount(evidenceId: string): Promise<void> {
    if (!this.client) return;
    await this.client.rpc('increment_flag_count', { evidence_id: evidenceId });
  }

  private async decrementFlagCount(evidenceId: string): Promise<void> {
    if (!this.client) return;
    await this.client.rpc('decrement_flag_count', { evidence_id: evidenceId });
  }

  private async incrementCommentCount(flagId: string): Promise<void> {
    if (!this.client) return;
    await this.client.rpc('increment_comment_count', { flag_id: flagId });
  }

  private async decrementCommentCount(flagId: string): Promise<void> {
    if (!this.client) return;
    await this.client.rpc('decrement_comment_count', { flag_id: flagId });
  }

  private mapSortColumn(sortBy: string): string {
    const columnMap: Record<string, string> = {
      title: 'title',
      startDate: 'start_date',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      evidenceCount: 'evidence_count',
    };
    return columnMap[sortBy] || 'created_at';
  }

  private rowToUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      photoURL: row.photo_url,
      emailVerified: true, // From Firebase
      providerId: row.provider_id as 'google.com' | 'password',
      createdAt: new Date(row.created_at),
      lastLoginAt: new Date(row.updated_at),
    };
  }

  private rowToSubscription(row: SubscriptionRow): Subscription {
    return {
      id: row.id,
      userId: row.user_id,
      tier: row.tier as Subscription['tier'],
      status: row.status as Subscription['status'],
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      currentPeriodStart: new Date(row.current_period_start),
      currentPeriodEnd: new Date(row.current_period_end),
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToInvestigation(row: InvestigationRow): Investigation {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      location: row.location as unknown as Investigation['location'],
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      status: row.status as Investigation['status'],
      teamMembers: [], // Loaded separately
      evidenceCount: row.evidence_count,
      flagCount: row.flag_count,
      cloudStorageProvider: row.cloud_storage_provider as CloudStorageProvider | undefined,
      cloudFolderId: row.cloud_folder_id || undefined,
      tags: row.tags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToTeamMember(row: TeamMemberRow): TeamMember {
    return {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      photoURL: row.photo_url || undefined,
      role: row.role as TeamMember['role'],
      joinedAt: new Date(row.joined_at),
      invitedBy: row.invited_by,
    };
  }

  private rowToEvidence(row: EvidenceRow): Evidence {
    return {
      id: row.id,
      investigationId: row.investigation_id,
      userId: row.user_id,
      type: row.type as Evidence['type'],
      title: row.title,
      description: row.description || undefined,
      fileName: row.file_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      duration: row.duration || undefined,
      cloudFileId: row.cloud_file_id,
      cloudProvider: row.cloud_provider as CloudStorageProvider,
      thumbnailUrl: row.thumbnail_url || undefined,
      metadata: row.metadata as unknown as Evidence['metadata'],
      flags: [], // Loaded separately
      flagCount: row.flag_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToFlag(row: FlagRow): EvidenceFlag {
    return {
      id: row.id,
      evidenceId: row.evidence_id,
      userId: row.user_id,
      userDisplayName: row.user_display_name,
      userPhotoURL: row.user_photo_url || undefined,
      type: row.type as EvidenceFlag['type'],
      customType: row.custom_type || undefined,
      timestamp: row.timestamp,
      endTimestamp: row.end_timestamp || undefined,
      title: row.title,
      description: row.description || undefined,
      comments: [], // Loaded separately
      commentCount: row.comment_count,
      confidence: row.confidence as EvidenceFlag['confidence'],
      aiSummary: row.ai_summary || undefined,
      aiAnalysis: row.ai_analysis as unknown as EvidenceFlag['aiAnalysis'],
      tags: row.tags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToComment(row: CommentRow): FlagComment {
    return {
      id: row.id,
      flagId: row.flag_id,
      userId: row.user_id,
      userDisplayName: row.user_display_name,
      userPhotoURL: row.user_photo_url || undefined,
      content: row.content,
      mentions: row.mentions,
      reactions: row.reactions as unknown as FlagComment['reactions'],
      edited: row.edited,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private handleError(error: { message: string; code?: string }): Error {
    console.error('[Supabase] Error:', error);
    return new Error(error.message);
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();

// Export class for testing
export { SupabaseService };
