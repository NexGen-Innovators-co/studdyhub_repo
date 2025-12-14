# Complete Setup Guide: Notifications & Calendar Integration

## Step-by-Step Implementation

### 🎯 Step 1: Run the Database Migration

Since the Supabase CLI isn't working due to network issues, use the Supabase Dashboard:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your StuddyHub project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Execute Migration**
   - Open: `supabase/migrations/20240101000000_add_notifications_and_calendar.sql`
   - Copy the ENTIRE file content (Ctrl+A, Ctrl+C)
   - Paste into the SQL Editor
   - Click "Run" button

4. **Verify Tables Created**
   - Go to "Table Editor" in left sidebar
   - You should now see these new tables:
     - `notifications`
     - `notification_subscriptions`
     - `notification_preferences`
     - `calendar_integrations`
     - `schedule_reminders`

---

### 🔑 Step 2: Generate VAPID Keys for Push Notifications

VAPID keys are required for Web Push notifications to work.

**Option A: Using Online Generator (Easiest)**
```
Visit: https://vapidkeys.com/
Click "Generate Keys"
Copy both Public and Private keys
```

**Option B: Using Node.js**
```powershell
# Install web-push globally
npm install -g web-push

# Generate keys
web-push generate-vapid-keys

# Output will show:
# Public Key: BEl62iU...
# Private Key: bdSiNm...
```

**Save These Keys:**
- Public Key → Will go in `.env` file
- Private Key → Will go in Supabase secrets

---

### 🔐 Step 3: Set Up Google Calendar OAuth

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com
   - Sign in with your Google account

2. **Create a New Project** (or select existing)
   - Click project dropdown at top
   - Click "New Project"
   - Name: "StuddyHub" or similar
   - Click "Create"

3. **Enable Google Calendar API**
   - In the search bar, type "Google Calendar API"
   - Click on "Google Calendar API"
   - Click "Enable"

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - User Type: **External**
   - Click "Create"
   - Fill in:
     - App name: `StuddyHub`
     - User support email: Your email
     - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Click "Add or Remove Scopes"
     - Search and add: `https://www.googleapis.com/auth/calendar`
   - Click "Save and Continue"
   - Test users: Add your email
   - Click "Save and Continue"

5. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: **Web application**
   - Name: `StuddyHub Calendar Integration`
   - Authorized JavaScript origins:
     ```
     http://localhost:5173
     https://your-production-domain.com
     ```
   - Authorized redirect URIs:
     ```
     https://YOUR_PROJECT_REF.supabase.co/functions/v1/calendar-callback
     ```
     *Replace YOUR_PROJECT_REF with your actual Supabase project reference*
   
   - Click "Create"
   - **SAVE THESE:**
     - Client ID
     - Client Secret

---

### 🔐 Step 4: Set Up Microsoft Outlook Calendar OAuth

1. **Go to Azure Portal**
   - Visit: https://portal.azure.com
   - Sign in with Microsoft account

2. **Register Application**
   - Search for "Azure Active Directory"
   - Click "App registrations" in left menu
   - Click "New registration"
   - Fill in:
     - Name: `StuddyHub Calendar`
     - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
     - Redirect URI: 
       - Type: Web
       - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/calendar-callback`
   - Click "Register"

3. **Configure API Permissions**
   - In your app, click "API permissions"
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Select "Delegated permissions"
   - Add these permissions:
     - `Calendars.ReadWrite` - Read and write user calendars
     - `offline_access` - Maintain access to data
   - Click "Add permissions"
   - Click "Grant admin consent" (if you have admin rights)

4. **Create Client Secret**
   - Click "Certificates & secrets"
   - Click "New client secret"
   - Description: `StuddyHub Calendar Secret`
   - Expires: 24 months
   - Click "Add"
   - **COPY THE SECRET VALUE IMMEDIATELY** (you can't see it again!)

5. **Get Application (Client) ID**
   - Go to "Overview" tab
   - Copy the **Application (client) ID**

---

### ⚙️ Step 5: Configure Environment Variables

#### A. Frontend Environment Variables (`.env`)

Create or update `.env` in project root:

```env
# Existing Supabase variables
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# VAPID Public Key (from Step 2)
VITE_VAPID_PUBLIC_KEY=BEl62iU...your-public-key-here
```

#### B. Supabase Secrets (Edge Functions)

1. **Go to Supabase Dashboard**
   - Select your project
   - Go to "Project Settings" > "Edge Functions"

2. **Add Secrets** (or use CLI if it works later):

```bash
# Using Dashboard:
# Click "Add new secret" for each:

# VAPID Keys
VAPID_PUBLIC_KEY = BEl62iU...your-public-key
VAPID_PRIVATE_KEY = bdSiNm...your-private-key
VAPID_SUBJECT = mailto:support@studdyhub.com

# Google Calendar
GOOGLE_CLIENT_ID = your-google-client-id
GOOGLE_CLIENT_SECRET = your-google-client-secret
GOOGLE_REDIRECT_URI = https://YOUR_PROJECT_REF.supabase.co/functions/v1/calendar-callback

