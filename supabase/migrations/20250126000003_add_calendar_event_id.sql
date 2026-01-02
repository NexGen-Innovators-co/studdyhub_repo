-- Add calendar_event_id column to schedule_items table to store external calendar event IDs
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS calendar_event_id text;
