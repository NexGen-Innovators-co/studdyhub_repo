// Supabase Edge Function: refresh-calendar-token
// Automatically refreshes expired calendar OAuth tokens

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { logSystemError } from '../_shared/errorLogger.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

// Refresh Google access token
async function refreshGoogleToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google token refresh failed: ${error}`)
  }

  return response.json()
}

// Refresh Microsoft access token
async function refreshMicrosoftToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Microsoft token refresh failed: ${error}`)
  }

  return response.json()
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const body = await req.json()
    const { integration_id } = body

    if (!integration_id) {
      return new Response(
        JSON.stringify({ error: 'integration_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the calendar integration
    const { data: integration, error: fetchError } = await supabaseClient
      .from('calendar_integrations')
      .select('*')
      .eq('id', integration_id)
      .single()

    if (fetchError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if refresh token exists
    if (!integration.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No refresh token available. Please reconnect the calendar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Refresh the token based on provider
    let tokenResponse: TokenResponse

    if (integration.provider === 'google') {
      tokenResponse = await refreshGoogleToken(integration.refresh_token)
    } else if (integration.provider === 'outlook') {
      tokenResponse = await refreshMicrosoftToken(integration.refresh_token)
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid provider' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Calculate new expiration time
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    // Update the integration with new tokens
    const updateData: any = {
      access_token: tokenResponse.access_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Some providers return a new refresh token
    if (tokenResponse.refresh_token) {
      updateData.refresh_token = tokenResponse.refresh_token
    }

    const { data: updatedIntegration, error: updateError } = await supabaseClient
      .from('calendar_integrations')
      .update(updateData)
      .eq('id', integration_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating integration:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update integration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        access_token: updatedIntegration.access_token,
        expires_at: updatedIntegration.expires_at,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'refresh-calendar-token',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[refresh-calendar-token] Error logging failed:', _logErr); }
    console.error('Error in refresh-calendar-token function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
