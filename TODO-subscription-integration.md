# **COMPLETE SUBSCRIPTION INTEGRATION GUIDE**

## 📋 **PHASE 1: SETUP & INFRASTRUCTURE (2-4 hours)**

### ✅ **Step 1.1: Update Type Definitions**
```typescript
// Update types/Subscription.ts
export interface SubscriptionLimits {
  maxNotes: number;
  maxDocUploads: number;
  maxDocSize: number;
  maxAiMessages: number;
  canPostSocials: boolean;
  hasExamMode: boolean;
  hasVerifiedBadge: boolean;
  canGenerateQuizzes: boolean;
  canAccessSocial: boolean;
  maxRecordings: number;
  maxFolders: number;
  maxScheduleItems: number;
  [key: string]: number | boolean; // Allow dynamic keys
}

export type PlanType = 'free' | 'scholar' | 'genius';

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanType;
  status: 'active' | 'canceled' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}
```

### ✅ **Step 1.2: Update AppContext Interface**
```typescript
// In contexts/AppContext.tsx, ensure these are in AppContextType:
- subscription: Subscription | null;
- subscriptionLoading: boolean;
- subscriptionTier: PlanType;
- subscriptionLimits: SubscriptionLimits;
- checkSubscriptionAccess: (feature: keyof SubscriptionLimits) => boolean;
- refreshSubscription: () => Promise<void>;
- daysRemaining: number;
- bonusAiCredits: number;
```

### ✅ **Step 1.3: Create Subscription Components Directory**
```
src/components/subscription/
├── SubscriptionGuard.tsx      # Main guard component
├── UsageIndicator.tsx         # Usage display component
├── SubscriptionStatusBar.tsx  # Top bar for free users
├── SubscriptionLimitsModal.tsx # Limits comparison modal
└── index.ts                   # Export all components
```

### ✅ **Step 1.4: Update Progress Component (if using shadcn/ui)**
```typescript
// Update components/ui/progress.tsx to support indicatorClassName
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
```

## 🛠️ **PHASE 2: CORE HOOKS & UTILITIES (3-5 hours)**

### ✅ **Step 2.1: Update useFeatureAccess Hook**
```typescript
// hooks/useFeatureAccess.tsx - Update to fix TypeScript errors
export type FeatureName = 
  | 'maxNotes'
  | 'maxDocUploads'
  | 'maxAiMessages'
  | 'canPostSocials'
  | 'hasExamMode'
  | 'hasVerifiedBadge'
  | 'canGenerateQuizzes'
  | 'canAccessSocial'
  | 'maxRecordings'
  | 'maxFolders'
  | 'maxScheduleItems';

export const useFeatureAccess = () => {
  const { subscriptionLimits, checkSubscriptionAccess, subscriptionTier } = useAppContext();
  
  // Fix type-safe access
  const getLimit = (feature: FeatureName): number => {
    const value = subscriptionLimits[feature];
    return typeof value === 'number' ? value : 0;
  };
  
  // Rest of implementation...
};
```

### ✅ **Step 2.2: Create Subscription Check Utilities**
```typescript
// utils/subscriptionChecks.ts
export const checkSubscriptionAccess = (
  userTier: PlanType,
  subscriptionLimits: SubscriptionLimits,
  feature: keyof SubscriptionLimits,
  currentCount?: number
): boolean => {
  // Implementation...
};
```

### ✅ **Step 2.3: Update useSubscription Hook**
```typescript
// hooks/useSubscription.ts - Ensure proper subscription loading
const useSubscription = () => {
  // Ensure subscription data is loaded and cached
  // Add refresh functionality
  // Add error handling
};
```

## 🎨 **PHASE 3: CREATE SUBSCRIPTION COMPONENTS (4-6 hours)**

### ✅ **Step 3.1: Create SubscriptionGuard Component**
```typescript
// components/subscription/SubscriptionGuard.tsx
const SubscriptionGuard = ({ 
  children, 
  feature, 
  requiredTier,
  currentCount,
  limitFeature 
}) => {
  // Implementation...
};
```

