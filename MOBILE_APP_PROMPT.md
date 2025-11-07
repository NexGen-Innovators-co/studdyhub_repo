# StuddyHub Mobile App - Complete Development Prompt

## 📱 App Overview
StuddyHub is an **AI-powered learning management system** that helps students organize their studies, record lectures, analyze documents, take intelligent notes, and collaborate with peers. The app leverages Google Gemini AI for advanced features like transcription, summarization, quiz generation, and contextual assistance.

---

## 🎯 Core Technology Stack
- **Frontend Framework:** React Native / Flutter (your choice)
- **Backend:** Supabase (PostgreSQL database, authentication, storage, edge functions)
- **AI Services:** Google Gemini AI (via Supabase edge functions)
- **Real-time:** Supabase Realtime for live updates
- **Storage:** Supabase Storage for files, images, audio
- **Authentication:** Supabase Auth (email/password, social login)

---

## 🏗️ App Architecture & Database Schema

### Core Tables

#### 1. **profiles**
```sql
- id (uuid, primary key)
- email (text)
- full_name (text)
- avatar_url (text)
- learning_style ('visual' | 'auditory' | 'kinesthetic' | 'reading')
- learning_preferences (json):
  {
    explanation_style: 'simple' | 'detailed' | 'comprehensive',
    examples: boolean,
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  }
- created_at (timestamp)
- updated_at (timestamp)
```

