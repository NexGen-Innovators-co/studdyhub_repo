// Supabase Edge Function: calendar-callback
// Handles OAuth callback from Google Calendar and Outlook Calendar

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI')!

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!
const MICROSOFT_REDIRECT_URI = Deno.env.get('MICROSOFT_REDIRECT_URI')!
interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

// Exchange Google authorization code for tokens
async function exchangeGoogleCode(code: string): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google token exchange failed: ${error}`)
  }

  return response.json()
}

// Exchange Microsoft authorization code for tokens
async function exchangeMicrosoftCode(code: string): Promise<TokenResponse> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Microsoft token exchange failed: ${error}`)
  }

  return response.json()
}

// Get Google Calendar ID (primary calendar)
async function getGoogleCalendarId(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get Google Calendar ID')
  }

  const data = await response.json()
  return data.id
}

// Get Microsoft Calendar ID (default calendar)
async function getMicrosoftCalendarId(accessToken: string): Promise<string> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get Microsoft Calendar ID')
  }

  const data = await response.json()
  return data.id
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Parse query parameters
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const provider = url.searchParams.get('provider') || 'google'

    // Handle OAuth errors
    if (error) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head><title>Calendar Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'calendar-auth-error', 
                error: '${error}' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
        `,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Validate required parameters
    if (!code || !state) {
      return new Response('Missing required parameters', { status: 400 })
    }

    // Parse state (contains user_id)
    const stateData = JSON.parse(decodeURIComponent(state))
    const userId = stateData.user_id

    if (!userId) {
      return new Response('Invalid state parameter', { status: 400 })
    }

    // Exchange authorization code for tokens
    let tokenResponse: TokenResponse
    let calendarId: string

    if (provider === 'google') {
      tokenResponse = await exchangeGoogleCode(code)
      calendarId = await getGoogleCalendarId(tokenResponse.access_token)
    } else if (provider === 'outlook') {
      tokenResponse = await exchangeMicrosoftCode(code)
      calendarId = await getMicrosoftCalendarId(tokenResponse.access_token)
    } else {
      return new Response('Invalid provider', { status: 400 })
    }

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Save or update calendar integration
    const { data: integration, error: dbError } = await supabaseClient
      .from('calendar_integrations')
      .upsert({
        user_id: userId,
        provider,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: expiresAt.toISOString(),
        calendar_id: calendarId,
        sync_enabled: true,
      }, {
        onConflict: 'user_id,provider',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head><title>Calendar Connection Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                type: 'calendar-auth-error', 
                error: 'Failed to save calendar integration' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>
        `,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Return success page that closes popup and notifies opener
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Connected Successfully</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              text-align: center;
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            }
            .success-icon {
              width: 64px;
              height: 64px;
              margin: 0 auto 1.5rem;
              border-radius: 50%;
              background: #10b981;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .checkmark {
              width: 32px;
              height: 32px;
              stroke: white;
              stroke-width: 3;
              fill: none;
              animation: draw 0.5s ease-in-out;
            }
            @keyframes draw {
              from { stroke-dashoffset: 100; }
              to { stroke-dashoffset: 0; }
            }
            h1 {
              color: #1f2937;
              margin: 0 0 0.5rem;
              font-size: 1.5rem;
            }
            p {
              color: #6b7280;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <svg class="checkmark" viewBox="0 0 50 50" stroke-dasharray="100" stroke-dashoffset="100">
                <path d="M10 25 L20 35 L40 15" />
              </svg>
            </div>
            <h1>Calendar Connected!</h1>
            <p>Your ${provider === 'google' ? 'Google' : 'Outlook'} Calendar has been connected successfully.</p>
            <p style="margin-top: 1rem; font-size: 0.875rem;">This window will close automatically...</p>
          </div>
          <script>
            window.opener?.postMessage({ 
              type: 'calendar-auth-success', 
              provider: '${provider}',
              integration: ${JSON.stringify(integration)}
            }, '*');
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    console.error('Error in calendar-callback function:', error)
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Calendar Connection Failed</title></head>
        <body>
          <script>
            window.opener?.postMessage({ 
              type: 'calendar-auth-error', 
              error: '${error.message}' 
            }, '*');
            window.close();
          </script>
        </body>
      </html>
      `,
      { 
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }
})
