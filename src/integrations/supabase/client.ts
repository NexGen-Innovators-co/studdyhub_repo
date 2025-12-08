// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

// Hardcoded Supabase configuration (VITE_* env vars don't work in Lovable)
const supabaseUrl = 'https://kegsrvnywshxyucgjxml.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZ3Nydm55d3NoeHl1Y2dqeG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMzAxNTgsImV4cCI6MjA2NjkwNjE1OH0.uzLKKEp7mRk8cqg2ezVDpcYMVpOlgZjxkNMrpFigDf8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
