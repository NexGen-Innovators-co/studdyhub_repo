# Notification Scheduler Setup Guide

## Overview

The StudyHub notification system works in two phases:

### Phase 1: Daily Generation (6 AM UTC)
**Engine**: `daily-notifications-engine`  
**Frequency**: Once daily at 6 AM UTC  
**Action**: Generates notifications for all users and calculates correct `scheduled_send_at` times based on:
- User's timezone (auto-detected from IP or manually set)
- User's preferred notification times
- User's engagement tier and activity  
- User's notification preferences

**Status**: ✅ Automatically scheduled via pg_cron

### Phase 2: Scheduled Delivery (Every 5 minutes)
**Engine**: `scheduled-notifications-dispatcher`  
**Frequency**: Every 5 minutes  
**Action**: Sends notifications that are due (`scheduled_send_at <= now()`)

**Status**: ⚠️ Requires manual setup (read below)

---

## Dispatcher Setup Instructions

Since Supabase's pg_cron doesn't have built-in HTTP POST capabilities on free tier, use one of these methods:

### Option 1: External Cron Service (Recommended for Production)

#### Using Render Cron Jobs
1. Go to [render.com](https://render.com)
2. Create a new Cron Job
3. **Name**: `studdyhub-notification-dispatcher`
4. **Schedule**: `*/5 * * * *` (every 5 minutes)
5. **Webhook URL**: 
   ```
   https://YOUR_SUPABASE_URL/functions/v1/scheduled-notifications-dispatcher
   ```
6. **HTTP Method**: POST
7. **Headers**:
   ```
   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
   Content-Type: application/json
   ```

#### Using Cron-job.org (Free)
1. Go to [cron-job.org](https://cron-job.org)
2. Create new cronjob
3. **URL**: `https://YOUR_SUPABASE_URL/functions/v1/scheduled-notifications-dispatcher`
4. **Schedule**: Every 5 minutes
5. **HTTP Method**: POST
6. **Headers**:
   ```
   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
   Content-Type: application/json
   ```

### Option 2: Supabase Edge Function with Internal Trigger
Deploy a wrapper function that calls the dispatcher:

```typescript
// supabase/functions/trigger-dispatcher/index.ts
import { serve } from 'https://deno.land/std@0.195.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Invoke dispatcher
  const response = await supabase.functions.invoke('scheduled-notifications-dispatcher', {
    body: { trigger: 'internal-cron' }
  });

  return new Response(JSON.stringify(response), { status: 200 });
});
```

Then set external cron to call `https://YOUR_SUPABASE_URL/functions/v1/trigger-dispatcher`

### Option 3: Vercel Serverless Functions (for Vercel deployments)
Create `api/cron/notification-dispatcher.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/scheduled-notifications-dispatcher`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  return res.status(response.status).json(await response.json());
}
```

Then configure Vercel Cron (in `vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/notification-dispatcher",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## Environment Variables Required

For any of the above options, you need:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Get these from**: Supabase Dashboard → Settings → API

---

## Testing the Dispatcher

### Manual Test
```bash
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/scheduled-notifications-dispatcher \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Expected Response
```json
{
  "success": true,
  "dispatched": 42,
  "failed": 0,
  "timestamp": "2026-03-13T14:30:00Z"
}
```

### Check Logs
In Supabase Dashboard:
- Go to **Functions**
- Click **scheduled-notifications-dispatcher**
- View **Logs** tab

---

## How It Works End-to-End

### Example Timeline (UTC timezone user, 2 PM local preferred time)

**6:00 AM UTC** - Daily Engine Runs
```
User: john@example.com (UTC timezone)
Detected Preference Time: 14:00 (2 PM)
Calculates: scheduled_send_at = 2026-03-14T14:00:00Z
Inserts to daily_notification_log
```

**User's Local Time: 2 PM (14:00 UTC)** - Dispatcher Checks
```
Query: SELECT * FROM daily_notification_log 
       WHERE scheduled_send_at <= now() AND actually_sent_at IS NULL
Result: John's notification is due
Action: Invoke send-notification function
Update: Set actually_sent_at = 2026-03-14T14:00:00Z
```

**Apple Watch / Browser** - Notification Delivered
```
Title: "📚 Daily Study Plan"
Body: "Good afternoon, John! What are your study goals today?"
Action URL: "/chat?context=daily-planning"
```

---

## Timezone Detection

When users access Notification Settings for the first time:

1. **If no saved preferences**: Auto-detect timezone from IP
   - Uses free `ip-api.com` service
   - Falls back to UTC if detection fails
   - User can manually override in dropdown

2. **If saved preferences exist**: Use saved timezone
   - User can change anytime in Settings

### Supported Timezones
Standard IANA timezone identifiers:
- `America/New_York`
- `Europe/London`
- `Asia/Tokyo`
- `Australia/Sydney`
- `UTC`
- etc.

---

## Troubleshooting

### Notifications Not Being Sent

1. **Check daily_notification_log**
   ```sql
   SELECT count(*), 
          sum(CASE WHEN actually_sent_at IS NOT NULL THEN 1 ELSE 0 END) as sent
   FROM daily_notification_log
   WHERE created_at > now() - interval '24 hours';
   ```

2. **Verify dispatcher is running**
   - Check Supabase Function logs
   - Manually invoke test above

3. **Check notification_preferences**
   ```sql
   SELECT push_notifications, user_timezone, max_notifications_per_day
   FROM notification_preferences
   WHERE push_notifications = true
   LIMIT 5;
   ```

4. **Check user_activity_tracking**
   ```sql
   SELECT engagement_tier, last_active
   FROM user_activity_tracking
   LIMIT 5;
   ```

### Users Getting Multiple Notifications

- Verify `actually_sent_at` is being updated
- Check dispatcher logs for duplicate invocations
- Reduce external cron frequency if > 5 minutes

### Wrong Timezone Being Used

- User can manually set in Notification Settings
- Or clear preferences and reload to re-detect from IP
- Check: `SELECT user_timezone FROM notification_preferences WHERE user_id = 'xxx'`

---

## Performance Optimization

**Daily Engine Processing**:
- Processes users in batches of 200
- Fetches 3 queries per batch (preferences, profiles, activity)
- Estimated time: ~5-10s for 1,000 users

**Dispatcher Processing**:
- Processes up to 100 notifications per run
- Runs every 5 minutes = ~1200 notifications/hour max
- At scale: Add queue (Bull, BullMQ) if needed

---

## Costs

**Typical Usage**:
- Daily engine: 1 invocation/day
- Dispatcher: 288 invocations/day (every 5 min)
- Supabase free tier: 500K function invocations/month ✅ (well within limits)

**External Cron Costs**:
- Render: Free tier available
- Cron-job.org: Free
- Vercel: Included with Pro plan (or free for hobby)

---

## Next Steps

1. Choose dispatcher setup method above
2. Deploy using your chosen method
3. Test with manual curl command
4. Monitor logs for 24 hours
5. Users will auto-detect timezone on first visit to Notifications tab