### ✅ **Step 3.2: Create UsageIndicator Component**
```typescript
// components/subscription/UsageIndicator.tsx
const UsageIndicator = ({ 
  feature, 
  currentCount,
  compact = false 
}) => {
  // Shows progress bar and usage info
};
```

### ✅ **Step 3.3: Create SubscriptionStatusBar Component**
```typescript
// components/subscription/SubscriptionStatusBar.tsx
const SubscriptionStatusBar = () => {
  // Top bar for free users showing all limits
  // Only shows when user is on free plan
};
```

### ✅ **Step 3.4: Create SubscriptionLimitsModal Component**
```typescript
// components/subscription/SubscriptionLimitsModal.tsx
const SubscriptionLimitsModal = () => {
  // Modal showing plan comparison
  // Triggered from settings or upgrade prompts
};
```

### ✅ **Step 3.5: Create Export File**
```typescript
// components/subscription/index.ts
export { SubscriptionGuard } from './SubscriptionGuard';
export { UsageIndicator } from './UsageIndicator';
export { SubscriptionStatusBar } from './SubscriptionStatusBar';
export { SubscriptionLimitsModal } from './SubscriptionLimitsModal';
```

## 📱 **PHASE 4: INTEGRATE INTO MAJOR FEATURES (6-8 hours)**

### ✅ **Step 4.1: Notes Component Integration**
```typescript
// components/notes/NoteEditor.tsx
import { SubscriptionGuard, UsageIndicator } from '@/components/subscription';

// 1. Add usage indicator to header
<UsageIndicator feature="maxNotes" currentCount={notes.length} compact />

// 2. Wrap create button with SubscriptionGuard
<SubscriptionGuard 
  feature="Create Note"
  requiredTier="free"
  currentCount={notes.length}
  limitFeature="maxNotes"
>
  <Button onClick={createNewNote}>Create New Note</Button>
</SubscriptionGuard>
```

### ✅ **Step 4.2: Documents Component Integration**
```typescript
// components/documents/DocumentUpload.tsx
// 1. Add usage indicator
<UsageIndicator feature="maxDocUploads" currentCount={documents.length} compact />

// 2. Check file size limit
const maxSizeMB = subscriptionLimits.maxDocSize;
if (file.size / (1024 * 1024) > maxSizeMB) {
  toast.error(`File too large. Max: ${maxSizeMB}MB`);
  return;
}

// 3. Wrap upload area with SubscriptionGuard
<SubscriptionGuard 
  feature="Upload Document"
  requiredTier="free"
  currentCount={documents.length}
  limitFeature="maxDocUploads"
>
  <FileUploadArea />
</SubscriptionGuard>
```

### ✅ **Step 4.3: AI Chat Integration**
```typescript
// components/aiChat/AiChat.tsx
import { useAiMessageTracker } from '@/hooks/useAiMessageTracker';
import { SubscriptionGuard, UsageIndicator } from '@/components/subscription';

// 1. Add daily message counter
const { messagesToday, canSendMessage, checkAiMessageLimit } = useAiMessageTracker();

// 2. Add usage indicator
<UsageIndicator feature="maxAiMessages" currentCount={messagesToday} />

// 3. Check before sending message
const handleSendMessage = () => {
  if (!checkAiMessageLimit()) return;
  // Send message...
};

// 4. Wrap chat input with SubscriptionGuard
<SubscriptionGuard
  feature="AI Chat"
  requiredTier="free"
  currentCount={messagesToday}
  limitFeature="maxAiMessages"
>
  <MessageInput />
</SubscriptionGuard>
```

### ✅ **Step 4.4: Social Features Integration**
```typescript
// components/social/SocialFeed.tsx
// 1. Check if user can access social
const { canAccessSocial, canPostSocial } = useFeatureAccess();

if (!canAccessSocial()) {
  return <UpgradePrompt feature="Social Features" requiredTier="scholar" />;
}

// 2. Guard post creation
<SubscriptionGuard feature="Create Post" requiredTier="scholar">
  <CreatePostButton />
</SubscriptionGuard>
```

