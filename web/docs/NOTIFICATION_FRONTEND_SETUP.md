# Push Notifications & Calendar Integration - Frontend Setup Complete! 🎉

## ✅ What's Been Implemented

### 1. **Service Worker Registration** (`src/main.tsx`)
- Automatically registers `/sw.js` on app load
- Logs success/failure to console
- Enables background push notifications

### 2. **Notification Center UI** (`src/components/layout/Header.tsx`)
- **NotificationCenter** component added to header
- Bell icon with unread count badge
- Dropdown with notification list
- Mark as read/delete actions
- Links to notification settings

### 3. **Automatic Initialization** (`src/pages/Index.tsx`)
- Auto-subscribes users who already granted permission
- Respects user preferences from `notification_preferences` table
- Initializes 1 second after login (allows service worker to register)

### 4. **Notification Init Service** (`src/services/notificationInitService.ts`)
- `initializePushNotifications()` - Auto-subscribe if permission granted
- `requestNotificationPermission()` - Request permission explicitly
- `isPushNotificationsSupported()` - Feature detection
- `getNotificationPermissionStatus()` - Check current status

### 5. **Environment Variables** (`.env.example`)
- Template for all required variables
- VAPID keys documentation
- Google/Microsoft OAuth config

---

## 🚀 Next Steps to Make It Work

### Step 1: Generate VAPID Keys

```powershell
# Install web-push globally
npm install -g web-push

# Generate VAPID keys
npx web-push generate-vapid-keys
```

**Output:**
```
=======================================
Public Key:
BN... (your public key)

Private Key:
abc... (your private key)
=======================================
```

### Step 2: Add Keys to `.env.local`

Create/update `.env.local` in project root:

```env
# Existing Supabase config
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Add VAPID keys
VITE_VAPID_PUBLIC_KEY=BN... (paste public key)
VAPID_PRIVATE_KEY=abc... (paste private key)
VAPID_SUBJECT=mailto:your-email@example.com

# Other optional configs
VITE_GOOGLE_CLIENT_ID=your_google_oauth_id
```

### Step 3: Deploy Edge Functions

```powershell
# Make sure you're logged in to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy notification functions
supabase functions deploy send-notification
supabase functions deploy calendar-callback  
supabase functions deploy refresh-calendar-token

# Deploy updated gemini-chat (with new diagram instructions)
supabase functions deploy gemini-chat
```

### Step 4: Set Edge Function Secrets

```powershell
# Set VAPID private key for send-notification function
supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com

# Set calendar API secrets (optional)
supabase secrets set GOOGLE_CALENDAR_CLIENT_SECRET=your_secret
supabase secrets set MICROSOFT_CLIENT_SECRET=your_secret
```

### Step 5: Test the System

1. **Start dev server:**
   ```powershell
   npm run dev
   ```

2. **Login to app** → Opens dashboard

3. **Check console for:**
   ```
   ✅ Service Worker registered: http://localhost:5173/
   ℹ️ Notification permission not yet requested
   ```

4. **Go to Settings → Notifications tab:**
   - Enable "Push Notifications"
   - Browser will ask for permission
   - Click "Allow"
   - Should see success message

5. **Check console again:**
   ```
   ✅ Notification permission already granted, subscribing...
   ✅ Successfully subscribed to push notifications
   ```

6. **Test push notification manually:**
   - Go to Supabase Dashboard → Edge Functions
   - Find `send-notification` function
   - Test with payload:
   ```json
   {
     "user_id": "your-user-id",
     "notification": {
       "type": "general",
       "title": "Test Notification",
       "message": "This is a test from Supabase!",
       "action_url": "/dashboard"
     }
   }
   ```

---

## 🔔 How to Trigger Notifications

### Option 1: Database Trigger (Automatic)

Example: Send notification when quiz is created:

```sql
CREATE OR REPLACE FUNCTION notify_quiz_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification record
  INSERT INTO notifications (user_id, type, title, message, action_url, priority)
  VALUES (
    NEW.user_id,
    'quiz_due',
    'New Quiz Available',
    'Quiz "' || NEW.title || '" has been created',
    '/quizzes?quiz=' || NEW.id,
    'high'
  );

  -- Trigger push notification via edge function
  PERFORM http_post(
    'https://your-project.supabase.co/functions/v1/send-notification',
    json_build_object(
      'user_id', NEW.user_id,
      'notification', json_build_object(
        'type', 'quiz_due',
        'title', 'New Quiz Available',
        'message', 'Quiz "' || NEW.title || '" is ready',
        'action_url', '/quizzes?quiz=' || NEW.id
      )
    )::text,
    'application/json'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_quiz_created
AFTER INSERT ON quizzes
FOR EACH ROW
EXECUTE FUNCTION notify_quiz_created();
```

### Option 2: From Frontend (Manual)

```typescript
import { supabase } from '@/integrations/supabase/client';

async function sendNotificationToUser(userId: string) {
  // Create notification record
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'assignment_due',
      title: 'Assignment Due Tomorrow',
      message: 'Your essay assignment is due tomorrow at 11:59 PM',
      action_url: '/schedule',
      priority: 'high'
    });

  // Trigger push notification
  await supabase.functions.invoke('send-notification', {
    body: {
      user_id: userId,
      notification: {
        type: 'assignment_due',
        title: 'Assignment Due Tomorrow',
        message: 'Your essay assignment is due tomorrow',
        action_url: '/schedule'
      }
    }
  });
}
```

