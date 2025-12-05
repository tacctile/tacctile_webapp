-- ============================================================================
-- TACCTILE SUPABASE DATABASE SCHEMA
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to set up the database
-- https://supabase.com/dashboard/project/_/sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  provider_id TEXT NOT NULL DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 year',
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own subscription
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- ============================================================================
-- INVESTIGATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.investigations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location JSONB NOT NULL DEFAULT '{}',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  cloud_storage_provider TEXT CHECK (cloud_storage_provider IN ('google_drive', 'dropbox', 'onedrive')),
  cloud_folder_id TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  evidence_count INTEGER NOT NULL DEFAULT 0,
  flag_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_investigations_user_id ON public.investigations(user_id);
CREATE INDEX idx_investigations_status ON public.investigations(status);
CREATE INDEX idx_investigations_created_at ON public.investigations(created_at DESC);

-- Enable RLS
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

-- Users can view investigations they own or are members of
CREATE POLICY "Users can view own investigations" ON public.investigations
  FOR SELECT USING (
    auth.uid()::text = user_id::text
    OR id IN (
      SELECT investigation_id FROM public.team_members
      WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own investigations" ON public.investigations
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own investigations" ON public.investigations
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own investigations" ON public.investigations
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- ============================================================================
-- TEAM MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  PRIMARY KEY (investigation_id, user_id)
);

-- Index for faster queries
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team members can view their own memberships
CREATE POLICY "Team members can view memberships" ON public.team_members
  FOR SELECT USING (
    user_id::text = auth.uid()::text
    OR investigation_id IN (
      SELECT id FROM public.investigations WHERE user_id::text = auth.uid()::text
    )
  );

-- ============================================================================
-- INVESTIGATION INVITES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.investigation_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_invites_email ON public.investigation_invites(email);
CREATE INDEX idx_invites_investigation_id ON public.investigation_invites(investigation_id);

-- Enable RLS
ALTER TABLE public.investigation_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EVIDENCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'sensor_reading', 'thermal', 'motion', 'radio_sweep', 'document', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  duration REAL, -- For audio/video in seconds
  cloud_file_id TEXT NOT NULL,
  cloud_provider TEXT NOT NULL CHECK (cloud_provider IN ('google_drive', 'dropbox', 'onedrive')),
  thumbnail_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  flag_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_evidence_investigation_id ON public.evidence(investigation_id);
CREATE INDEX idx_evidence_user_id ON public.evidence(user_id);
CREATE INDEX idx_evidence_type ON public.evidence(type);
CREATE INDEX idx_evidence_created_at ON public.evidence(created_at DESC);

-- Enable RLS
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

-- Users can view evidence for investigations they're part of
CREATE POLICY "Users can view investigation evidence" ON public.evidence
  FOR SELECT USING (
    investigation_id IN (
      SELECT id FROM public.investigations WHERE user_id::text = auth.uid()::text
      UNION
      SELECT investigation_id FROM public.team_members WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert evidence" ON public.evidence
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text
    AND investigation_id IN (
      SELECT id FROM public.investigations WHERE user_id::text = auth.uid()::text
      UNION
      SELECT investigation_id FROM public.team_members WHERE user_id::text = auth.uid()::text AND role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- EVIDENCE FLAGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.evidence_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  user_display_name TEXT NOT NULL,
  user_photo_url TEXT,
  type TEXT NOT NULL CHECK (type IN ('anomaly', 'audio_anomaly', 'visual_anomaly', 'sensor_spike', 'temperature_change', 'motion_detected', 'audio_artifact', 'light_anomaly', 'shadow_figure', 'equipment_malfunction', 'debunked', 'review_needed', 'highlight', 'custom')),
  custom_type TEXT,
  timestamp REAL NOT NULL DEFAULT 0, -- Position in media (seconds)
  end_timestamp REAL, -- For range markers
  title TEXT NOT NULL,
  description TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  ai_summary TEXT,
  ai_analysis JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flags_evidence_id ON public.evidence_flags(evidence_id);
CREATE INDEX idx_flags_user_id ON public.evidence_flags(user_id);
CREATE INDEX idx_flags_type ON public.evidence_flags(type);
CREATE INDEX idx_flags_timestamp ON public.evidence_flags(timestamp);
CREATE INDEX idx_flags_created_at ON public.evidence_flags(created_at DESC);

-- Enable RLS
ALTER TABLE public.evidence_flags ENABLE ROW LEVEL SECURITY;

-- Users can view flags for evidence they can access
CREATE POLICY "Users can view flags" ON public.evidence_flags
  FOR SELECT USING (
    evidence_id IN (
      SELECT id FROM public.evidence WHERE investigation_id IN (
        SELECT id FROM public.investigations WHERE user_id::text = auth.uid()::text
        UNION
        SELECT investigation_id FROM public.team_members WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users can insert flags" ON public.evidence_flags
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own flags" ON public.evidence_flags
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own flags" ON public.evidence_flags
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- ============================================================================
-- FLAG COMMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.flag_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_id UUID NOT NULL REFERENCES public.evidence_flags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  user_display_name TEXT NOT NULL,
  user_photo_url TEXT,
  content TEXT NOT NULL,
  mentions TEXT[] NOT NULL DEFAULT '{}',
  reactions JSONB[] NOT NULL DEFAULT '{}',
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_comments_flag_id ON public.flag_comments(flag_id);
CREATE INDEX idx_comments_user_id ON public.flag_comments(user_id);
CREATE INDEX idx_comments_created_at ON public.flag_comments(created_at);

-- Enable RLS
ALTER TABLE public.flag_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on flags they can access
CREATE POLICY "Users can view comments" ON public.flag_comments
  FOR SELECT USING (
    flag_id IN (
      SELECT id FROM public.evidence_flags WHERE evidence_id IN (
        SELECT id FROM public.evidence WHERE investigation_id IN (
          SELECT id FROM public.investigations WHERE user_id::text = auth.uid()::text
          UNION
          SELECT investigation_id FROM public.team_members WHERE user_id::text = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "Users can insert comments" ON public.flag_comments
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own comments" ON public.flag_comments
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own comments" ON public.flag_comments
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- ============================================================================
-- CLOUD STORAGE CONNECTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cloud_storage_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_drive', 'dropbox', 'onedrive')),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  root_folder_id TEXT,
  root_folder_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.cloud_storage_connections ENABLE ROW LEVEL SECURITY;

-- Users can only access their own connections
CREATE POLICY "Users can view own connections" ON public.cloud_storage_connections
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own connections" ON public.cloud_storage_connections
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own connections" ON public.cloud_storage_connections
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own connections" ON public.cloud_storage_connections
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- ============================================================================
-- COUNTER FUNCTIONS (for incrementing/decrementing counts)
-- ============================================================================

-- Increment evidence count
CREATE OR REPLACE FUNCTION increment_evidence_count(investigation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.investigations
  SET evidence_count = evidence_count + 1, updated_at = NOW()
  WHERE id = investigation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement evidence count
CREATE OR REPLACE FUNCTION decrement_evidence_count(investigation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.investigations
  SET evidence_count = GREATEST(0, evidence_count - 1), updated_at = NOW()
  WHERE id = investigation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment flag count
CREATE OR REPLACE FUNCTION increment_flag_count(evidence_id UUID)
RETURNS VOID AS $$
DECLARE
  inv_id UUID;
BEGIN
  -- Update evidence flag count
  UPDATE public.evidence
  SET flag_count = flag_count + 1, updated_at = NOW()
  WHERE id = evidence_id
  RETURNING investigation_id INTO inv_id;

  -- Update investigation flag count
  UPDATE public.investigations
  SET flag_count = flag_count + 1, updated_at = NOW()
  WHERE id = inv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement flag count
CREATE OR REPLACE FUNCTION decrement_flag_count(evidence_id UUID)
RETURNS VOID AS $$
DECLARE
  inv_id UUID;
BEGIN
  -- Update evidence flag count
  UPDATE public.evidence
  SET flag_count = GREATEST(0, flag_count - 1), updated_at = NOW()
  WHERE id = evidence_id
  RETURNING investigation_id INTO inv_id;

  -- Update investigation flag count
  UPDATE public.investigations
  SET flag_count = GREATEST(0, flag_count - 1), updated_at = NOW()
  WHERE id = inv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment comment count
CREATE OR REPLACE FUNCTION increment_comment_count(flag_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.evidence_flags
  SET comment_count = comment_count + 1, updated_at = NOW()
  WHERE id = flag_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement comment count
CREATE OR REPLACE FUNCTION decrement_comment_count(flag_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.evidence_flags
  SET comment_count = GREATEST(0, comment_count - 1), updated_at = NOW()
  WHERE id = flag_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_investigations_updated_at
  BEFORE UPDATE ON public.investigations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_evidence_updated_at
  BEFORE UPDATE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_flags_updated_at
  BEFORE UPDATE ON public.evidence_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.flag_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cloud_storage_updated_at
  BEFORE UPDATE ON public.cloud_storage_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

-- Enable realtime for collaborative features
ALTER PUBLICATION supabase_realtime ADD TABLE public.evidence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evidence_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flag_comments;

-- ============================================================================
-- DONE!
-- ============================================================================
-- Your Tacctile database schema is now ready.
-- Don't forget to:
-- 1. Enable Row Level Security in Supabase Dashboard
-- 2. Set up your Firebase Auth and connect it to Supabase
-- 3. Configure your environment variables
