// Supabase Edge Function: calendar-auth
// Generates OAuth authorization URLs for Google Calendar and Outlook Calendar

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI')!

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!
const MICROSOFT_REDIRECT_URI = Deno.env.get('MICROSOFT_REDIRECT_URI')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { provider, userId } = await req.json()

    if (!provider || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing provider or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let authUrl = ''

    if (provider === 'google') {
      const scope = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ].join(' ')

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope,
        access_type: 'offline', // Request refresh token
        prompt: 'consent',      // Force consent screen to get refresh token
        state: JSON.stringify({ provider: 'google', userId }),
      })

      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    } else if (provider === 'outlook') {
      const scope = [
        'offline_access',
        'Calendars.ReadWrite',
        'User.Read',
      ].join(' ')

      const params = new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        redirect_uri: MICROSOFT_REDIRECT_URI,
        response_type: 'code',
        scope,
        response_mode: 'query',
        state: JSON.stringify({ provider: 'outlook', userId }),
      })

      authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ authUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
