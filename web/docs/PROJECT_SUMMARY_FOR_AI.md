# StuddyHub Project Summary

## 1. Project Overview
StuddyHub is an AI-powered learning platform designed to help students organize notes, understand study material faster, and learn collaboratively. It combines intelligent note-taking, document intelligence, lecture transcription, quiz generation, social learning, and AI chat assistance into one education ecosystem.

## 2. Mission
Make quality education more accessible, engaging, and effective for students by transforming their existing study materials into personalized learning tools.

## 3. Target Problem
Students struggle with:
- Disorganized notes and scattered study content
- Slow revision workflows across documents, recordings, and chats
- Low retention and poor exam preparation
- Lack of affordable, AI-driven study support

## 4. Core Solution
StuddyHub solves these problems by:
- Turning notes, documents, and recordings into AI summaries, quizzes, and personalized study recommendations
- Providing a single workspace for notes, documents, chat, podcasts, and study schedules
- Enabling collaboration through social learning features and shared study groups
- Supporting students with AI-powered insights and exam preparation tools

## 5. Key Product Features
### Smart Note-Taking
- Rich text editor with markdown support
- AI-enhanced suggestions, summaries, and improvements
- Folder organization and note export (PDF/Markdown/HTML)
- Real-time sync across devices

### Document Intelligence
- Support for PDF, DOCX, images, and other text formats
- AI-based content extraction and summarization
- Smart search across documents and notes
- OCR for image text extraction

### Lecture Recording & Transcription
- Audio recording capture for lectures and meetings
- AI-powered transcription with Gemini
- Speaker detection and duration tracking
- Storage management for recordings

### AI Study Assistant
- Context-aware chat that understands notes, documents, and user history
- Personalized learning recommendations for different study styles
- Instant answers and study topic suggestions
- Token-based usage control per subscription tier

### Quiz Generation
- Automatic generation of quizzes from notes and documents
- Multiple question types: MCQ, True/False, Short Answer
- Daily quiz tracking and performance analytics
- Difficulty levels from beginner to advanced

### Social Learning
- Student connections and study groups
- Post sharing and discussion
- AI-powered feed ranking and user recommendations
- Activity-based engagement notifications

### Audio / Podcast Generation
- AI-powered podcast creation from study content
- Shareable audio summaries with transcripts
- Podcast discovery and social sharing

### Live Quiz / Study Session Support
- Kahoot-style live quiz sessions
- Real-time multiplayer competition and leaderboard
- Host controls and join-code workflow
- Low-latency Edge Function backend architecture

## 6. AI and Technology Platform
### AI Integration
- Google Gemini used across the platform for chat, document extraction, audio processing, quiz generation, and image generation
- Model fallback chain includes Gemini variants plus OpenRouter fallback for reliability
- AI features are implemented primarily in Supabase Edge Functions

### Core Technologies
- Frontend: React, Vite, TypeScript
- Backend / Infrastructure: Supabase, Supabase Edge Functions, Postgres
- AI Platform: Google Gemini API, OpenRouter fallback
- Payments: Paystack integration using Ghana Cedi (GHS)

## 7. Business Model
### Subscription Tiers
- **Visitor (Free)**: GHS 0/month; limited notes, documents, AI messages, recordings, quizzes, and no social features
- **Scholar**: GHS 20/month; unlimited notes, expanded documents, AI messages, recordings, daily quizzes, social features, exam mode
- **Genius**: GHS 50/month; unlimited documents and recordings, unlimited quizzes, priority support, verified badge, early access

### Revenue Approach
- Monthly subscriptions for individual students
- Premium AI feature access for paid tiers
- Future potential for institutional licensing and school partnerships

## 8. Architecture Summary
### Frontend
- `src/`: main React application
- `src/components/`: reusable UI and feature-specific components
- `src/modules/`: feature areas like notes, quizzes, podcasts, social, subscription, onboarding
- `src/services/`: business logic and AI integration services
- `src/hooks/`: custom hooks for auth, subscription, data fetching, feature gating

### Backend / AI Pipeline
- `supabase/functions/`: Supabase Edge Functions for AI workflows and user APIs
- `supabase/functions/_shared/`: shared utilities for AI prompts, education context, fallback handling
- `supabase/functions/utils/gemini.ts`: shared Gemini helper and model fallback logic
- `supabase/functions/gemini-chat/`, `gemini-document-extractor/`, `gemini-audio-processor/`: core Gemini-powered service endpoints
- `supabase/functions/ai-rank-feed/`, `get-social-feed/`, `get-suggested-users/`: AI-personalized social feed and recommendations

### Database & Auth
- Supabase Postgres stores users, notes, documents, quizzes, subscriptions, social posts, and activity data
- Supabase Auth handles user accounts and secure API access

## 9. Important Files and Entry Points
- `README.md`: main project description and setup guide
- `manifest.json`: app metadata and PWA settings
- `src/modules/notes/`: note-taking feature implementation
- `src/modules/quizzes/`: quiz generation and learning workflows
- `src/modules/social/`: social learning and feed components
- `supabase/functions/`: AI functionality and backend integration
- `supabase/functions/utils/gemini.ts`: reusable Gemini AI helper

## 10. Setup and Deployment
### Development
- Requires Node.js 18+, npm/yarn/bun, Supabase account, and Google Gemini API key
- Install dependencies: `npm install` or `yarn install`
- Run dev server: `npm run dev`
- Local frontend served at `http://localhost:5173`

### Supabase Configuration
- Link project with `npx supabase link --project-ref <project-ref>`
- Push DB schema with `npx supabase db push`
- Deploy Edge Functions with `npx supabase functions deploy`

### Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`
- `VITE_APP_URL`
- `VITE_APP_NAME`

## 11. Impact and Competitive Positioning
StuddyHub is positioned as an education-first AI platform that targets Quality Education (UN SDG 4). It is designed for emerging markets and student communities that need affordable, intelligent study tools. The platform differentiates by combining AI note intelligence, document extraction, quiz generation, social learning, and live study experiences.

## 12. Best Use for AI Understanding
Share this document with the AI to help it understand:
- the project mission and student pain points
- the full feature set and AI-powered workflows
- how the app uses Google Gemini for chat, docs, quizzes, and audio
- the subscription-driven business model
- the repository structure and where key services live

---

_End of project summary for StuddyHub._
