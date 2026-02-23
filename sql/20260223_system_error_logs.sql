-- ============================================================
-- System Error Logs — comprehensive error tracking for admin
-- ============================================================
-- Replaces the bare-bones error_logs table with a rich schema
-- that supports severity levels, source tracking, resolution
-- workflow, and automatic cleanup of old resolved entries.
-- ============================================================

-- Create the system_error_logs table
CREATE TABLE IF NOT EXISTS public.system_error_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Error classification
  severity      TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning', 'info')),
  source        TEXT NOT NULL,               -- e.g. 'generate-podcast', 'document-processor', 'paystack-webhook'
  component     TEXT,                        -- e.g. 'veo-polling', 'tts-generation', 'image-upload'
  error_code    TEXT,                        -- optional machine-readable code e.g. 'VEO_TIMEOUT', 'TTS_QUOTA'
  
  -- Error details
  message       TEXT NOT NULL,               -- human-readable error message
  details       JSONB DEFAULT '{}'::jsonb,   -- structured extra info (stack trace, request params, etc.)
  
  -- Context
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- which user triggered it (if applicable)
  request_id    TEXT,                        -- edge function invocation ID for correlation
  
  -- Resolution
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  resolved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_system_error_logs_status ON public.system_error_logs(status);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_severity ON public.system_error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_source ON public.system_error_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_created_at ON public.system_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_user_id ON public.system_error_logs(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_system_error_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_error_logs_updated_at ON public.system_error_logs;
CREATE TRIGGER trg_system_error_logs_updated_at
  BEFORE UPDATE ON public.system_error_logs
  FOR EACH ROW EXECUTE FUNCTION update_system_error_logs_updated_at();

-- RLS: Only service role can INSERT (edge functions), admins can SELECT/UPDATE
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so edge functions can always insert.
-- Admin users can read and update (acknowledge/resolve).
CREATE POLICY "Admins can read system error logs"
  ON public.system_error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admins can update system error logs"
  ON public.system_error_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- Allow service role inserts (edge functions use service role key)
CREATE POLICY "Service role can insert system error logs"
  ON public.system_error_logs FOR INSERT
  WITH CHECK (true);

-- Helper function: log a system error (callable from edge functions via RPC)
CREATE OR REPLACE FUNCTION public.log_system_error(
  p_severity    TEXT DEFAULT 'error',
  p_source      TEXT DEFAULT 'unknown',
  p_component   TEXT DEFAULT NULL,
  p_error_code  TEXT DEFAULT NULL,
  p_message     TEXT DEFAULT '',
  p_details     JSONB DEFAULT '{}'::jsonb,
  p_user_id     UUID DEFAULT NULL,
  p_request_id  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.system_error_logs (
    severity, source, component, error_code,
    message, details, user_id, request_id
  ) VALUES (
    p_severity, p_source, p_component, p_error_code,
    p_message, p_details, p_user_id, p_request_id
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute on the RPC to authenticated users (RLS still applies for reads)
GRANT EXECUTE ON FUNCTION public.log_system_error TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_system_error TO service_role;

-- Auto-cleanup: delete resolved/ignored logs older than 90 days
-- (Run via pg_cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_old_system_error_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.system_error_logs
  WHERE status IN ('resolved', 'ignored')
    AND created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Summary view for the admin dashboard
CREATE OR REPLACE VIEW public.system_error_summary AS
SELECT
  source,
  severity,
  status,
  COUNT(*) as count,
  MAX(created_at) as latest_at
FROM public.system_error_logs
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY source, severity, status
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1 
    WHEN 'error' THEN 2 
    WHEN 'warning' THEN 3 
    WHEN 'info' THEN 4 
  END,
  count DESC;