#### 2. **notes**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- document_id (uuid, nullable, foreign key)
- title (text)
- content (text, markdown format)
- category ('general' | 'math' | 'science' | 'history' | 'language' | 'other')
- tags (text array)
- ai_summary (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 3. **documents**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- title (text)
- file_name (text)
- file_type (text, mime type)
- file_url (text, Supabase storage URL)
- file_size (bigint, bytes)
- content_extracted (text, AI-extracted content)
- processing_status ('pending' | 'completed' | 'failed')
- processing_error (text, nullable)
- type ('pdf' | 'image' | 'text' | 'audio' | 'other')
- folder_ids (uuid array, for folder organization)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 4. **document_folders**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- name (text)
- parent_folder_id (uuid, nullable, self-reference)
- color (text, hex color code)
- description (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 5. **document_folder_items**
```sql
- id (uuid, primary key)
- folder_id (uuid, foreign key)
- document_id (uuid, foreign key)
- added_at (timestamp)
```

#### 6. **class_recordings**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- title (text)
- subject (text)
- audio_url (text, Supabase storage URL)
- transcript (text, AI-generated)
- summary (text, AI-generated)
- duration (integer, seconds)
- date (timestamp)
- document_id (uuid, nullable, foreign key)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 7. **quizzes**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- title (text)
- questions (json array):
  [
    {
      id: string,
      question: string,
      options: string[],
      correctAnswer: number,
      explanation: string
    }
  ]
- class_id (uuid, nullable, links to class_recordings)
- created_at (timestamp)
```

#### 8. **schedule_items**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- title (text)
- subject (text)
- start_time (timestamp)
- end_time (timestamp)
- location (text, nullable)
- description (text, nullable)
- color (text, hex color)
- type ('class' | 'study' | 'assignment' | 'exam' | 'other')
- created_at (timestamp)
```

#### 9. **chat_sessions**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- title (text)
- document_ids (uuid array, attached documents)
- default_folder_id (uuid, nullable, for folder context)
- message_count (integer)
- context_summary (text, AI-generated summary of conversation)
- context_size_bytes (integer)
- memory_strategy (text, 'rolling_summary')
- last_summary_update (integer, timestamp)
- created_at (timestamp)
- updated_at (timestamp)
- last_message_at (timestamp)
```

#### 10. **chat_messages**
```sql
- id (uuid, primary key)
- session_id (uuid, foreign key)
- user_id (uuid, foreign key)
- content (text, message content)
- role ('user' | 'assistant')
- attached_document_ids (uuid array)
- attached_note_ids (uuid array)
- files_metadata (json array, attached files info)
- image_url (text, nullable)
- image_mime_type (text, nullable)
- conversation_context (text, nullable)
- is_error (boolean)
- has_been_displayed (boolean, for streaming)
- timestamp (timestamp)
```

#### 11. **audio_processing_results**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- file_url (text)
- document_id (uuid, nullable, foreign key)
- status ('pending' | 'processing' | 'completed' | 'error')
- transcript (text, nullable)
- summary (text, nullable)
- translated_content (text, nullable)
- target_language (text, nullable)
- error_message (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

### Social Features Tables

#### 12. **social_users**
```sql
- id (uuid, primary key, references profiles)
- username (text, unique)
- display_name (text)
- bio (text, nullable)
- avatar_url (text, nullable)
- followers_count (integer, default 0)
- following_count (integer, default 0)
- posts_count (integer, default 0)
- is_verified (boolean, default false)
- last_active (timestamp)
- created_at (timestamp)
```

#### 13. **social_posts**
```sql
- id (uuid, primary key)
- author_id (uuid, foreign key to social_users)
- content (text)
- media (json array, images/videos)
- privacy ('public' | 'followers' | 'private')
- group_id (uuid, nullable, for group posts)
- likes_count (integer, default 0)
- comments_count (integer, default 0)
- shares_count (integer, default 0)
- views_count (integer, default 0)
- is_pinned (boolean, default false)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 14. **social_comments**
```sql
- id (uuid, primary key)
- post_id (uuid, foreign key)
- author_id (uuid, foreign key)
- content (text)
- parent_comment_id (uuid, nullable, for nested replies)
- likes_count (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 15. **social_follows**
```sql
- id (uuid, primary key)
- follower_id (uuid, foreign key to social_users)
- following_id (uuid, foreign key to social_users)
- created_at (timestamp)
```

#### 16. **social_likes**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- post_id (uuid, foreign key)
- created_at (timestamp)
```

#### 17. **social_bookmarks**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- post_id (uuid, foreign key)
- created_at (timestamp)
```

#### 18. **social_groups**
```sql
- id (uuid, primary key)
- name (text)
- description (text)
- cover_image_url (text, nullable)
- privacy ('public' | 'private')
- creator_id (uuid, foreign key)
- members_count (integer, default 0)
- created_at (timestamp)
```

#### 19. **social_group_members**
```sql
- id (uuid, primary key)
- group_id (uuid, foreign key)
- user_id (uuid, foreign key)
- role ('admin' | 'moderator' | 'member')
- joined_at (timestamp)
```

#### 20. **social_hashtags**
```sql
- id (uuid, primary key)
- name (text, unique)
- usage_count (integer, default 0)
- trending_score (decimal)
- created_at (timestamp)
```

#### 21. **social_notifications**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- type ('like' | 'comment' | 'follow' | 'mention' | 'post' | 'group')
- actor_id (uuid, foreign key, who triggered the notification)
- entity_id (uuid, the post/comment/group ID)
- content (text)
- read (boolean, default false)
- created_at (timestamp)
```

---

## 📱 App Screens & Features

### 1. **Authentication Screens**

#### a) **Landing Page** (`/`)
- **Layout:**
  - Hero section with app logo and tagline
  - Video demo background (autoplay, loop, muted)
  - Trust indicators (active users, notes processed, uptime, rating stats)
  - Features showcase (6 cards: note-taking, recording, scheduling, AI chat, documents, learning paths)
  - Testimonial carousel with auto-play
  - CTA buttons: "Start Free Trial", "Watch Demo"
  - Footer: links to About, Contact, Privacy, Terms, Integrations, Careers
  - Dark/Light mode toggle

#### b) **Auth Screen** (`/auth`)
- **Login Form:**
  - Email input
  - Password input (show/hide toggle)
  - "Forgot password?" link
  - "Sign In" button
  - "Don't have an account? Sign Up" link
- **Signup Form:**
  - Full name input
  - Email input
  - Password input (show/hide toggle)
  - Confirm password input
  - "Sign Up" button
  - "Already have an account? Sign In" link
- **Social Login:**
  - Google OAuth button
- **Features:**
  - Form validation (email format, password strength)
  - Loading states
  - Error toasts
  - Auto-redirect to dashboard after successful auth

#### c) **Reset Password Screen** (`/reset-password`)
- Email input to send reset link
- "Send Reset Link" button
- "Back to Sign In" link
- Success message after sending

---

### 2. **Main Dashboard** (`/dashboard`)

**Layout:**
- **Header:** Greeting, engagement score, streak badge, filter/refresh buttons
- **Stats Cards (4):**
  1. Total Notes (count, this week trend)
  2. Recordings (count, total study hours)
  3. Documents (count, total file size)
  4. AI Conversations (count, AI usage rate)
- **Quick Actions (4 buttons):**
  - New Note
  - Record Session
  - Upload Document
  - Schedule Event
- **Analytics Tabs:**
  1. **Activity Tab:**
     - 7-day activity area chart (notes, recordings, documents)
     - Monthly heatmap calendar
     - Content type distribution pie chart
  2. **Productivity Tab:**
     - Study time trends line chart
     - Category breakdown bar chart
     - Weekly progress comparison
  3. **Learning Tab:**
     - AI interactions gauge
     - Quiz performance bar chart
     - Learning style radar chart
  4. **Insights Tab:**
     - Top subjects cards
     - Peak hours chart
     - Goal progress bars

**Features:**
- Real-time stats updates
- Time filter (7d, 30d, 90d, all)
- Click stat cards to navigate to respective sections
- Responsive grid layout

---

### 3. **Notes Tab** (`/notes`)

**Layout:**
- **Sidebar:** Notes list with search, category filter, create button
- **Main Editor:**
  - Title input
  - Rich text markdown editor with toolbar:
    - Bold, Italic, Underline, Strikethrough
    - Headings (H1-H6)
    - Lists (bullet, numbered)
    - Code blocks with syntax highlighting
    - Tables
    - Links, Images
    - Math equations (LaTeX)
    - Mermaid diagrams
  - Category selector
  - Tags input
  - Save button
  - AI features toolbar:
    - Generate AI summary
    - Upload document to note
    - Upload audio to note
    - Text-to-speech (read note aloud)
    - Translate note
    - Generate flashcards
    - View linked document

**AI Note Features:**
1. **Document Upload:**
   - Supported: PDF, DOCX, TXT, MD
   - Extract text via edge function
   - Analyze document structure (sections)
   - Generate AI note based on user learning style
   - Link note to document

2. **Audio Upload:**
   - Supported: MP3, WAV, M4A, WEBM
   - Transcribe audio via Gemini
   - Generate summary
   - Translate to target language
   - Create note from transcript

3. **AI Summary:**
   - Generate concise summary of note
   - Save summary to note metadata
   - Display in collapsible section

4. **Text-to-Speech:**
   - Select voice (system voices)
   - Play/Pause/Stop controls
   - Adjustable speech rate
   - Highlight spoken text

5. **Translation:**
   - Translate note to 50+ languages
   - Display original and translated side-by-side
   - Copy translation

6. **Flashcards:**
   - Auto-generate from note content
   - Q&A format
   - Review mode with flip animation
   - Progress tracking

7. **Regenerate Note:**
   - Re-generate note from linked document
   - Update with latest AI model

**Note Types:**
- General
- Math (with LaTeX support)
- Science
- History
- Language
- Other

---

### 4. **Documents Tab** (`/documents`)

**Layout:**
- **Left Sidebar (Folder Tree):**
  - Create folder button
  - Recursive folder tree with expand/collapse
  - Right-click context menu: Rename, Delete, Move
  - Drag-and-drop to move documents
- **Main Area:**
  - Upload section (drag-and-drop zone)
  - Search bar
  - Filter by category, status
  - Sort by name, date, size, type
  - View toggle (grid/list)
  - Document cards:
    - Thumbnail/icon
    - Title
    - File info (type, size, date)
    - Status badge (pending/completed/failed)
    - Actions: View, Download, Move, Delete

**Document Features:**
1. **Upload:**
   - Drag-and-drop or file picker
   - Supported: PDF, DOCX, XLSX, PPTX, images, text files
   - Max 25MB per file
   - Upload to specific folder
   - Extract text via edge function
   - Generate AI summary

2. **Processing:**
   - Show upload progress
   - Extract text content
   - Detect document type
   - Generate preview

3. **Folder Management:**
   - Create nested folders
   - Move documents between folders
   - Move folders (with validation to prevent circular references)
   - Delete folders (cascade delete items)
   - Color-code folders

4. **Document Preview:**
   - Display extracted text
   - Show file metadata
   - Download original file

5. **AI Integration:**
   - Generate notes from documents
   - Extract key information
   - Summarize content

---

### 5. **Class Recordings Tab** (`/recordings`)

**Layout:**
- **Top Section (2 cards):**
  1. **Upload Audio Card:**
     - File picker for audio upload
     - Supported: MP3, WAV, M4A, WEBM
     - Process audio via edge function
  2. **Record New Class Card:**
     - Start/Stop recording button
     - Live timer
     - Audio waveform visualization

- **Recordings List:**
  - Card per recording:
    - Title, subject, duration, date
    - Status badge
    - Actions: Download, View Details, Delete
  - Click to expand side panel

- **Recording Details Side Panel:**
  - Audio player (play/pause, scrubber, volume)
  - Transcript tab (scrollable, timestamps)
  - Summary tab (AI-generated summary)
  - Quiz tab:
    - Generate quiz button (options: num questions, difficulty)
    - Display generated quiz
    - Answer quiz
  - Actions:
    - Generate note from recording
    - Reprocess audio (re-transcribe/summarize)
    - Delete recording

- **Quiz History Section:**
  - List of past quizzes
  - Score, date, questions count
  - Click to review quiz

**Recording Features:**
1. **Voice Recording:**
   - Use Web Audio API / device mic
   - Real-time waveform
   - Save as WebM audio
   - Upload to Supabase storage

2. **Audio Processing (Edge Function):**
   - Upload audio to storage
   - Transcribe via Gemini (audio-to-text)
   - Generate summary
   - Detect key topics, speakers
   - Optional: translate transcript

3. **Quiz Generation:**
   - User selects num questions (5-20) and difficulty
   - Edge function generates quiz from transcript
   - Multiple-choice format
   - Correct answer + explanation
   - Save quiz to database

4. **Quiz Mode:**
   - Display questions one-by-one
   - Track user answers
   - Show results with score
   - Correct/incorrect feedback

5. **Note Generation:**
   - Generate structured note from recording
   - Apply user learning style
   - Link note to recording document

---

### 6. **Schedule Tab** (`/schedule`)

**Layout:**
- **Header:** "Schedule & Timetable", upcoming events count, refresh button, "Add Schedule Item" button
- **Add/Edit Form (collapsible):**
  - Title input
  - Subject input
  - Type selector (class, study, assignment, exam, other)
  - Date picker
  - Start time picker
  - End time picker
  - Location input
  - Description textarea
  - Submit button

- **Upcoming Events Section:**
  - Card per event:
    - Type icon + emoji
    - Title + type badge
    - Subject
    - Date, time, location
    - Description
    - Actions: Edit, Delete

- **Past Events Section:**
  - Similar card layout
  - Collapsed by default

**Schedule Features:**
- Create events with validation (end time > start time)
- Edit existing events
- Delete events with confirmation
- Color-coded by type
- Sort by date (upcoming first)
- Responsive layout

---

### 7. **AI Chat Tab** (`/chat`)

**Layout:**
- **Chat Sidebar (collapsible on mobile):**
  - New chat button
  - List of chat sessions (title, date, message count)
  - Click to switch sessions
  - Right-click: Rename, Delete
  - Load more button (infinite scroll)

- **Main Chat Area:**
  - Header:
    - Session title
    - Document selector button (show attached docs/notes)
    - Settings icon
  - Message list (scrollable):
    - User messages (right-aligned, blue bubble)
    - AI messages (left-aligned, gray bubble)
    - Markdown rendering with syntax highlighting
    - Code blocks with copy button
    - Mermaid diagrams
    - Chart.js charts
    - LaTeX math
    - Attached images (gallery view)
    - Attached documents (preview cards)
  - Input section (bottom):
    - Textarea (auto-resize)
    - Attach document button
    - Attach image button
    - Camera button
    - Voice input button
    - Send button

- **Document Selector Sidebar:**
  - Tabs: Documents, Notes
  - Search bar
  - Checkbox list
  - Load more (infinite scroll)
  - Selected count badge

**Chat Features:**
1. **Message Input:**
   - Type message
   - Attach files (images, documents)
   - Take photo (camera)
   - Voice-to-text (speech recognition)
   - Drag-and-drop files

2. **AI Response:**
   - Stream response token-by-token
   - Apply user learning style
   - Include context from:
     - Attached documents/notes
     - Folder context (if set)
     - Previous messages (rolling summary for long chats)
   - Format response with markdown
   - Generate diagrams, charts, code

3. **Message Actions:**
   - Copy message
   - Regenerate response
   - Delete message
   - Retry failed message
   - Share message

4. **Context Management:**
   - Select documents/notes to attach to chat
   - Set default folder for session (auto-attach all docs in folder)
   - Rolling conversation summary for long chats

5. **Special Rendering:**
   - **Mermaid Diagrams:** Render flowcharts, sequence diagrams, etc.
   - **Chart.js:** Render bar charts, line charts, pie charts
   - **Code Blocks:** Syntax highlighting with language detection
   - **LaTeX:** Render math equations
   - **Images:** Gallery view with lightbox
   - **Documents:** Preview cards with download

6. **Folder Context:**
   - User can set a default folder for a chat session
   - AI auto-includes all documents in that folder (and subfolders) as context
   - Similar to NotebookLM's notebook feature

---

### 8. **Social Feed Tab** (`/social`)

**Layout:**
- **Top Tabs:** Feed, Trending, Groups, Profile, Notifications

#### a) **Feed Tab**
- **Top Bar:**
  - Search input (posts, people, hashtags)
  - Filter dropdown (All, Following, Groups)
  - Sort dropdown (Newest, Popular, Trending)
  - Refresh button
  - Create Post button

- **Post Card:**
  - User avatar + name + username + timestamp
  - Post content (with hashtags highlighted)
  - Media gallery (images/videos, max 4)
  - Action buttons: Like, Comment, Share, Bookmark
  - Like/comment/share/view counts
  - Click to expand comments

- **Comment Section (expanded):**
  - List of comments
  - Reply button per comment
  - Add comment input + submit

- **Inline Suggestions (every 4-7 posts):**
  - "People You May Know" cards
  - "Trending Topics" cards

#### b) **Trending Tab**
- Similar layout to Feed
- Shows posts sorted by trending score (views, likes, shares)

#### c) **Groups Tab**
- **Create Group Button**
- **Group Cards:**
  - Cover image
  - Name, description
  - Privacy badge (public/private)
  - Members count
  - Join/Leave button

- **Group Detail Page:**
  - Cover image
  - Group name, description
  - Members count
  - Tabs: Posts, Members, Events, Settings
  - Create post button (group posts)

#### d) **Profile Tab**
- **User Header:**
  - Avatar
  - Name, username, bio
  - Followers/following counts
  - Edit profile button (own profile)
  - Follow/Unfollow button (other profiles)

- **Tabs:**
  - **Posts:** User's posts
  - **Liked:** Liked posts
  - **Bookmarked:** Saved posts

- **Edit Profile Modal:**
  - Avatar upload
  - Display name input
  - Username input (unique)
  - Bio textarea
  - Save button

#### e) **Notifications Tab**
- List of notifications:
  - Type icon (like, comment, follow, mention)
  - Actor avatar + name
  - Notification text
  - Timestamp
  - Mark as read button
  - Click to navigate to entity (post/profile)

- **Actions:**
  - Mark all as read
  - Delete notification

**Social Features:**
1. **Posts:**
   - Create text posts
   - Attach images (max 4)
   - Privacy (public, followers, private)
   - Edit/delete own posts
   - Hashtag detection

2. **Interactions:**
   - Like posts
   - Comment on posts (nested replies)
   - Share posts
   - Bookmark posts

3. **Following:**
   - Follow/unfollow users
   - View followers/following lists
   - Suggested users based on interests

4. **Groups:**
   - Create groups (public/private)
   - Join/leave groups
   - Group posts
   - Group events
   - Member management (admin/moderator roles)

5. **Notifications:**
   - Real-time notifications via Supabase Realtime
   - Like, comment, follow, mention, post, group events
   - Unread count badge

6. **Trending:**
   - Trending posts (high engagement)
   - Trending hashtags (usage count)
   - Suggested users (recommendation algorithm)

---

### 9. **Settings Tab** (`/settings`)

**Layout:**
- **Navigation Tabs:** Profile, Learning, Security

#### a) **Profile Section**
- **Avatar Upload:**
  - Circular avatar preview
  - Upload button
  - Max 5MB
  - Crop/resize

- **Full Name Input**
- **Save Button**

#### b) **Learning Section**
- **Learning Style Selector (4 cards):**
  - Visual (diagrams, charts)
  - Auditory (verbal explanations)
  - Kinesthetic (hands-on examples)
  - Reading/Writing (text-based)

- **Explanation Style (3 buttons):**
  - Simple (brief)
  - Detailed (thorough)
  - Comprehensive (in-depth)

- **Difficulty Level (3 buttons):**
  - Beginner
  - Intermediate
  - Advanced

- **Include Examples Toggle**

#### c) **Security Section**
- **Change Password Form:**
  - Current password input (show/hide)
  - New password input (show/hide)
  - Confirm password input (show/hide)
  - "Update Password" button

**Settings Features:**
- Form validation
- Loading states
- Success toasts
- Error handling
- Avatar preview before save
- Password strength indicator

---

## 🤖 AI Edge Functions (Supabase)

### 1. **gemini-chat** (`/functions/v1/gemini-chat`)
**Purpose:** Main AI chat endpoint
**Input:**
```json
{
  "message": "user message",
  "sessionId": "uuid",
  "userId": "uuid",
  "attachedDocumentIds": ["uuid"],
  "attachedNoteIds": ["uuid"],
  "processedFiles": [{ ... }],
  "userProfile": { learning_style, learning_preferences }
}
```
**Logic:**
- Fetch session context (previous messages, rolling summary)
- Fetch attached documents/notes content
- Fetch folder context (if default folder set)
- Build system prompt based on user learning style
- Stream AI response via Server-Sent Events (SSE)
- Update session context (rolling summary if >50 messages)
- Save messages to database

**Output:** SSE stream of AI response

---

### 2. **gemini-audio-processor** (`/functions/v1/gemini-audio-processor`)
**Purpose:** Process audio recordings
**Input:**
```json
{
  "fileUrl": "storage URL",
  "documentId": "uuid",
  "targetLang": "en" (optional)
}
```
**Logic:**
- Download audio from storage
- Transcribe via Gemini (audio-to-text)
- Generate summary
- Extract key topics, speakers
- Translate transcript (if targetLang provided)
- Update audio_processing_results table

**Output:**
```json
{
  "id": "job uuid",
  "status": "completed",
  "transcript": "...",
  "summary": "...",
  "translated_content": "..."
}
```

---

### 3. **document-extractor** (`/functions/v1/document-extractor`)
**Purpose:** Extract text from documents
**Input:**
```json
{
  "userId": "uuid",
  "files": [
    {
      "name": "file.pdf",
      "mimeType": "application/pdf",
      "data": "base64",
      "size": 1024
    }
  ]
}
```
**Logic:**
- Decode base64 file
- Extract text based on mime type:
  - PDF: use PDF parser
  - DOCX: extract text from XML
  - Images: OCR via Gemini vision
  - Text: direct read
- Upload original file to storage
- Save document to database
- Return document with extracted text

**Output:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "file_url": "storage URL",
      "content_extracted": "...",
      "processing_status": "completed"
    }
  ]
}
```

---

### 4. **analyze-document-structure** (`/functions/v1/analyze-document-structure`)
**Purpose:** Analyze document structure for note generation
**Input:**
```json
{
  "documentContent": "extracted text"
}
```
**Logic:**
- Use Gemini to identify main sections
- Return section titles

**Output:**
```json
{
  "sections": ["Introduction", "Chapter 1", "Conclusion"]
}
```

---

### 5. **generate-note-from-document** (`/functions/v1/generate-note-from-document`)
**Purpose:** Generate AI note from document
**Input:**
```json
{
  "documentId": "uuid",
  "userProfile": { learning_style, learning_preferences },
  "selectedSection": "Chapter 1" (optional)
}
```
**Logic:**
- Fetch document content
- Extract specific section if provided
- Build prompt based on user learning style
- Generate structured note via Gemini
- Generate AI summary
- Return note data

**Output:**
```json
{
  "title": "Note Title",
  "content": "# Note Content...",
  "aiSummary": "Summary..."
}
```

---

### 6. **generate-quiz** (`/functions/v1/generate-quiz`)
**Purpose:** Generate quiz from recording transcript
**Input:**
```json
{
  "transcript": "...",
  "numQuestions": 10,
  "difficulty": "intermediate"
}
```
**Logic:**
- Build prompt for quiz generation
- Generate questions via Gemini
- Parse questions (Q&A format with options)
- Return quiz data

**Output:**
```json
{
  "questions": [
    {
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 1,
      "explanation": "Because..."
    }
  ]
}
```

---

### 7. **generate-summary** (`/functions/v1/generate-summary`)
**Purpose:** Generate AI summary of note content
**Input:**
```json
{
  "content": "note content",
  "userProfile": { learning_style, learning_preferences }
}
```
**Logic:**
- Build prompt based on learning style
- Generate concise summary via Gemini
- Return summary

**Output:**
```json
{
  "summary": "..."
}
```

---

### 8. **image-analyzer** (`/functions/v1/image-analyzer`)
**Purpose:** Analyze images for AI chat
**Input:**
```json
{
  "message": "What's in this image?",
  "images": [
    {
      "mimeType": "image/jpeg",
      "data": "base64"
    }
  ]
}
```
**Logic:**
- Use Gemini vision to analyze images
- Generate descriptive response
- Return analysis

**Output:**
```json
{
  "response": "This image shows..."
}
```

---

## 🔄 Real-time Features (Supabase Realtime)

### 1. **Social Notifications**
- Subscribe to `social_notifications` table
- Filter by `user_id = currentUser.id`
- On INSERT: Show toast notification, update unread count
- On UPDATE (read): Update UI

### 2. **Chat Messages**
- Subscribe to `chat_messages` table
- Filter by `session_id = activeChatSessionId`
- On INSERT: Append message to chat UI (if from other device/tab)

### 3. **Audio Processing Jobs**
- Poll `audio_processing_results` table every 5 seconds
- Check status (pending → processing → completed/error)
- Update UI when completed

---

## 🎨 Design System

### Colors (HSL format)
```css
/* Light Mode */
--primary: 217 91% 60% /* Blue */
--secondary: 142 76% 36% /* Green */
--accent: 38 92% 50% /* Orange */
--danger: 0 84% 60% /* Red */
--background: 0 0% 100% /* White */
--foreground: 222 47% 11% /* Dark Gray */

