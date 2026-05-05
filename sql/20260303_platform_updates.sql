-- ============================================================
-- Platform Updates — admin-to-user communication system
-- ============================================================
-- Allows admins to create announcements about upcoming changes,
-- new features, maintenance windows, etc. Users see banners
-- and can read details including docs, changelogs, and videos.
-- ============================================================

-- 1. Main updates table
CREATE TABLE IF NOT EXISTS public.platform_updates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title          TEXT NOT NULL,
  summary        TEXT NOT NULL,                -- short text shown in the banner (max ~200 chars)
  content        TEXT,                          -- full markdown body (changelog, docs, etc.)
  
  -- Classification
  update_type    TEXT NOT NULL DEFAULT 'feature'
                   CHECK (update_type IN ('feature', 'improvement', 'bugfix', 'maintenance', 'announcement', 'breaking')),
  priority       TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  
  -- Media & links
  video_url      TEXT,                          -- YouTube / Loom / direct video link
  documentation_url TEXT,                       -- link to external docs or in-app page
  image_url      TEXT,                          -- optional banner image
  
  -- Versioning
  version_tag    TEXT,                          -- e.g. "v2.5.0", "March 2026 Update"
  
  -- Lifecycle
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  scheduled_for  TIMESTAMPTZ,                  -- when to auto-show (for upcoming updates)
  published_at   TIMESTAMPTZ,                  -- when it was actually published
  expires_at     TIMESTAMPTZ,                  -- optional auto-archive date
  
  -- Authorship
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Read tracking — which users have seen / dismissed each update
CREATE TABLE IF NOT EXISTS public.platform_update_reads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id      UUID NOT NULL REFERENCES public.platform_updates(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed      BOOLEAN NOT NULL DEFAULT false,
  
  UNIQUE(update_id, user_id)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_platform_updates_status ON public.platform_updates(status);
CREATE INDEX IF NOT EXISTS idx_platform_updates_type ON public.platform_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_platform_updates_priority ON public.platform_updates(priority);
CREATE INDEX IF NOT EXISTS idx_platform_updates_published_at ON public.platform_updates(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_updates_scheduled_for ON public.platform_updates(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_platform_updates_created_by ON public.platform_updates(created_by);

CREATE INDEX IF NOT EXISTS idx_platform_update_reads_user ON public.platform_update_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_update_reads_update ON public.platform_update_reads(update_id);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_platform_updates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_updates_updated_at ON public.platform_updates;
CREATE TRIGGER trg_platform_updates_updated_at
  BEFORE UPDATE ON public.platform_updates
  FOR EACH ROW EXECUTE FUNCTION update_platform_updates_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.platform_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_update_reads ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with updates
CREATE POLICY admin_full_access_platform_updates ON public.platform_updates
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Authenticated users can read published updates
CREATE POLICY users_read_published_updates ON public.platform_updates
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND status = 'published'
  );

-- Users can manage their own read records
CREATE POLICY users_manage_own_reads ON public.platform_update_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all read records (for analytics)
CREATE POLICY admin_view_all_reads ON public.platform_update_reads
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- ============================================================
-- Helper: publish a scheduled update (call from cron or manual)
-- ============================================================
CREATE OR REPLACE FUNCTION publish_scheduled_updates()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.platform_updates
  SET status = 'published',
      published_at = now()
  WHERE status = 'scheduled'
    AND scheduled_for <= now();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Helper: archive expired updates
-- ============================================================
CREATE OR REPLACE FUNCTION archive_expired_updates()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.platform_updates
  SET status = 'archived'
  WHERE status = 'published'
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
