// Developer Quick Reference - Verification & Status System

# Verification & Status System - Developer Quick Reference

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              UserProfile Component                      │
│    (Displays verified badge + online indicator)         │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────┐
│useUserVerification   │    │  VerifiedBadge.tsx      │
│Status Hook           │    │  Component              │
│ • Fetches status     │    │ • Shows badge           │
│ • Real-time updates  │    │ • Shows tooltip         │
│ • Caches metrics     │    │ • Shows online status   │
└──────────────────────┘    └──────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│          Social Users Table (Supabase)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Fields:                                            │  │
│  │ • is_verified (boolean) - achievement badge       │  │
│  │ • status (enum) - active/suspended/banned/...     │  │
│  │ • is_online (boolean) - real-time tracking        │  │
│  │ • last_login_at (timestamp)                       │  │
│  │ • last_logout_at (timestamp)                      │  │
│  │ • current_session_started_at (timestamp)          │  │
│  │ • verification_metrics (JSONB) - cached metrics   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│          Auth Events (useAuth.tsx)                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ON SIGNED_IN:    trackUserLogin(userId)           │  │
│  │ ON SIGNED_OUT:   trackUserLogout(userId)          │  │
│  │                                                    │  │
│  │ These update:                                      │  │
│  │ • is_online = true/false                          │  │
│  │ • last_login_at / last_logout_at                  │  │
│  │ • current_session_started_at                      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. User Verification System