### Option 3: From Edge Function

```typescript
// In any Supabase edge function
const { data, error } = await supabaseAdmin
  .from('notifications')
  .insert({
    user_id: userId,
    type: 'ai_limit_warning',
    title: 'AI Credits Low',
    message: 'You have 10% of your AI credits remaining',
    action_url: '/subscription',
    priority: 'medium'
  });

// Send push
await fetch('https://your-project.supabase.co/functions/v1/send-notification', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
  },
  body: JSON.stringify({
    user_id: userId,
    notification: { /* ... */ }
  })
});
```

---

## 📅 Calendar Integration Setup

### Google Calendar

1. **Go to** [Google Cloud Console](https://console.cloud.google.com/)

2. **Create OAuth Credentials:**
   - APIs & Services → Credentials
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     https://your-project.supabase.co/functions/v1/calendar-callback
     http://localhost:54321/functions/v1/calendar-callback
     ```

3. **Enable Google Calendar API:**
   - APIs & Services → Library
   - Search "Google Calendar API"
   - Click Enable

4. **Add credentials to `.env.local`:**
   ```env
   VITE_GOOGLE_CALENDAR_CLIENT_ID=your_client_id.apps.googleusercontent.com
   VITE_GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret
   ```

### Microsoft Outlook

1. **Go to** [Azure Portal](https://portal.azure.com/)

2. **App Registrations → New registration**

3. **Add redirect URI:**
   ```
   https://your-project.supabase.co/functions/v1/calendar-callback
   ```

4. **API Permissions:**
   - Add permission → Microsoft Graph
   - Calendars.ReadWrite

5. **Add credentials to `.env.local`:**
   ```env
   VITE_MICROSOFT_CLIENT_ID=your_app_id
   VITE_MICROSOFT_CLIENT_SECRET=your_secret
   ```

---

## 🧪 Testing Checklist

- [ ] Service Worker registers successfully
- [ ] NotificationCenter appears in header
- [ ] Bell icon shows unread count
- [ ] Can open notification dropdown
- [ ] Can mark notifications as read
- [ ] Can delete notifications
- [ ] Settings tab loads notification preferences
- [ ] Can toggle push notifications on/off
- [ ] Browser requests permission when enabled
- [ ] Subscription saved to `notification_subscriptions` table
- [ ] Can receive test push notification
- [ ] Clicking notification opens correct page
- [ ] Quiet hours respected (if enabled)
- [ ] Calendar integration button appears (optional)
- [ ] Can connect Google/Outlook calendar (optional)

---

## 🐛 Troubleshooting

### Service Worker Not Registering

**Check:** `public/sw.js` exists and has no syntax errors

```powershell
# Verify file exists
ls public/sw.js

# Check for errors in console
# Open DevTools → Console
```

**Fix:** File should have `@ts-nocheck` comment and plain JavaScript (no TypeScript)

### VAPID Key Errors

**Error:** `Bad 'vapidDetails' object`

**Fix:** Ensure keys in `.env.local` match exactly from `npx web-push generate-vapid-keys`

### Permission Denied

**Check:** Browser notification settings

- **Chrome:** Settings → Privacy → Site Settings → Notifications
- **Firefox:** Settings → Privacy & Security → Permissions → Notifications
- **Edge:** Settings → Cookies and site permissions → Notifications

**Fix:** Remove site from block list, refresh page, re-enable in app

### Edge Function Fails

**Check logs:**
```powershell
supabase functions logs send-notification --follow
```

**Common issues:**
- Missing VAPID_PRIVATE_KEY secret
- Invalid subscription endpoint
- User has no active subscriptions

### No Notifications Received

**Check:**
1. User has `push_notifications = true` in `notification_preferences`
2. Active subscription exists in `notification_subscriptions`
3. Browser is not in "Do Not Disturb" mode
4. Service Worker is active (DevTools → Application → Service Workers)

---

## 📊 Database Tables Reference

### `notifications`
Stores all notification records (both delivered and pending)

### `notification_subscriptions`
Browser push subscription endpoints (one per device/browser)

### `notification_preferences`
User settings for what notifications to receive

### `calendar_integrations`
OAuth tokens for Google/Outlook calendar sync

### `schedule_reminders`
Queue of scheduled notifications to be sent

---

## 🎯 What Works Now

✅ **Service Worker** registered and active  
✅ **NotificationCenter** UI in header with badge  
✅ **Auto-subscription** after permission granted  
✅ **User preferences** fully integrated in Settings  
✅ **Push notifications** ready to send  
✅ **Calendar integration** backend complete  
✅ **Diagram system** supports 9 types with AI instructions  

## ⏳ What Needs Deployment

⏳ Set VAPID keys in environment  
⏳ Deploy edge functions to Supabase  
⏳ Configure Google/Microsoft OAuth (optional)  
⏳ Test end-to-end notification flow  
⏳ Create database triggers for automatic notifications  

---

**You're all set! The frontend is fully wired up and ready to go.** 🚀

Just add your VAPID keys, deploy the functions, and you'll have WhatsApp-style push notifications! 📱🔔