### ✅ **Step 4.5: Quizzes Integration**
```typescript
// components/quizzes/Quizzes.tsx
// 1. Check quiz generation access
const { canGenerateQuizzes } = useFeatureAccess();

const handleGenerateQuiz = () => {
  if (!canGenerateQuizzes()) {
    toast.error('Quiz generation requires Scholar plan');
    return;
  }
  // Generate quiz...
};

// 2. Add badge showing plan
<Badge>{subscriptionTier === 'genius' ? 'Unlimited' : `${subscriptionTier} Plan`}</Badge>
```

### ✅ **Step 4.6: Class Recordings Integration**
```typescript
// components/classRecordings/ClassRecordings.tsx
// 1. Add recording limit check
const { maxRecordings } = useFeatureAccess();

if (recordings.length >= maxRecordings) {
  toast.error(`Recording limit reached (${maxRecordings})`);
  return;
}

// 2. Add usage indicator
<UsageIndicator feature="maxRecordings" currentCount={recordings.length} />
```

### ✅ **Step 4.7: Schedule Integration**
```typescript
// components/schedules/Schedule.tsx
// 1. Check schedule item limit
const { maxScheduleItems } = useFeatureAccess();

if (scheduleItems.length >= maxScheduleItems) {
  toast.error(`Schedule limit reached (${maxScheduleItems})`);
  return;
}

// 2. Add usage indicator
<UsageIndicator feature="maxScheduleItems" currentCount={scheduleItems.length} />
```

### ✅ **Step 4.8: Folders Integration**
```typescript
// components/documents/FolderTree.tsx
// 1. Check folder limit
const { maxFolders } = useFeatureAccess();

if (folders.length >= maxFolders) {
  toast.error(`Folder limit reached (${maxFolders})`);
  return;
}

// 2. Add usage indicator
<UsageIndicator feature="maxFolders" currentCount={folders.length} />
```

## 🏗️ **PHASE 5: LAYOUT & NAVIGATION INTEGRATION (2-3 hours)**

### ✅ **Step 5.1: Update Sidebar/Header**
```typescript
// components/layout/Sidebar.tsx or Header.tsx
import { SubscriptionStatusBar, SubscriptionLimitsModal } from '@/components/subscription';

// 1. Add subscription info section
<div className="mt-auto border-t pt-4">
  <div className="px-4 py-3 bg-gray-900 rounded-lg">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium capitalize">{subscriptionTier} Plan</span>
      <Badge>{subscriptionTier}</Badge>
    </div>
    {!isFree && daysRemaining && (
      <div className="text-xs text-gray-400 mt-1">
        {daysRemaining} days remaining
      </div>
    )}
    {isFree && (
      <Button size="sm" className="w-full mt-2" onClick={() => navigate('/subscription')}>
        Upgrade
      </Button>
    )}
  </div>
</div>

// 2. Add "View Limits" button
<SubscriptionLimitsModal />
```

### ✅ **Step 5.2: Update AppShell Layout**
```typescript
// components/layout/AppShell.tsx
import { SubscriptionStatusBar } from '@/components/subscription';

const AppShell = ({ children }) => {
  const { isFree } = useFeatureAccess();
  
  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      {isFree && <SubscriptionStatusBar />}
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};
```

### ✅ **Step 5.3: Update Main App Component**
```typescript
// App.tsx or Index.tsx
// Ensure SubscriptionStatusBar is rendered conditionally
{user && <SubscriptionStatusBar />}
```

## 🔧 **PHASE 6: UPDATE OPERATIONS HOOKS (3-4 hours)**

### ✅ **Step 6.1: Update useAppOperations**
```typescript
// hooks/useAppOperations.tsx
// Update each operation to check subscription limits:

const createNewNote = useCallback(async () => {
  // Check note limit
  if (!checkSubscriptionAccess('maxNotes')) {
    if (notes.length >= subscriptionLimits.maxNotes) {
      toast.error(`Note limit reached (${subscriptionLimits.maxNotes})`);
      return;
    }
  }
  // Rest of function...
}, [notes.length, subscriptionLimits.maxNotes]);

// Repeat for:
// - handleDocumentUploaded (check maxDocUploads and maxDocSize)
// - createFolder (check maxFolders)
// - addScheduleItem (check maxScheduleItems)
// - etc.
```

