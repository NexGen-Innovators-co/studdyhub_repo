-- Add personal_context column to profiles table
-- This stores user-provided information about themselves (habits, preferences, etc.)
-- that gets injected into AI prompts for better personalization.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_context text DEFAULT '';
