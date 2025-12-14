# Notification & Calendar Integration Setup Guide

This guide walks you through setting up the complete notification and calendar integration system for StuddyHub.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Environment Variables](#environment-variables)
4. [VAPID Keys Generation](#vapid-keys-generation)
5. [Google Calendar Setup](#google-calendar-setup)
6. [Microsoft Outlook Setup](#microsoft-outlook-setup)
7. [Supabase Edge Functions Deployment](#supabase-edge-functions-deployment)
8. [Service Worker Registration](#service-worker-registration)
9. [UI Integration](#ui-integration)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

- Supabase project set up and running
- Node.js 18+ and npm/bun installed
- Supabase CLI installed (`npm install -g supabase`)
- Google Cloud Console account
- Microsoft Azure account (for Outlook integration)

## Database Setup

### 1. Run the Migration

Apply the notification and calendar integration database migration:

```bash
# If using Supabase CLI locally
supabase db push

# Or apply the migration file directly in Supabase Dashboard
# Go to Database > Migrations and paste the contents of:
# supabase/migrations/20240101000000_add_notifications_and_calendar.sql
```

This creates the following tables:
- `notification_subscriptions` - Push notification subscriptions
- `notifications` - Notification history
- `notification_preferences` - User notification settings
- `calendar_integrations` - Calendar OAuth tokens
- `schedule_reminders` - Reminder settings for scheduled items

### 2. Verify Tables

Check that all tables were created successfully:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'notification_subscriptions',
  'notifications', 
  'notification_preferences',
  'calendar_integrations',
  'schedule_reminders'
);
```

## Environment Variables

### 1. Frontend (.env)

Create or update your `.env` file in the project root:

```env
# Existing Supabase vars
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Push Notifications
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key

# Google Calendar (Optional - if you want OAuth in frontend)
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Microsoft Calendar (Optional)
VITE_MICROSOFT_CLIENT_ID=your-microsoft-client-id
```

### 2. Supabase Edge Functions

Set environment variables in Supabase Dashboard:

1. Go to Project Settings > Edge Functions
2. Add the following secrets:

```bash
# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:support@studdyhub.com

# Google Calendar API
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=https://your-project.supabase.co/functions/v1/calendar-callback

# Microsoft Graph API
MICROSOFT_CLIENT_ID=your-microsoft-oauth-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-oauth-client-secret
MICROSOFT_REDIRECT_URI=https://your-project.supabase.co/functions/v1/calendar-callback
```

Or use Supabase CLI:

```bash
supabase secrets set VAPID_PUBLIC_KEY=your-key
supabase secrets set VAPID_PRIVATE_KEY=your-key
supabase secrets set GOOGLE_CLIENT_ID=your-id
# ... etc
```

## VAPID Keys Generation

VAPID (Voluntary Application Server Identification) keys are required for Web Push notifications.

### Generate Keys

```bash
# Install web-push globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys

# Output:
# =======================================
# Public Key:
# BEl62iUYgU...
#
# Private Key:
# bdSiNmV...
# =======================================
```

### Save Keys

1. Copy the **Public Key** to `VITE_VAPID_PUBLIC_KEY` in `.env`
2. Copy both keys to Supabase secrets (see above)

⚠️ **Important**: Keep the private key secret! Never commit it to version control.

## Google Calendar Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure OAuth consent screen if prompted:
   - User Type: External
   - App name: StuddyHub
   - Support email: your-email@example.com
   - Scopes: Add `https://www.googleapis.com/auth/calendar`
4. Create OAuth Client ID:
   - Application type: Web application
   - Name: StuddyHub Calendar
   - Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - `https://your-domain.com` (production)
   - Authorized redirect URIs:
     - `https://your-project.supabase.co/functions/v1/calendar-callback`
5. Save the **Client ID** and **Client Secret**

### 3. Configure Scopes

Required OAuth scopes:
- `https://www.googleapis.com/auth/calendar` - Read/write calendar access

## Microsoft Outlook Setup

### 1. Register Application in Azure

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Configure:
   - Name: StuddyHub Calendar
   - Supported account types: Accounts in any organizational directory and personal Microsoft accounts
   - Redirect URI: Web - `https://your-project.supabase.co/functions/v1/calendar-callback`
5. Click "Register"

### 2. Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission" > "Microsoft Graph"
3. Select "Delegated permissions"
4. Add:
   - `Calendars.ReadWrite` - Read and write user calendars
   - `offline_access` - Maintain access to data
5. Click "Grant admin consent"

### 3. Create Client Secret

1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Description: StuddyHub Calendar Secret
4. Expires: 24 months (or custom)
5. Click "Add"
6. **Copy the secret value immediately** (it won't be shown again)

### 4. Get Application ID

1. Go to "Overview"
2. Copy the **Application (client) ID**

## Supabase Edge Functions Deployment

### 1. Login to Supabase

```bash
supabase login
```

### 2. Link Your Project

```bash
supabase link --project-ref your-project-ref
```

### 3. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy send-notification
supabase functions deploy calendar-callback
supabase functions deploy refresh-calendar-token
```

### 4. Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs send-notification
```

## Service Worker Registration

### 1. Update Service Worker Path

The service worker is located at `public/sw.js`. Update the registration in your app:

```typescript
// In src/main.tsx or App.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}
```

### 2. Test Service Worker

1. Open DevTools > Application > Service Workers
2. Check that `sw.js` is registered and activated
3. Test push notifications in DevTools > Application > Service Workers > Push

## UI Integration

### 1. Add NotificationCenter to Layout

Update your main layout component (e.g., `Header.tsx`):

```typescript
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export function Header() {
  return (
    <header>
      {/* Other header content */}
      <NotificationCenter />
    </header>
  );
}
```

### 2. Add Settings Pages

Create a settings page with tabs:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationPreferencesSettings } from '@/components/settings/NotificationPreferencesSettings';
import { CalendarIntegrationSettings } from '@/components/settings/CalendarIntegrationSettings';

export function SettingsPage() {
  return (
    <Tabs defaultValue="notifications">
      <TabsList>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>
      
      <TabsContent value="notifications">
        <NotificationPreferencesSettings />
      </TabsContent>
      
      <TabsContent value="calendar">
        <CalendarIntegrationSettings />
      </TabsContent>
    </Tabs>
  );
}
```

### 3. Update Schedule Component

Add calendar sync buttons to your schedule items. See the implementation in the Schedule component.

## Testing

### 1. Test Push Notifications

```typescript
// Use the test notification function
import { useNotifications } from '@/hooks/useNotifications';

const { sendTestNotification } = useNotifications();

// Send a test notification
await sendTestNotification();
```

Or use the edge function directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "type": "system_update",
    "title": "Test Notification",
    "message": "This is a test notification"
  }'
```

### 2. Test Calendar Integration

1. Go to Settings > Calendar
2. Click "Connect Google Calendar" or "Connect Outlook Calendar"
3. Complete OAuth flow
4. Verify integration appears as "Connected"
5. Create a schedule item
6. Click "Sync to Calendar"
7. Check that event appears in your calendar

### 3. Test Quiet Hours

1. Go to Settings > Notifications
2. Enable "Quiet Hours"
3. Set time range (e.g., 22:00 - 08:00)
4. Send a notification during quiet hours
5. Verify it's not delivered

## Troubleshooting

### Push Notifications Not Working

**Check browser support:**
```javascript
if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
  console.log('Push notifications supported');
} else {
  console.error('Push notifications not supported');
}
```

**Check permissions:**
```javascript
console.log('Notification permission:', Notification.permission);
```

**Check service worker:**
- Open DevTools > Application > Service Workers
- Verify service worker is active
- Check for errors in console

**Check VAPID keys:**
- Ensure public key is correctly set in environment variables
- Verify private key is set in Supabase secrets

### Calendar Integration Failing

**Google Calendar:**
- Verify OAuth client ID and secret
- Check redirect URI matches exactly
- Ensure Calendar API is enabled in Google Cloud Console
- Check OAuth consent screen is configured

**Outlook Calendar:**
- Verify application ID and client secret
- Check redirect URI in Azure portal
- Ensure API permissions are granted
- Check that admin consent is given

**Token refresh issues:**
- Verify `refresh_token` is being saved
- Check token expiration logic
- Test the refresh-calendar-token edge function

### Edge Functions Not Deploying

```bash
# Check Supabase CLI version
supabase --version

# Update CLI
npm update -g supabase

# Check function logs
supabase functions logs function-name --tail

# Test function locally
supabase functions serve
```

### Database Issues

```sql
-- Check if tables exist
SELECT * FROM notification_subscriptions LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- Reset a user's preferences
DELETE FROM notification_preferences WHERE user_id = 'user-uuid';
```

## Production Checklist

Before deploying to production:

- [ ] All environment variables set in production
- [ ] VAPID keys generated and secured
- [ ] Google OAuth configured with production URLs
- [ ] Microsoft OAuth configured with production URLs
- [ ] Edge functions deployed
- [ ] Database migration applied
- [ ] Service worker registered correctly
- [ ] Push notification permissions tested
- [ ] Calendar integration tested
- [ ] Quiet hours feature tested
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Rate limiting considered
- [ ] CORS configured correctly

## Security Best Practices

1. **Never expose private keys** in client-side code
2. **Use environment variables** for all secrets
3. **Implement rate limiting** on edge functions
4. **Validate all user input** before processing
5. **Use RLS policies** to protect user data
6. **Rotate secrets regularly** (OAuth secrets, VAPID keys)
7. **Monitor edge function logs** for suspicious activity
8. **Implement token refresh** before expiration
9. **Handle errors gracefully** without exposing internal details
10. **Use HTTPS** for all communication

## Support

For issues or questions:
- Check the [main documentation](../README.md)
- Review [ARCHITECTURE.md](./ARCHITECTURE.md)
- Open an issue on GitHub
- Contact support@studdyhub.com

---

**Last Updated:** 2024
**Version:** 1.0.0