### ✅ **Step 6.2: Update useMessageHandlers**
```typescript
// hooks/useMessageHandlers.tsx
const handleSubmitMessage = useCallback(async () => {
  // Check AI message limit
  const { canSendMessage, checkAiMessageLimit } = useAiMessageTracker();
  if (!checkAiMessageLimit()) {
    return;
  }
  // Rest of function...
}, []);
```

## 🎯 **PHASE 7: USER EXPERIENCE ENHANCEMENTS (3-4 hours)**

### ✅ **Step 7.1: Add Upgrade Prompts**
```typescript
// Create utils/upgradePrompts.ts
export const showUpgradePrompt = (feature: string, requiredTier: PlanType) => {
  toast.error(`${feature} requires ${requiredTier} plan.`, {
    action: {
      label: 'Upgrade',
      onClick: () => navigate('/subscription')
    },
    duration: 5000
  });
};

// Use in components:
if (!canCreateNotes()) {
  showUpgradePrompt('Create Notes', 'free');
}
```

### ✅ **Step 7.2: Add Limit Warnings**
```typescript
// Show warning when user reaches 80% of limit
const showLimitWarning = (feature: string, current: number, limit: number) => {
  const percentage = (current / limit) * 100;
  if (percentage > 80 && percentage < 100) {
    toast.warning(`${feature} limit almost reached: ${current}/${limit}`);
  }
};
```

### ✅ **Step 7.3: Add Empty States with Upgrade CTAs**
```typescript
// When user has no data due to limits
const EmptyStateWithUpgrade = ({ feature, limit }) => (
  <div className="text-center p-8">
    <Lock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
    <h3 className="text-lg font-semibold mb-2">{feature} Limit Reached</h3>
    <p className="text-gray-400 mb-4">You've used all {limit} {feature}.</p>
    <Button onClick={() => navigate('/subscription')}>Upgrade for More</Button>
  </div>
);
```

### ✅ **Step 7.4: Add Progress Indicators**
```typescript
// Show progress in tooltips
<Tooltip>
  <TooltipTrigger>
    <Badge>{current}/{limit}</Badge>
  </TooltipTrigger>
  <TooltipContent>
    <p>{feature} Usage</p>
    <Progress value={(current/limit)*100} className="mt-2" />
  </TooltipContent>
</Tooltip>
```

## 📊 **PHASE 8: TESTING & VALIDATION (3-4 hours)**

### ✅ **Step 8.1: Test Free User Flow**
- Create notes up to limit (50)
- Upload documents up to limit (20)
- Send AI messages up to daily limit (20)
- Try to create folders beyond limit (5)
- Try to access social features (should be blocked)
- Verify upgrade prompts appear correctly

### ✅ **Step 8.2: Test Scholar User Flow**
- Access social features
- Create unlimited quizzes
- Verify higher limits apply
- Test file upload size (50MB)

### ✅ **Step 8.3: Test Genius User Flow**
- Verify unlimited access to all features
- Test 100MB file uploads
- Verify all premium features available

### ✅ **Step 8.4: Test Edge Cases**
- User downgrades plan
- Subscription expires
- User reaches multiple limits simultaneously
- Network errors during subscription checks

## 🔄 **PHASE 9: PERFORMANCE OPTIMIZATION (2-3 hours)**

### ✅ **Step 9.1: Implement Caching**
```typescript
// Cache subscription data
const subscriptionCache = {
  get: (userId: string) => localStorage.getItem(`subscription_${userId}`),
  set: (userId: string, data: any) => localStorage.setItem(`subscription_${userId}`, JSON.stringify(data)),
  clear: (userId: string) => localStorage.removeItem(`subscription_${userId}`)
};
```

### ✅ **Step 9.2: Lazy Load Subscription Components**
```typescript
// Use React.lazy for subscription components
const SubscriptionGuard = React.lazy(() => import('@/components/subscription/SubscriptionGuard'));
const UsageIndicator = React.lazy(() => import('@/components/subscription/UsageIndicator'));
```

### ✅ **Step 9.3: Debounce Limit Checks**
```typescript
// Prevent excessive checks
const debouncedCheck = useDebounce(() => {
  checkSubscriptionAccess(feature, currentCount);
}, 300);
```

## 📝 **PHASE 10: DOCUMENTATION & FINAL CHECKS (2 hours)**