# Microsoft Calendar
MICROSOFT_CLIENT_ID = your-microsoft-client-id
MICROSOFT_CLIENT_SECRET = your-microsoft-client-secret
MICROSOFT_REDIRECT_URI = https://YOUR_PROJECT_REF.supabase.co/functions/v1/calendar-callback
```

---

### ☁️ Step 6: Deploy Supabase Edge Functions

Since CLI isn't working, we'll deploy manually via Dashboard:

1. **Go to Supabase Dashboard**
   - Select your project
   - Click "Edge Functions" in left sidebar

2. **Deploy send-notification Function**
   - Click "Deploy new function"
   - Name: `send-notification`
   - Copy contents from: `supabase/functions/send-notification/index.ts`
   - Paste and click "Deploy"

3. **Deploy calendar-callback Function**
   - Click "Deploy new function"
   - Name: `calendar-callback`
   - Copy contents from: `supabase/functions/calendar-callback/index.ts`
   - Paste and click "Deploy"

4. **Deploy refresh-calendar-token Function**
   - Click "Deploy new function"
   - Name: `refresh-calendar-token`
   - Copy contents from: `supabase/functions/refresh-calendar-token/index.ts`
   - Paste and click "Deploy"

---

### 🎨 Step 7: Register Service Worker

Update `src/main.tsx` to register the Service Worker:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register Service Worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### 🧩 Step 8: Integrate UI Components

#### A. Add NotificationCenter to Header/Layout

Find your main layout component (likely `src/components/layout/Header.tsx` or similar):

```typescript
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      {/* Your existing header content */}
      <div className="flex items-center gap-4">
        {/* Other header items */}
        <NotificationCenter />
      </div>
    </header>
  );
}
```

#### B. Create Settings Page

Create `src/pages/Settings.tsx`:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationPreferencesSettings } from '@/components/settings/NotificationPreferencesSettings';
import { CalendarIntegrationSettings } from '@/components/settings/CalendarIntegrationSettings';

export function SettingsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="notifications" className="mt-6">
          <NotificationPreferencesSettings />
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-6">
          <CalendarIntegrationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### C. Add Route for Settings

In your router configuration (e.g., `src/App.tsx`):

```typescript
import { SettingsPage } from '@/pages/Settings';

// Add to your routes:
<Route path="/settings" element={<SettingsPage />} />
```

---

### 🧪 Step 9: Test Everything

#### Test 1: Service Worker Registration

1. Open your app in browser
2. Open DevTools (F12)
3. Go to **Application** tab > **Service Workers**
4. Verify `sw.js` is registered and "activated"

#### Test 2: Push Notifications

1. Go to Settings > Notifications
2. Toggle "Push Notifications" ON
3. Browser will ask for permission - click "Allow"
4. Check browser console - should see subscription successful
5. Go to Supabase > Table Editor > `notification_subscriptions`
6. Verify your subscription is saved

#### Test 3: Send Test Notification

Open browser console and run:

```javascript
// Get your Supabase client
const { data: { user } } = await window.supabase.auth.getUser();

// Send test notification
await fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer YOUR_ANON_KEY`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: user.id,
    type: 'system_update',
    title: 'Test Notification',
    message: 'This is a test notification!'
  })
});
```

You should see a browser notification pop up!

#### Test 4: Calendar Integration

1. Go to Settings > Calendar
2. Click "Connect Google Calendar"
3. OAuth popup should open
4. Sign in and grant permissions
5. Popup should close and show "Connected" status
6. Verify in Supabase > Table Editor > `calendar_integrations`

#### Test 5: Schedule Sync

1. Create a schedule item in your app
2. Add a "Sync to Calendar" button
3. Click it - event should appear in your Google Calendar

---

### 🐛 Troubleshooting

#### Push Notifications Not Working

**Check Browser Support:**
```javascript
if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
  console.log('✅ Push notifications supported');
} else {
  console.log('❌ Push notifications NOT supported');
}
```

**Check Permission:**
```javascript
console.log('Notification permission:', Notification.permission);
// Should be: "granted"
```

**Check Service Worker:**
- DevTools > Application > Service Workers
- Must be "activated" status
- Check for errors in console

#### Calendar OAuth Failing

**Redirect URI Mismatch:**
- Ensure redirect URI in Google/Microsoft exactly matches Edge Function URL
- Format: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/calendar-callback`

**CORS Errors:**
- Ensure your domain is in "Authorized JavaScript origins"
- Add both `http://localhost:5173` and production domain

#### Edge Functions Errors

**Check Logs:**
```bash
# If CLI works later:
supabase functions logs send-notification
```

Or in Dashboard:
- Edge Functions > Select function > Logs tab

**Common Issues:**
- Missing environment variables (check Supabase secrets)
- Invalid OAuth credentials
- Network/CORS issues

---

### 📝 Quick Start Checklist

- [ ] Run database migration in Supabase Dashboard SQL Editor
- [ ] Generate VAPID keys
- [ ] Set up Google Calendar OAuth (get Client ID + Secret)
- [ ] Set up Microsoft OAuth (get Client ID + Secret)
- [ ] Add all environment variables to `.env`
- [ ] Add all secrets to Supabase Dashboard
- [ ] Deploy 3 Edge Functions
- [ ] Register Service Worker in `main.tsx`
- [ ] Add NotificationCenter to header
- [ ] Create Settings page
- [ ] Test push notifications
- [ ] Test calendar integration
- [ ] Test schedule sync

---

### 🚀 Production Deployment

Before deploying to production:

1. **Update Redirect URIs** in Google/Microsoft to include production domain
2. **Update JavaScript Origins** to include production domain
3. **Set production environment variables** in hosting platform
4. **Enable HTTPS** (required for Service Workers)
5. **Test on mobile devices** (different from desktop)
6. **Set up monitoring** for Edge Function errors
7. **Configure rate limiting** on Edge Functions

---

### 📞 Need Help?

- **Supabase Docs:** https://supabase.com/docs
- **Web Push Guide:** https://web.dev/push-notifications-overview/
- **Google Calendar API:** https://developers.google.com/calendar
- **Microsoft Graph:** https://learn.microsoft.com/en-us/graph/

---

**Total Setup Time:** ~45-60 minutes
**Difficulty:** Intermediate
**Prerequisites:** Supabase account, Google account, Microsoft account