**What is "verified"?**
- Not email verification (that's handled by Supabase Auth)
- Not a manual admin setting (that was the old system)
- **Achievement badge** based on 6 metrics:
  1. 50+ posts
  2. 500+ followers
  3. 2%+ engagement rate
  4. 30+ days old account
  5. Active in last 15 days
  6. Zero violations

**Achievement Badge Flow:**
```
Every Day at 2 AM (PostgreSQL cron job):
  ↓
update_creator_verification_status()
  ↓
For each user:
  ├─ check_creator_verification_eligibility()
  │  ├─ Count posts
  │  ├─ Count followers
  │  ├─ Calculate engagement rate
  │  ├─ Calculate account age
  │  ├─ Check last active date
  │  └─ Check violations count
  │
  ├─ IF all 6 criteria met:
  │  └─ Award "verified_creator" badge
  │
  └─ IF criteria no longer met:
     └─ Revoke "verified_creator" badge
```

### 2. Status System

**Four Status States:**
| Status | Meaning | Can Post? | Visible? |
|--------|---------|-----------|----------|
| `active` | Normal user | Yes | Yes |
| `suspended` | Temporarily restricted | No | Yes (to mods) |
| `banned` | Permanently blocked | No | No (hidden from feed) |
| `deactivated` | User-initiated | No | No |
| `inactive` | Auto-marked (180 days no login) | No | Yes |

**Who Changes Status:**
- Admins: suspend/ban users → `status = 'suspended'` or `'banned'`
- User self: deactivate account → `status = 'deactivated'`
- Auto job: no login 180 days → `status = 'inactive'`

### 3. Real-Time Online Status

**How is_online Works:**
```
User logs in:
  ↓
useAuth.tsx detects SIGNED_IN event
  ↓
trackUserLogin(userId) called
  ↓
Calls RPC: track_user_login()
  ↓
Database updates:
  • is_online = true
  • last_login_at = NOW()
  • current_session_started_at = NOW()
  ↓
Component re-renders with green dot ✓
```

**Auto-Logout Inactive:**
```
Every 5 minutes (PostgreSQL cron job):
  ↓
Check: NOW() - current_session_started_at > 30 minutes?
  ↓
YES → Set is_online = false, set last_logout_at = NOW()
```

---

## Using the Hooks

### useUserVerificationStatus Hook

**Purpose:** Get real-time verification status for a user

```typescript
import { useUserVerificationStatus } from '@/hooks/useUserVerificationStatus'

export const MyComponent = () => {
  const { verificationStatus, loading } = useUserVerificationStatus(userId)
  
  if (loading) return <div>Loading...</div>
  
  return (
    <div>
      {/* Is this user verified? */}
      {verificationStatus?.is_verified && (
        <span>✓ Verified Creator</span>
      )}
      
      {/* What is their status? */}
      <p>Status: {verificationStatus?.status}</p>
      
      {/* Are they online now? */}
      {verificationStatus?.is_online && (
        <span className="text-green-500">● Online</span>
      )}
      
      {/* Show metrics */}
      {verificationStatus?.verification_metrics && (
        <div>
          Posts: {verificationStatus.verification_metrics.posts}
          Followers: {verificationStatus.verification_metrics.followers}
          Engagement: {verificationStatus.verification_metrics.engagement_rate}%
        </div>
      )}
    </div>
  )
}
```

**Return Type:**
```typescript
interface UserVerificationStatus {
  is_verified: boolean | null             // Has achievement badge
  status: 'active' | 'suspended' | 'banned' | 'deactivated' | 'inactive'
  is_online: boolean                      // Actively logged in
  last_login_at: string | null            // ISO timestamp
  last_logout_at: string | null           // ISO timestamp
  verification_metrics: {
    posts: number                         // Total posts
    followers: number                     // Total followers
    engagement_rate: number               // Percentage (0-100)
    account_age_days: number              // Days since account created
    last_active_days: number              // Days since last active
    violations: number                    // Content violation count
    checked_at: string                    // When metrics were calculated
  } | null
}
```

---

## Using Components

### VerifiedBadge Component

**Shows:** Blue checkmark + optional green online dot + tooltip on hover

```typescript
import { VerifiedBadge } from '@/components/social/components/VerifiedBadge'
import { useUserVerificationStatus } from '@/hooks/useUserVerificationStatus'

export const UserCard = ({ userId }) => {
  const { verificationStatus } = useUserVerificationStatus(userId)
  
  return (
    <div>
      <h2>John Doe
        <VerifiedBadge 
          verificationStatus={verificationStatus}
          showOnlineIndicator={true}
          className="ml-2"
        />
      </h2>
    </div>
  )
}
```

**Props:**
```typescript
interface VerifiedBadgeProps {
  verificationStatus: UserVerificationStatus | null
  showOnlineIndicator?: boolean  // Show green dot (default: true)
  className?: string             // Additional CSS classes
}
```

**Tooltip shows on hover:**
- ✓ Verified Creator
- Last login time (e.g., "2 hours ago")
- Metrics (Posts, Followers, Engagement, Account Age)

### StatusBadge Component

**Shows:** Colored badge with status text

```typescript
import { StatusBadge } from '@/components/social/components/VerifiedBadge'

export const UserRow = ({ user }) => {
  return (
    <div>
      <h3>{user.username}</h3>
      <StatusBadge status={user.status} />
      {/* Shows: 🟢 Active, 🟡 Suspended, 🔴 Banned, 🟣 Deactivated */}
    </div>
  )
}
```

### OnlineIndicator Component

**Shows:** Animated green dot if online, gray if offline

```typescript
import { OnlineIndicator } from '@/components/social/components/VerifiedBadge'

export const UserAvatar = ({ user }) => {
  return (
    <div className="relative">
      <Avatar />
      <OnlineIndicator 
        isOnline={user.is_online}
        lastLoginAt={user.last_login_at}
        size="md"  // 'sm' | 'md' | 'lg'
      />
    </div>
  )
}
```

---

## Backend Integration (Session Tracker)

### trackUserLogin()

**Called automatically on SIGNED_IN event**

```typescript
import { trackUserLogin } from '@/utils/authSessionTracker'

// Triggered in useAuth.tsx - you don't need to call this manually
await trackUserLogin(userId)

// Updates database:
// • is_online = true
// • last_login_at = NOW()
// • current_session_started_at = NOW()
```

### trackUserLogout()

**Called automatically on SIGNED_OUT event**

```typescript
import { trackUserLogout } from '@/utils/authSessionTracker'

// Triggered in useAuth.tsx - you don't need to call this manually
await trackUserLogout(userId)

// Updates database:
// • is_online = false
// • last_logout_at = NOW()
```

### getUserStatus()

**Get current status of a user**

```typescript
import { getUserStatus } from '@/utils/authSessionTracker'

const status = await getUserStatus(userId)
console.log(status)
// Output:
// {
//   is_online: true,
//   status: 'active',
//   last_login_at: '2025-03-17T10:30:00Z',
//   last_logout_at: null,
//   is_verified: true
// }
```

### subscribeToUserStatus()

**Real-time updates when user logs in/out**

```typescript
import { subscribeToUserStatus } from '@/utils/authSessionTracker'

const unsubscribe = subscribeToUserStatus(userId, (status) => {
  console.log('User status changed:', status)
  // Update UI in real-time
  setIsOnline(status.is_online)
})

// Cleanup when component unmounts
useEffect(() => {
  return () => unsubscribe()
}, [])
```

### getOnlineUsersCount()

**Get count of currently online users**

```typescript
import { getOnlineUsersCount } from '@/utils/authSessionTracker'

const onlineCount = await getOnlineUsersCount()
console.log(`${onlineCount} users online`)
```

### getDailyActiveUsersCount()

**Get DAU (Daily Active Users)**

```typescript
import { getDailyActiveUsersCount } from '@/utils/authSessionTracker'

const dau = await getDailyActiveUsersCount()
console.log(`${dau} users active today`)
```

---

## Common Patterns

### Pattern 1: Display User with Badge

```typescript
const UserPreview = ({ userId }) => {
  const { verificationStatus } = useUserVerificationStatus(userId)
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    supabase
      .from('social_users')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => setUser(data))
  }, [userId])
  
  return (
    <div className="flex items-center gap-3">
      <Avatar src={user?.avatar_url} />
      <div>
        <h3 className="flex items-center gap-2">
          {user?.display_name}
          <VerifiedBadge verificationStatus={verificationStatus} />
        </h3>
        <p className="text-sm text-gray-500">@{user?.username}</p>
      </div>
    </div>
  )
}
```

### Pattern 2: Show Last Login in Profile

```typescript
const ProfileHeader = ({ user }) => {
  const { verificationStatus } = useUserVerificationStatus(user.id)
  
  return (
    <div>
      <h1 className="flex items-center gap-2">
        {user.display_name}
        <VerifiedBadge verificationStatus={verificationStatus} />
      </h1>
      
      <p className="text-sm text-gray-500">
        {verificationStatus?.is_online 
          ? '🟢 Online now'
          : `Last seen ${getLastLoginText(verificationStatus?.last_login_at)}`
        }
      </p>
    </div>
  )
}
```

### Pattern 3: Admin Dashboard Real-Time

```typescript
export const AdminDashboard = () => {
  const [metrics, setMetrics] = useState<any[]>([])
  
  useEffect(() => {
    // Initial fetch
    const fetch = async () => {
      const { data } = await supabase
        .from('social_users')
        .select('id, is_verified, is_online, status, last_login_at')
      setMetrics(data)
    }
    fetch()
    
    // Real-time subscription
    const sub = supabase
      .channel('admin_metrics')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'social_users' },
        (payload) => {
          // Update metrics when user logs in/out
          console.log('User status changed:', payload)
          fetch()
        }
      )
      .subscribe()
    
    return () => sub.unsubscribe()
  }, [])
  
  return (
    <div>
      <VerificationMetricsPanel />
    </div>
  )
}
```

---

## Database Queries

### Query 1: Find all verified users

```sql
SELECT id, username, display_name, is_verified, status
FROM social_users
WHERE is_verified = true AND status = 'active'
ORDER BY followers_count DESC
```

### Query 2: Find currently online users

```sql
SELECT id, username, is_online, last_login_at
FROM social_users
WHERE is_online = true
ORDER BY last_login_at DESC
```

### Query 3: Check verification metrics for a user

```sql
SELECT 
  id, username,
  verification_metrics ->> 'posts' as posts,
  verification_metrics ->> 'followers' as followers,
  verification_metrics ->> 'engagement_rate' as engagement,
  verification_metrics ->> 'checked_at' as checked_at
FROM social_users
WHERE id = 'user-uuid'
```

### Query 4: Users who haven't logged in for 30+ days

```sql
SELECT id, username, last_login_at, status
FROM social_users
WHERE last_login_at < NOW() - INTERVAL '30 days'
  AND status = 'active'
```

---

## Testing Checklist

```
[ ] Login tracking works
    - [ ] is_online = true after login
    - [ ] last_login_at updates correctly
    - [ ] No console errors

[ ] Logout tracking works
    - [ ] is_online = false after logout
    - [ ] last_logout_at updates correctly

[ ] Verification badge displays
    - [ ] Shows for verified users
    - [ ] Hidden for unverified users
    - [ ] Tooltip shows on hover

[ ] Status badge displays
    - [ ] Shows correct color for each status
    - [ ] Active = green, Suspended = yellow, etc.

[ ] Online indicator
    - [ ] Green when online
    - [ ] Gray when offline
    - [ ] Tooltip shows last login time

[ ] Admin metrics panel
    - [ ] Shows online user count
    - [ ] Shows verified user count
    - [ ] Shows all metrics with pass/fail indicators

[ ] Real-time updates
    - [ ] Metrics update without page refresh
    - [ ] Online status updates in 1-2 seconds
```

---

## Troubleshooting

### Badge not showing for user who should be verified

**Check 1:** Did cron job run?
```sql
SELECT last_successful_run FROM cron.job 
WHERE jobname = 'update_creator_verification_daily'
```

**Check 2:** Do they meet all 6 criteria?
```sql
SELECT check_creator_verification_eligibility('user-uuid'::UUID)
```

**Check 3:** Did badge get awarded?
```sql
SELECT * FROM achievements 
WHERE user_id = 'user-uuid' 
  AND badge_id = (SELECT id FROM badges WHERE name = 'verified_creator')
```

### Login/logout not tracking

**Check 1:** Is useAuth hook calling the functions?
```typescript
// Should see these in useAuth.tsx:
console.log('[useAuth] Tracking login...')
console.log('[useAuth] Tracking logout...')
```

**Check 2:** Check RPC function exists
```sql
SELECT * FROM information_schema.routines 
WHERE routine_name LIKE 'track_user_%'
```

### Performance issues

**Check:** Are indices being used?
```sql
SELECT * FROM pg_stat_user_indices 
WHERE schemaname = 'public' 
  AND tablename = 'social_users'
  AND idx_scan > 0
ORDER BY idx_scan DESC
```

If `idx_scan = 0`, indices aren't being used. Try:
```sql
REINDEX TABLE social_users
```

---

## FAQ

**Q: What's the difference between `is_verified` and badge?**
A: `is_verified` boolean IS the badge. When user meets criteria, they get the "verified_creator" badge, and `is_verified` is set to true.

**Q: How often are metrics updated?**
A: Daily at 2 AM UTC. Checks happen once per day.

**Q: Can users see other users' last login time?**
A: By default, no. Only admins and the user themselves can see it. You can change this in queries if needed.

**Q: What happens if user hasn't logged in for 6 months?**
A: After 180 days without login, they're auto-marked `status = 'inactive'`. Their posts still visible but account flagged as inactive.

**Q: Is the online status real-time?**
A: Yes! Uses Supabase Realtime, updates within 1-2 seconds. Auto-logout happens every 5 minutes.

---

## Resources

- [useUserVerificationStatus Hook](src/hooks/useUserVerificationStatus.ts)
- [VerifiedBadge Component](src/components/social/components/VerifiedBadge.tsx)
- [Session Tracker Utility](src/utils/authSessionTracker.ts)
- [Database Migration](supabase/migrations/20260317_user_verification_and_realtime_status.sql)
- [Auth Integration](src/hooks/useAuth.tsx)
- [Admin Metrics Panel](src/components/admin/VerificationMetricsPanel.tsx)