/* Dark Mode */
--primary: 217 91% 60% /* Blue */
--secondary: 142 76% 36% /* Green */
--accent: 38 92% 50% /* Orange */
--danger: 0 84% 60% /* Red */
--background: 222 47% 11% /* Dark Gray */
--foreground: 0 0% 100% /* White */
```

### Typography
- **Headings:** Bold, 2xl-4xl font size
- **Body:** Regular, base font size
- **Captions:** Small, 0.875rem

### Spacing
- Use 4px base unit (1 = 4px, 2 = 8px, 4 = 16px, 6 = 24px, 8 = 32px)

### Components
- **Cards:** Rounded corners (8px), shadow, padding
- **Buttons:** Rounded (6px), primary/secondary/outline variants
- **Inputs:** Border, focus ring, rounded (6px)
- **Badges:** Small, rounded-full, colored background

---

## 🔐 Authentication & Security

### Row Level Security (RLS) Policies

#### Example for `notes` table:
```sql
-- Users can view their own notes
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own notes
CREATE POLICY "Users can create own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);
```

Apply similar policies to all user-specific tables.

---

## 📦 File Storage (Supabase Storage)

### Buckets:
1. **avatars** (public): User profile pictures
2. **documents** (private): Uploaded documents
3. **audio** (private): Audio recordings
4. **social-media** (public): Social post images/videos

### Storage Policies:
- Users can upload to their own folders (UUID-based)
- Public buckets: Anyone can read
- Private buckets: Only owner can read/write

---

## 🚀 Implementation Checklist

### Phase 1: Foundation
- [ ] Set up Supabase project
- [ ] Create database schema (all tables)
- [ ] Set up RLS policies
- [ ] Create storage buckets + policies
- [ ] Deploy edge functions
- [ ] Test edge functions

### Phase 2: Authentication
- [ ] Landing page with hero, features, testimonials
- [ ] Auth screen (login/signup)
- [ ] Password reset flow
- [ ] Profile creation
- [ ] Protected routes

### Phase 3: Core Features
- [ ] Dashboard with stats, analytics, quick actions
- [ ] Notes tab with editor, AI features
- [ ] Documents tab with upload, folders, preview
- [ ] Recordings tab with recording, processing, quiz
- [ ] Schedule tab with CRUD operations
- [ ] Settings tab with profile, learning, security

### Phase 4: AI Chat
- [ ] Chat sessions management
- [ ] Message input with file attachments
- [ ] AI streaming response
- [ ] Document/note selector
- [ ] Folder context integration
- [ ] Message rendering (markdown, diagrams, code)

### Phase 5: Social Features
- [ ] Social feed with posts
- [ ] Create/edit/delete posts
- [ ] Like, comment, share, bookmark
- [ ] Follow/unfollow users
- [ ] Groups (create, join, leave)
- [ ] Notifications
- [ ] User profiles

### Phase 6: Polish
- [ ] Dark mode
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states, skeletons
- [ ] Error handling, toasts
- [ ] Animations, transitions
- [ ] Performance optimization (lazy loading, caching)
- [ ] Accessibility (ARIA labels, keyboard navigation)

---

## 🧪 Testing Requirements

### Unit Tests:
- Edge functions logic
- Utility functions (date formatting, file validation)
- Component rendering

### Integration Tests:
- Auth flow (login, signup, logout)
- CRUD operations (notes, documents, recordings, schedule)
- AI features (chat, summary, quiz generation)
- Social features (posts, comments, follows)

### E2E Tests:
- Complete user flows (signup → create note → generate AI summary)
- File upload flows
- Chat flows

---

## 📊 Performance Targets

- **Initial Load:** < 3 seconds
- **Page Transitions:** < 500ms
- **AI Response Time:** < 5 seconds (streaming starts < 2s)
- **File Upload:** Progress indicator, < 30s for 25MB file
- **Search:** < 200ms

---

## 🌐 Deployment

### Frontend:
- Deploy to Vercel / Netlify / App Store / Play Store
- Environment variables: SUPABASE_URL, SUPABASE_ANON_KEY

### Backend (Supabase):
- Auto-deployed via Supabase CLI
- Edge functions deployed individually

---

## 📚 Documentation to Reference

### Key Technologies:
- **Supabase Docs:** https://supabase.com/docs
- **Gemini AI:** https://ai.google.dev/gemini-api/docs
- **React Native:** https://reactnative.dev/docs
- **Flutter:** https://flutter.dev/docs

---

## 🎯 Key Differentiators

1. **AI-Powered Learning:**
   - Personalized note generation based on learning style
   - AI chat with contextual understanding
   - Automatic quiz generation
   - Smart summaries and translations

2. **Document Intelligence:**
   - Extract text from any document type
   - Folder-based context (like NotebookLM)
   - AI analysis and insights

3. **Audio Processing:**
   - Record or upload lectures
   - AI transcription and summarization
   - Generate notes and quizzes from audio

4. **Social Learning:**
   - Connect with peers
   - Share knowledge
   - Collaborative groups

5. **Unified Platform:**
   - All-in-one: notes, documents, recordings, schedule, chat, social
   - Seamless integration between features
   - Mobile-first design

---

## 💡 Additional Notes

- **Offline Support:** Implement local caching for notes, documents (read-only when offline)
- **Push Notifications:** Social notifications, schedule reminders
- **Widgets:** Today's schedule, recent notes
- **Dark Mode:** Full support with system preference detection
- **Accessibility:** Screen reader support, large text, keyboard navigation
- **Analytics:** Track user engagement, feature usage (privacy-compliant)

---

**That's it!** This prompt covers every screen, feature, database table, edge function, and implementation detail you need to build the mobile version of StuddyHub. Let me know if you need any clarification or additional details! 🚀
