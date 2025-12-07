// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  //console.error('Missing Supabase env vars:')
  //console.error('VITE_SUPABASE_URL:', supabaseUrl)
  //console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'present' : 'missing')
  throw new Error('Supabase URL and anon key are required. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Debug: Remove this after confirming it works
//console.log('Supabase connected to:', supabaseUrl)