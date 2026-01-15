-- Migration to add processing status to class_recordings
ALTER TABLE public.class_recordings
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'failed'
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Index for querying pending jobs if needed
CREATE INDEX IF NOT EXISTS idx_class_recordings_processing_status ON public.class_recordings(processing_status);
