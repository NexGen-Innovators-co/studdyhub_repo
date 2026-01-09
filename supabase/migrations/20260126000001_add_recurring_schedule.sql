-- Add recurring event support to schedule_items

ALTER TABLE schedule_items 
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
ADD COLUMN recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN recurrence_days INTEGER[], -- Array of day numbers (0-6)
ADD COLUMN recurrence_end_date TIMESTAMP WITH TIME ZONE;
