# Notification System Integration Plan

## Current State Analysis

### Existing System (Social Notifications)
- **Table**: `social_notifications`
- **Purpose**: Social media notifications (likes, comments, follows, mentions)
- **Hook**: `useSocialNotifications` 
- **Features**: 
  - Real-time updates via Supabase Realtime
  - Pagination
  - Mark as read
  - Toast notifications
- **Status**: ✅ Working

### New System (Created but not in types)
- **Tables**: 
  - `notifications` - General notifications
  - `notification_subscriptions` - Push subscriptions
  - `notification_preferences` - User settings
  - `calendar_integrations` - Calendar OAuth
  - `schedule_reminders` - Schedule reminders
- **Status**: ⚠️ Created in database, missing from TypeScript types

## Recommended Approach: Dual System

### Why Keep Both Systems?

1. **Separation of Concerns**
   - `social_notifications` → Social features only
   - `notifications` → App-wide system notifications

2. **No Breaking Changes**
   - Keep existing social notification code working
   - Add new notification system alongside

3. **Better Organization**
   - Social notifications stay in social module
   - System notifications handled centrally

## Implementation Plan

### Step 1: Regenerate Types ✅ PRIORITY
```bash
# This adds the new tables to your types file
npx supabase gen types typescript --project-id kegsrvnywshxyucgjxml > src/integrations/supabase/types.ts
```

### Step 2: Create Unified NotificationCenter Component

The NotificationCenter will show BOTH:
- Social notifications from `social_notifications`
- System notifications from `notifications`

```typescript
// src/components/notifications/UnifiedNotificationCenter.tsx
import { useSocialNotifications } from '@/components/social/hooks/useSocialNotifications';
import { useNotifications } from '@/hooks/useNotifications';

export function UnifiedNotificationCenter() {
  const { 
    notifications: socialNotifs, 
    unreadCount: socialUnread 
  } = useSocialNotifications();
  
  const { 
    notifications: systemNotifs, 
    unreadCount: systemUnread 
  } = useNotifications();

  const totalUnread = socialUnread + systemUnread;
  const allNotifications = mergeSortedNotifications(socialNotifs, systemNotifs);

  return (
    // Show unified list with tabs:
    // - All (both types)
    // - Social (likes, comments, follows)
    // - System (reminders, calendar, quizzes)
  );
}
```

### Step 3: Update Notification Creation Points

**For Schedule Reminders:**
```typescript
// When creating a schedule item
await supabase.from('schedule_items').insert(scheduleData);

// Create reminder in new system
await supabase.from('notifications').insert({
  user_id: userId,
  type: 'schedule_reminder',
  title: `${scheduleItem.title} in 30 minutes`,
  message: `Your ${scheduleItem.subject} class starts soon`,
  data: { schedule_id: scheduleItem.id }
});
```

**For Quizzes:**
```typescript
// Quiz due reminder
await supabase.from('notifications').insert({
  user_id: userId,
  type: 'quiz_due',
  title: `Quiz Due Soon`,
  message: `${quiz.title} is due in 1 hour`,
  data: { quiz_id: quiz.id }
});
```

**Social notifications stay unchanged:**
```typescript
// Existing code in useSocialComments.ts
await supabase.from('social_notifications').insert({
  user_id: postAuthorId,
  actor_id: currentUserId,
  type: 'comment',
  post_id: postId,
  title: 'New Comment',
  message: `${username} commented on your post`
});
```

### Step 4: Push Notification Integration

Send push notifications for BOTH types:

```typescript
// Edge function: send-notification/index.ts
// Modify to check both notification types

// For system notifications
const { data: systemNotif } = await supabase
  .from('notifications')
  .select('*')
  .eq('id', notificationId)
  .single();

// For social notifications  
const { data: socialNotif } = await supabase
  .from('social_notifications')
  .select('*')
  .eq('id', notificationId)
  .single();

// Send push for either type
if (systemNotif || socialNotif) {
  await sendPushNotification(/* ... */);
}
```

### Step 5: Calendar Integration

Link schedules to calendar events:

```typescript
// When syncing to calendar
const { data: integration } = await supabase
  .from('calendar_integrations')
  .select('*')
  .eq('user_id', userId)
  .eq('sync_enabled', true)
  .single();

if (integration) {
  await syncScheduleToCalendar(scheduleItem, integration);
}
```

## File Structure

```
src/
├── components/
│   ├── notifications/
│   │   ├── UnifiedNotificationCenter.tsx  ← NEW: Shows both types
│   │   ├── SystemNotificationItem.tsx     ← NEW: For system notifications
│   │   └── SocialNotificationItem.tsx     ← Reuse existing
│   └── social/
│       └── hooks/
│           └── useSocialNotifications.ts  ← Keep as is
├── hooks/
│   ├── useNotifications.ts                ← Already created
│   └── useCalendarIntegration.ts          ← Already created
└── services/
    ├── pushNotificationService.ts         ← Already created
    └── calendarIntegrationService.ts      ← Already created
```

## Migration Timeline

### Phase 1: Setup (Today)
- [ ] Regenerate types with new tables
- [ ] Verify migration was applied successfully
- [ ] Test push notification subscription

### Phase 2: Integration (Day 2-3)
- [ ] Create UnifiedNotificationCenter component
- [ ] Update schedule creation to use new notifications table
- [ ] Add calendar sync UI to schedule items
- [ ] Test end-to-end flow

### Phase 3: Enhancement (Day 4-5)
- [ ] Add push notifications for social events
- [ ] Implement quiet hours
- [ ] Add notification preferences UI
- [ ] Calendar OAuth integration

### Phase 4: Testing (Day 6-7)
- [ ] Test on mobile devices
- [ ] Test calendar sync (Google & Outlook)
- [ ] Test push notifications cross-browser
- [ ] Performance testing

## What NOT to Change

❌ **Don't touch these:**
- `social_notifications` table
- `useSocialNotifications` hook
- Social notification creation in comments/likes/follows
- Social notification UI components

✅ **Only add to these:**
- New `notifications` table for system events
- Push notification service for delivery
- Calendar integration for schedules

## Benefits of This Approach

1. **No Breaking Changes** - Social features keep working
2. **Gradual Migration** - Add new features incrementally
3. **Better UX** - Users see all notifications in one place
4. **Flexible** - Can easily add new notification types
5. **Scalable** - Each system handles its domain

## Next Immediate Steps

✅ **COMPLETED:**
1. Fixed TypeScript errors in service worker (sw.js)
2. Added notification settings tab to UserSettings component
3. Integrated notification preferences with database
4. Added UI for all notification types and quiet hours

**Next Steps:**

1. **Run this command to regenerate types:**
   ```bash
   npx supabase gen types typescript --project-id kegsrvnywshxyucgjxml > src/integrations/supabase/types.ts
   ```

2. **Test notification preferences:**
   - Navigate to Settings → Notifications tab
   - Toggle notification preferences
   - Save settings
   - Verify saved in database

3. **Register Service Worker:**
   Add to your main.tsx or App.tsx:
   ```typescript
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js')
       .then(reg => console.log('SW registered', reg))
       .catch(err => console.error('SW registration failed', err));
   }
   ```

4. **Test push notification subscription:**
   ```typescript
   import { pushNotificationService } from '@/services/pushNotificationService';
   await pushNotificationService.initialize();
   await pushNotificationService.subscribe(userId);
   ```

5. **Create UnifiedNotificationCenter** that merges both notification streams

---

**Ready to proceed?** The notification settings are now fully integrated into your existing UserSettings!