### ✅ **Step 10.1: Update README**
```markdown
## Subscription System

### Features by Plan:
- **Free**: 50 notes, 20 documents, 20 AI messages/day, 10MB file size
- **Scholar**: 500 notes, 100 documents, 100 AI messages/day, social features, 50MB file size
- **Genius**: Unlimited everything, 100MB file size, advanced AI features

### Integration Points:
1. All create/upload actions check subscription limits
2. Usage indicators show current usage
3. Upgrade prompts appear when limits reached
4. Social features require Scholar+ plan
```

### ✅ **Step 10.2: Create Integration Checklist**
```markdown
- [ ] Notes component with limit checks
- [ ] Documents component with size/limit checks
- [ ] AI Chat with daily message counter
- [ ] Social features tier-locked
- [ ] Quizzes generation tier-locked
- [ ] Recordings limit
- [ ] Schedule items limit
- [ ] Folders limit
- [ ] Sidebar subscription info
- [ ] Upgrade prompts and CTAs
- [ ] Empty states for limited users
```

### ✅ **Step 10.3: Final Code Review**
- Check all TypeScript errors resolved
- Verify no runtime errors
- Test all upgrade flows
- Verify responsive design
- Check accessibility (aria labels)

## 🚨 **CRITICAL FILES TO CHECK/UPDATE**

### **Priority 1 (Must Fix):**
1. `types/Subscription.ts` - Ensure SubscriptionLimits type is correct
2. `contexts/AppContext.tsx` - Ensure subscription props are in interface
3. `hooks/useFeatureAccess.tsx` - Fix TypeScript errors
4. `components/ui/progress.tsx` - Add indicatorClassName support

### **Priority 2 (Core Components):**
1. `components/subscription/SubscriptionGuard.tsx`
2. `components/subscription/UsageIndicator.tsx`
3. `hooks/useAppOperations.tsx` - Add subscription checks to operations

### **Priority 3 (Feature Integration):**
1. `components/notes/NoteEditor.tsx`
2. `components/documents/DocumentUpload.tsx`
3. `components/aiChat/AiChat.tsx`
4. `components/social/SocialFeed.tsx`

### **Priority 4 (Layout & UX):**
1. `components/layout/Sidebar.tsx`
2. `components/layout/AppShell.tsx`
3. `App.tsx` - Add SubscriptionStatusBar

## 📈 **IMPLEMENTATION TIMELINE**

### **Week 1 (Setup & Core):**
- Day 1: Fix types and hooks (2-3 hours)
- Day 2: Create subscription components (3-4 hours)
- Day 3: Integrate Notes & Documents (3-4 hours)
- Day 4: Integrate AI Chat & Social (3-4 hours)

### **Week 2 (Features & Polish):**
- Day 5: Integrate remaining features (3-4 hours)
- Day 6: Update layout and UX (3-4 hours)
- Day 7: Testing and bug fixes (3-4 hours)

### **Total Estimated Time: 20-30 hours**

## 🆘 **TROUBLESHOOTING**

### **Common Issues:**
1. **TypeScript errors**: Ensure all imports are correct
2. **Missing props**: Check AppContext provides all subscription data
3. **Performance issues**: Implement caching for subscription data
4. **UI not updating**: Ensure proper state management and refreshes

### **Debug Commands:**
```bash
# Check TypeScript errors
npm run type-check

# Run in development
npm run dev

# Build and check for errors
npm run build
```

### **Testing Flow:**
1. Log in as free user
2. Test each feature until limit reached
3. Verify upgrade prompts appear
4. Test scholar and genius user flows

## ✅ **FINAL CHECKLIST BEFORE DEPLOYMENT**

- [ ] All TypeScript errors resolved
- [ ] Subscription checks work for all features
- [ ] Upgrade prompts appear correctly
- [ ] Usage indicators update in real-time
- [ ] No console errors in browser
- [ ] Mobile responsive
- [ ] Accessible (screen reader friendly)
- [ ] Performance acceptable (no lag on checks)
- [ ] Edge cases handled (offline, expired subscription)

---

**Save this as `TODO-subscription-integration.md` and check off items as you complete them!** Let me know if you need help with any specific step.