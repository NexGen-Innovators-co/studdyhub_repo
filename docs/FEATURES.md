# ✨ StuddyHub Features Documentation

## Table of Contents

- [Overview](#overview)
- [Note-Taking System](#note-taking-system)
- [AI Chat Assistant](#ai-chat-assistant)
- [Document Management](#document-management)
- [Audio Recordings](#audio-recordings)
- [Quiz System](#quiz-system)
- [Study Scheduler](#study-scheduler)
- [Social Learning](#social-learning)
- [AI Podcast Generation](#ai-podcast-generation)
- [Subscription Management](#subscription-management)
- [Admin Dashboard](#admin-dashboard)
- [User Settings](#user-settings)

---

## Overview

StuddyHub provides a comprehensive suite of learning tools designed to help students organize, study, and collaborate effectively. All features are integrated with AI to provide intelligent assistance and insights.

---

## Note-Taking System

### Rich Text Editor

Powered by TipTap, the note editor provides a modern, intuitive writing experience.

#### Features
- **Formatting Tools**
  - Bold, italic, underline, strikethrough
  - Headings (H1-H6)
  - Lists (bullet, numbered, todo)
  - Blockquotes
  - Code blocks with syntax highlighting
  - Tables
  - Links
  - Images

- **AI-Enhanced Writing**
  - Auto-complete suggestions
  - Grammar and spelling check
  - Content improvement suggestions
  - Inline content generation
  - Summary generation

- **Markdown Support**
  - Full markdown syntax
  - Import/export markdown files
  - Real-time preview

#### Usage

```typescript
// Create a new note
const { data: note } = await supabase
  .from('notes')
  .insert({
    title: 'My Study Note',
    content: '# Chapter 1\n\nKey concepts...',
    category: 'science',
    tags: ['biology', 'cells']
  })
  .select()
  .single();
```

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + B` | Bold |
| `Ctrl + I` | Italic |
| `Ctrl + K` | Insert link |
| `Ctrl + /` | AI assistant |
| `Ctrl + S` | Save note |
| `Ctrl + Shift + L` | Toggle list |

### Folder Organization

Organize notes in hierarchical folder structures.

#### Features
- Create unlimited folders
- Nested folders (subfolders)
- Drag-and-drop organization
- Color coding
- Folder sharing (coming soon)

#### Usage

```typescript
// Create a folder
const { data: folder } = await supabase
  .from('folders')
  .insert({
    name: 'Biology Notes',
    parent_id: null // or parent folder ID
  })
  .select()
  .single();

// Move note to folder
await supabase
  .from('notes')
  .update({ folder_id: folder.id })
  .eq('id', noteId);
```

### AI-Powered Features

#### Auto-Summarization
- Generate summaries of long notes
- Adjustable summary length
- Key points extraction

```typescript
const { data } = await supabase.functions.invoke('generate-summary', {
  body: {
    content: noteContent,
    maxLength: 200
  }
});
```

#### Smart Tags
- AI suggests relevant tags
- Auto-categorization
- Tag-based search

#### Note Templates
- Pre-built templates for common note types
- Cornell notes
- Meeting notes
- Lecture notes
- Research notes

### Export Options

Export notes in multiple formats:
- **PDF** - Formatted document
- **Markdown** - Plain text with formatting
- **HTML** - Web-ready format
- **DOCX** - Microsoft Word (coming soon)

---

## AI Chat Assistant

### Contextual AI Chat

Chat with an AI assistant that understands your notes and documents.

#### Features

- **Context-Aware Responses**
  - AI analyzes your notes before responding
  - Provides answers based on your study materials
  - Cites sources from your notes

- **Personalized Learning**
  - Adapts to your learning style (visual/auditory/kinesthetic/reading)
  - Adjusts explanation complexity
  - Provides relevant examples

- **Learning Styles**

  **Visual Learners**
  - Diagrams and charts
  - Visual metaphors
  - Color-coded information

  **Auditory Learners**
  - Verbal explanations
  - Mnemonic devices
  - Discussion-style responses

  **Kinesthetic Learners**
  - Practical examples
  - Step-by-step instructions
  - Interactive analogies

  **Reading/Writing Learners**
  - Detailed text explanations
  - Lists and bullet points
  - Written summaries

#### Usage

```typescript
// Send a message to AI
const { data } = await supabase.functions.invoke('gemini-chat', {
  body: {
    message: "Explain photosynthesis in simple terms",
    contextIds: [noteId1, noteId2], // Related notes
    learningStyle: "visual",
    preferences: {
      explanation_style: "simple",
      examples: true,
      difficulty: "beginner"
    }
  }
});
```

#### Features by Subscription Tier

| Feature | Visitor | Scholar | Genius |
|---------|---------|---------|--------|
| Messages/day | 5 | 50 | 200 |
| Context awareness | ✅ | ✅ | ✅ |
| Learning style | ✅ | ✅ | ✅ |
| Priority responses | ❌ | ❌ | ✅ |
| Custom AI personality | ❌ | ❌ | ✅ |

### AI Capabilities

- **Question Answering** - Ask questions about your study materials
- **Explanation** - Get detailed explanations of concepts
- **Examples** - Request examples and use cases
- **Quiz Generation** - Generate practice questions
- **Study Tips** - Get personalized study recommendations
- **Note Improvement** - Suggestions to enhance your notes
- **Research Help** - Assistance with research topics

### Chat History

- All conversations saved
- Search through past chats
- Export chat history
- Tag important conversations

---

## Document Management

### File Upload

Support for multiple document formats with intelligent processing.

#### Supported Formats

| Format | Extension | Max Size | Features |
|--------|-----------|----------|----------|
| PDF | .pdf | 50MB (Scholar), 100MB (Genius) | Text extraction, OCR |
| Word | .docx, .doc | 50MB | Full formatting preserved |
| Text | .txt, .md | 10MB | Markdown support |
| Images | .jpg, .png, .jpeg | 10MB | OCR, image analysis |
| PowerPoint | .pptx, .ppt | 50MB | Slide extraction (coming soon) |

#### Usage

```typescript
// Upload document
const file = event.target.files[0];

// 1. Upload to Supabase Storage
const { data: uploadData } = await supabase
  .storage
  .from('documents')
  .upload(`${userId}/${file.name}`, file);

// 2. Process document
const { data: processedData } = await supabase.functions.invoke('document-extractor', {
  body: {
    fileUrl: publicUrl,
    fileType: file.type,
    documentId: documentId
  }
});
```

### AI Document Analysis

#### Content Extraction
- Automatic text extraction
- Structure recognition (headings, sections)
- Table extraction
- Image extraction with OCR

#### Smart Analysis
- **Summarization** - AI-generated summaries
- **Key Points** - Extract main ideas
- **Question Generation** - Create study questions
- **Entity Recognition** - Identify important terms
- **Topic Classification** - Auto-categorize documents

```typescript
const { data } = await supabase.functions.invoke('gemini-document-extractor', {
  body: {
    fileUrl: documentUrl,
    fileType: 'pdf',
    analysisType: 'all' // summary, keypoints, questions, all
  }
});

// Response includes:
// - content: extracted text
// - summary: AI summary
// - keyPoints: array of key points
// - questions: study questions
// - entities: important terms
```

### Document Search

- **Full-text search** - Search document contents
- **Semantic search** - Find related documents
- **Filter by type** - PDF, Word, images, etc.
- **Filter by date** - Recently added documents
- **Filter by size** - Find large files

### Document Actions

- **View** - In-app document viewer
- **Download** - Original file download
- **Share** - Share with other users (coming soon)
- **Convert to Note** - Create note from document
- **Generate Quiz** - Create quiz from document
- **Delete** - Remove document and file

---

## Audio Recordings

### Recording Features

Record lectures, meetings, and discussions with automatic transcription.

#### Recording Interface

- **One-click recording** - Start/stop with single button
- **Real-time duration** - Live recording timer
- **Waveform visualization** - Visual feedback
- **Pause/resume** - Pause recording temporarily
- **Quality settings** - Choose audio quality

#### Usage

```typescript
// Start recording
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm',
  audioBitsPerSecond: 128000
});

// Stop and upload
const blob = new Blob(chunks, { type: 'audio/webm' });
const file = new File([blob], `recording-${Date.now()}.webm`);

// Upload to Supabase Storage
const { data } = await supabase
  .storage
  .from('recordings')
  .upload(`${userId}/${file.name}`, file);

// Process with AI
const { data: processed } = await supabase.functions.invoke('gemini-audio-processor', {
  body: {
    audioUrl: publicUrl,
    recordingId: recordingId,
    options: {
      transcribe: true,
      summarize: true,
      extractKeyPoints: true
    }
  }
});
```

### AI Transcription

Powered by Google Gemini for accurate speech-to-text.

#### Features
- **Automatic transcription** - Speech-to-text conversion
- **Speaker identification** - Identify different speakers
- **Timestamp markers** - Time-coded transcripts
- **Punctuation** - Automatic punctuation
- **Language detection** - Auto-detect language

#### Transcription Output

```json
{
  "transcription": "Welcome to today's lecture on photosynthesis...",
  "speakers": [
    {
      "id": "speaker_1",
      "segments": [
        {
          "text": "Welcome to today's lecture",
          "timestamp": "00:00:03",
          "confidence": 0.95
        }
      ]
    }
  ]
}
```

### Smart Features

- **Summary Generation** - AI-generated recording summary
- **Key Points Extraction** - Main topics identified
- **Quiz Generation** - Create quizzes from recordings
- **Note Conversion** - Convert to structured notes
- **Search** - Search within transcriptions

### Recording Limits

| Tier | Monthly Recordings | Max Duration | Storage |
|------|-------------------|--------------|---------|
| Visitor | 3 | 30 minutes | 100MB |
| Scholar | 20 | 2 hours | 5GB |
| Genius | Unlimited | 4 hours | 50GB |

### Playback Features

- **Variable speed** - 0.5x to 2x playback
- **Jump to timestamp** - Click transcript to jump
- **Bookmarks** - Mark important moments
- **Loop section** - Repeat difficult parts
- **Download** - Original audio file

---

## Quiz System

### Quiz Generation

Create quizzes automatically from notes, documents, or recordings.

#### Generation Options

```typescript
const { data: quiz } = await supabase.functions.invoke('generate-quiz', {
  body: {
    content: noteContent,
    numQuestions: 10,
    difficulty: 'intermediate', // beginner, intermediate, advanced
    questionTypes: ['mcq', 'true_false', 'short_answer']
  }
});
```

#### Question Types

**Multiple Choice (MCQ)**
```json
{
  "type": "mcq",
  "question": "What is the powerhouse of the cell?",
  "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"],
  "correctAnswer": "Mitochondria",
  "explanation": "Mitochondria produce ATP, the cell's energy currency."
}
```

**True/False**
```json
{
  "type": "true_false",
  "question": "Photosynthesis occurs in animal cells.",
  "correctAnswer": false,
  "explanation": "Photosynthesis only occurs in plant cells..."
}
```

**Short Answer**
```json
{
  "type": "short_answer",
  "question": "Define photosynthesis.",
  "correctAnswer": "Process by which plants convert light energy...",
  "keywords": ["light", "energy", "glucose", "oxygen"]
}
```

### Quiz Taking

- **Timed mode** - Optional time limits
- **Exam mode** - Full-screen, no distractions (Scholar/Genius)
- **Practice mode** - See answers immediately
- **Review mode** - Go back and change answers

### Analytics

Track your quiz performance:

```typescript
interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number; // percentage
  answers: Answer[];
  timeSpent: number; // seconds
  completedAt: Date;
}
```

**Performance Metrics**
- Overall score percentage
- Time spent per question
- Difficult topics identified
- Progress over time
- Strength/weakness analysis

### Daily Quizzes

- **Daily limits** by subscription tier
- **Auto-reset** at midnight
- **Streak tracking** - Build study streaks
- **Recommendations** - AI suggests topics to review

| Tier | Daily Quizzes |
|------|---------------|
| Visitor | 2 |
| Scholar | 10 |
| Genius | Unlimited |

### Quiz Library

- **Personal quizzes** - Quizzes you created
- **Shared quizzes** - From other users (coming soon)
- **Public quizzes** - Community-created (coming soon)
- **Tags & categories** - Organize quizzes
- **Difficulty levels** - Filter by difficulty

---

## Study Scheduler

### Calendar Integration

Plan and organize your study sessions.

#### Features

- **Interactive calendar** - Monthly/weekly/daily views
- **Study sessions** - Schedule study blocks
- **Deadlines** - Track assignment due dates
- **Reminders** - Get notified before sessions
- **Recurring events** - Weekly study sessions

#### Usage

```typescript
// Create study session
const { data: session } = await supabase
  .from('study_sessions')
  .insert({
    title: 'Biology Chapter 5 Review',
    start_time: '2024-01-15T14:00:00',
    end_time: '2024-01-15T16:00:00',
    note_ids: [noteId1, noteId2],
    reminder: true,
    reminder_time: 30 // minutes before
  })
  .select()
  .single();
```

### Smart Scheduling

AI-assisted schedule optimization:

- **Optimal study times** - Based on your patterns
- **Break suggestions** - Recommended break intervals
- **Task prioritization** - Urgent tasks highlighted
- **Workload balancing** - Distribute study evenly
- **Conflict detection** - Overlapping sessions flagged

### Study Techniques

Built-in support for popular study methods:

**Pomodoro Technique**
- 25-minute focus sessions
- 5-minute breaks
- Longer break after 4 sessions
- Timer built-in

**Spaced Repetition**
- Schedule review sessions
- Increasing intervals
- Track mastery levels

**Time Blocking**
- Dedicate time blocks to subjects
- Minimize context switching
- Visual calendar representation

### Progress Tracking

- **Completed sessions** - Track what you've done
- **Study hours** - Total time studied
- **Consistency** - Study streak tracking
- **Goals** - Set and track goals
- **Analytics** - Weekly/monthly reports

---

## Social Learning

Connect and collaborate with other students.

### Social Features (Scholar/Genius Only)

#### Posts & Feed

Share study updates, resources, and insights:

```typescript
// Create a post
const { data: post } = await supabase.functions.invoke('create-social-post', {
  body: {
    content: 'Just finished studying Chapter 5! Key takeaways: ...',
    mediaUrl: imageUrl, // optional
    visibility: 'public' // public, followers, private
  }
});
```

**Post Types**
- Text posts
- Image posts
- Study tips
- Resource sharing
- Questions

#### Engagement

- **Like posts** - Show appreciation
- **Comment** - Discuss and help
- **Share** - Share with followers
- **Save** - Bookmark useful posts

#### Follow System

```typescript
// Follow a user
const { data } = await supabase.functions.invoke('follow-user', {
  body: {
    targetUserId: userId,
    action: 'follow' // or 'unfollow'
  }
});
```

- **Follow users** - Stay updated with their posts
- **Followers** - See who follows you
- **Following** - Manage who you follow
- **Feed algorithm** - AI-powered personalized content ranking

#### AI-Powered Feed System

StuddyHub uses **Gemini AI** to deliver a truly personalized social feed experience. The system learns from every interaction to surface the most relevant content for each user.

##### AI Content Categorization

Every new post is automatically categorized using Gemini AI with a **45-category taxonomy** including:

- `technology`, `programming`, `ai-ml`, `data-science`, `web-development`
- `study-tips`, `exam-prep`, `note-taking`, `time-management`
- `mathematics`, `physics`, `chemistry`, `biology`, `engineering`
- `motivation`, `career-advice`, `internships`, `research`
- `question`, `discussion`, `resource-sharing`, `tutorial`, `announcement`
- And 20+ more domain-specific categories

Each post receives:
- **Categories** (`ai_categories`) — up to 3 relevant labels
- **Sentiment** (`ai_sentiment`) — `positive`, `neutral`, `negative`, or `mixed`
- **Quality Score** (`ai_quality_score`) — 1–10 rating based on educational value, depth, and clarity

##### Signal-Based Preference Learning

The system records user interaction signals and computes preferences with weighted scoring:

| Signal | Weight | Description |
|--------|--------|-------------|
| Share | 3.0 | Strongest positive signal |
| Bookmark | 2.0 | Strong interest indicator |
| Comment | 1.5 | Active engagement |
| Like | 1.0 | Passive approval |
| View (>3s) | 0.3 | Mild interest |
| Skip | -0.5 | Mild disinterest |
| Hide | -3.0 | Strong negative signal |

Signals are subject to **30-day exponential time decay**, so recent interactions matter more than old ones. Preferences are cached for 10 minutes and periodically persisted to the database.

##### Personalized Feed Scoring

Posts are scored across **6 dimensions** (0–100 total):

| Dimension | Max Score | Description |
|-----------|-----------|-------------|
| Category Match | 30 | How well post categories align with user interests |
| Author Affinity | 20 | History of engaging with this author |
| Quality | 10 | AI-assigned quality score |
| Engagement Momentum | 15 | Recent like/comment/share velocity |
| Recency | 15 | Time-decay freshness bonus |
| Novelty | 10 | Topic diversity to avoid echo chambers |

##### Cold-Start Handling

New users with fewer than 10 interactions receive **Gemini-powered interest matching**:
- The AI analyzes the user's bio, selected interests, and academic level
- Posts are semantically matched against the user's profile
- As signals accumulate, the system transitions to data-driven ranking

##### Cursor-Based Pagination

The feed uses cursor-based pagination (keyed on `created_at` timestamps) to ensure:
- **No duplicate posts** across pages
- **No skipped posts** when new content is added
- **Consistent ordering** regardless of concurrent activity

##### AI-Enhanced Suggested Users

Suggested user recommendations are powered by:
- **Gemini semantic matching** — AI compares user bios, interests, and study fields for compatibility (up to 20 bonus points)
- **Time-seeded pseudo-random variety** — recommendations rotate every 30 minutes
- **Previously-shown exclusion** — avoids repeating suggestions within a session

#### Study Groups

Create or join study groups:

```typescript
// Create study group
const { data: group } = await supabase.functions.invoke('create-study-group', {
  body: {
    name: 'Biology 101 Study Group',
    description: 'Preparing for finals',
    isPrivate: false,
    tags: ['biology', 'finals']
  }
});
```

**Group Features**
- Group chat
- Shared resources
- Group study sessions
- Member management
- Group analytics

#### User Profiles

- **Profile customization** - Avatar, bio, interests
- **Verification badge** - For Genius tier users
- **Activity timeline** - Recent activity
- **Stats** - Study stats and achievements
- **Privacy settings** - Control visibility

### Social Settings

- **Privacy** - Control who sees your content
- **Notifications** - Manage social notifications
- **Blocking** - Block unwanted users
- **Reporting** - Report inappropriate content

---

## AI Podcast Generation

Transform your study materials into engaging audio podcasts powered by AI.

### Podcast Creation (AI Chat Integration)

Generate podcasts directly from your study materials:

```typescript
// Generate podcast in AI chat
const { data: podcast } = await supabase.functions.invoke('generate-podcast', {
  body: {
    topic: 'World War II History',
    style: 'conversational', // conversational, educational, storytelling
    duration: 300, // seconds
    sources: noteIds // Array of note IDs to use as source material
  }
});
```

**Podcast Styles**
- Conversational - Two-host discussion format
- Educational - Teacher-student format
- Storytelling - Narrative style
- Interview - Q&A format

### Podcast Player Features

Interactive player with advanced controls:

- **Resizable Panel** - Adjustable width (30-80%)
- **Full-Screen Mode** - Immersive listening experience
- **Audio Controls**
  - Play/pause
  - Volume control with mute
  - Progress bar with click-to-seek
  - Auto-play next segment
- **Interactive Transcript**
  - Click segments to jump to specific parts
  - Highlight current segment
  - Full-text search
- **Download & Share** - Export audio or share link

### Social Podcast Features

Share and discover podcasts in the social feed:

#### Podcast Sharing

```typescript
// Share podcast to social feed
const { data: post } = await supabase.functions.invoke('share-podcast', {
  body: {
    podcastId: podcast.id,
    content: 'Check out my new podcast on WWII!',
    privacy: 'public'
  }
});
```

**Metadata Tracking**
- Listen count
- Share count
- Duration and segment count
- Cover image and tags

#### Discovery Platform

- **Discover Tab** - Browse public podcasts
- **My Podcasts** - Manage your podcast library
- **Live Now** - See live streaming podcasts
- **Search & Filter** - Find podcasts by title, description, or tags
- **Beautiful Cards** - Gradient UI with stats display

#### Visibility Controls

- **Public/Private Toggle** - Control who can access
- **Share to Clipboard** - Quick link sharing
- **Share to Social Feed** - Post as social content

### Collaboration Features (Database Ready)

Infrastructure in place for collaborative podcasts:

#### Podcast Members

```sql
-- Roles: owner, co-host, listener
CREATE TABLE podcast_members (
  podcast_id UUID REFERENCES ai_podcasts(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id)
);
```

#### Invitation System

```sql
-- Invite users to collaborate
CREATE TABLE podcast_invites (
  podcast_id UUID,
  inviter_id UUID,
  invitee_id UUID,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined
  expires_at TIMESTAMP
);
```

#### Live Streaming

```sql
-- Track real-time listeners
CREATE TABLE podcast_listeners (
  podcast_id UUID,
  user_id UUID,
  is_active BOOLEAN,
  joined_at TIMESTAMP
);
```

### Podcast Analytics

Track engagement and performance:

- **Listen Count** - Total and unique listeners
- **Share Tracking** - Platform-specific share analytics
- **Engagement Metrics** - Average listen duration
- **Popular Segments** - Most replayed parts
- **Demographic Insights** - Audience analysis (Genius tier)

### Technical Details

**Audio Format**
- Base64 encoded MP3
- Segmented audio for better control
- Cloud TTS generation via Supabase Edge Functions

**Storage**
- Efficient JSONB metadata storage
- RLS policies for secure access
- Indexed fields for fast queries

**Integration Points**
- AI Chat panel (like diagram panel)
- Social feed automatic detection
- Podcasts dedicated page (/podcasts)
- Sidebar navigation

### Usage Limits by Tier

| Feature | Free | Scholar | Genius |
|---------|------|---------|--------|
| Podcast Generation | 3/month | 20/month | Unlimited |
| Storage | 5 podcasts | 50 podcasts | Unlimited |
| Share to Social | ❌ | ✅ | ✅ |
| Live Streaming | ❌ | ❌ | ✅ (Coming Soon) |
| Collaboration | ❌ | Limited | Full Access |
| Analytics | Basic | Standard | Advanced |

---

## Subscription Management

### Tier Management

Three subscription tiers with different feature access.

#### Subscription Interface

```typescript
// Check current subscription
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', userId)
  .single();

// Subscription object
interface Subscription {
  id: string;
  userId: string;
  tier: 'visitor' | 'scholar' | 'genius';
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paymentId: string;
}
```

### Real-Time Usage Tracking

#### Status Bar Component

Displays current usage across all features:

- **Notes** - X / 50 (Visitor), Unlimited (Scholar/Genius)
- **Documents** - X / 20 (Visitor), X / 100 (Scholar), Unlimited (Genius)
- **AI Messages** - X / 5 today (Visitor), etc.
- **Recordings** - X / 3 (Visitor), etc.

```typescript
// Get usage stats
const stats = useSubscriptionStatus();

// Returns:
{
  notesUsed: 25,
  notesLimit: 50,
  documentsUsed: 10,
  documentsLimit: 20,
  aiMessagesToday: 3,
  aiMessagesLimit: 5,
  // ... more stats
}
```

#### Progress Indicators

Visual feedback with color coding:
- 🟢 **Green** (0-70% used) - Good
- 🟡 **Amber** (70-90% used) - Warning
- 🔴 **Red** (90-100% used) - Limit approaching

### Feature Access Control

```typescript
// Check if user can perform action
const { canCreateNote, reason } = useFeatureAccess();

if (!canCreateNote) {
  toast.error(reason); // "Note limit reached. Please upgrade."
  return;
}

// Proceed with action
```

### Upgrade Flow

1. **User clicks upgrade** - From status bar or settings
2. **Choose tier** - Scholar or Genius
3. **Payment** - Paystack integration
4. **Instant activation** - Features unlock immediately
5. **Confirmation** - Email and in-app notification

### Payment Integration (Paystack)

```typescript
// Initialize payment
import { PaystackButton } from 'react-paystack';

<PaystackButton
  email={user.email}
  amount={250000} // ₦2,500 in kobo
  publicKey={PAYSTACK_PUBLIC_KEY}
  onSuccess={handlePaymentSuccess}
  onClose={handlePaymentClose}
/>
```

### Subscription Actions

- **Upgrade** - Move to higher tier (prorated)
- **Downgrade** - Move to lower tier (at period end)
- **Cancel** - Cancel auto-renewal
- **Reactivate** - Resume cancelled subscription
- **Update payment** - Change payment method

---

## Admin Dashboard

### Admin Access

Special features for administrators to manage the platform.

#### Admin Routes

```
/admin - Admin dashboard
/admin/users - User management
/admin/admins - Admin management
/admin/content - Content moderation
/admin/settings - System settings
/admin/logs - Activity logs
```

### User Management

#### User List

- View all users
- Search and filter
- Sort by date, tier, activity
- Bulk actions

#### User Actions

```typescript
// View user details
// Edit user info
// Change subscription
// Suspend user
// Delete user
// View user activity
```

### Content Moderation

- Review reported posts
- Remove inappropriate content
- Warn/ban users
- View moderation history

### System Settings

- Feature flags
- Global settings
- Maintenance mode
- Announcement banners

### Analytics

- Total users
- Active users (daily/monthly)
- Revenue metrics
- Feature usage stats
- Performance metrics

### Activity Logs

```typescript
interface ActivityLog {
  id: string;
  adminId: string;
  action: string;
  targetType: 'user' | 'post' | 'system';
  targetId: string;
  details: Record<string, any>;
  timestamp: Date;
}
```

Track all admin actions for accountability.

---

## User Settings

### Profile Settings

- **Personal Info**
  - Full name
  - Email
  - Avatar
  - Bio

- **Learning Preferences**
  - Learning style (visual/auditory/kinesthetic/reading)
  - Explanation style (simple/detailed/comprehensive)
  - Preferred difficulty level
  - Example preferences

### Account Settings

- **Password** - Change password
- **Email** - Update email address
- **2FA** - Two-factor authentication (coming soon)
- **Sessions** - Active sessions
- **Delete account** - Permanently delete

### Notification Settings

- **Email notifications**
  - Study reminders
  - Quiz deadlines
  - Social activity
  - Newsletter

- **In-app notifications**
  - Real-time updates
  - Sound alerts
  - Desktop notifications

### Privacy Settings

- **Profile visibility** - Public/Private
- **Activity visibility** - Who can see your activity
- **Search visibility** - Appear in search
- **Data export** - Download your data
- **Data deletion** - Request data deletion

### Appearance Settings

- **Theme** - Light/Dark mode
- **Font size** - Adjust text size
- **Color scheme** - Customize colors
- **Language** - Interface language (coming soon)

---

## Feature Availability Matrix

| Feature | Visitor | Scholar | Genius |
|---------|---------|---------|--------|
| **Notes** | 50 | Unlimited | Unlimited |
| **Documents** | 20 (10MB) | 100 (50MB) | Unlimited (100MB) |
| **AI Messages** | 5/day | 50/day | 200/day |
| **Recordings** | 3 | 20 | Unlimited |
| **Daily Quizzes** | 2/day | 10/day | Unlimited |
| **Social Features** | ❌ | ✅ | ✅ |
| **Exam Mode** | ❌ | ✅ | ✅ |
| **Verified Badge** | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ |
| **Custom AI** | ❌ | ❌ | ✅ |
| **Storage** | 100MB | 5GB | 50GB |

---

## Coming Soon

### Shipped Recently
- [x] AI-powered feed ranking (Gemini AI)
- [x] AI content categorization (45-category taxonomy)
- [x] Signal-based preference learning
- [x] Cold-start Gemini interest matching
- [x] Cursor-based feed pagination
- [x] AI-enhanced suggested users

### Q1 2025
- [ ] Mobile apps (iOS/Android)
- [ ] Offline mode
- [ ] Collaborative editing
- [ ] Video recording support

### Q2 2025
- [ ] Flashcard system
- [ ] Spaced repetition algorithm
- [ ] Public quiz library
- [ ] API access

### Q3 2025
- [ ] Multi-language support
- [ ] Voice commands
- [ ] Advanced analytics
- [ ] Study group video calls

---

For technical details on implementing these features, see:
- [Architecture Documentation](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [Deployment Guide](DEPLOYMENT.md)
