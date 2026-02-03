# Live Quiz (Kahoot-Style) Feature - Technical Plan

This document outlines the architecture and implementation plan for the real-time, multiplayer quiz feature (Kahoot-style) in StuddyHub, powered by Supabase Edge Functions.

## Overview
- Real-time, competitive quiz sessions where multiple users join, answer questions, and compete on a live leaderboard.
- All backend logic is implemented as Supabase Edge Functions for low latency and seamless integration with Supabase Auth and Database.

## Implementation Plan

### 1. Session Management
- **Create Session:** Host creates a session for a quiz, generates a join code, inserts into `live_quiz_sessions`.
- **Join Session:** Player joins with join code, inserts into `live_quiz_players`.
- **Start Session:** Host starts the session, updates status, sets `start_time`.

### 2. Question Flow
- **Fetch Current Question:** Return the current question for the session.
- **Advance to Next Question:** Host triggers next question, updates `live_quiz_questions`, sets timers.

### 3. Answer Handling
- **Submit Answer:** Player submits answer, inserts into `live_quiz_answers`, checks correctness, updates score.
- **Lock Answers:** After timer, lock question, prevent further answers.

### 4. Real-Time State
- **Session State:** Return session info, current question, player list, leaderboard, answer stats.
- **Player State:** Return player’s progress, score, and answer status.

### 5. Security & Policies
- Enforce RLS policies for all DB access.
- Validate host/player roles for sensitive actions.

### 6. Real-Time Events (Optional)
- Use Supabase Realtime to broadcast session, question, and leaderboard updates to clients.

### 7. Edge Function Endpoints
- `POST /create-session`
- `POST /join-session`
- `POST /start-session`
- `POST /advance-question`
- `POST /submit-answer`
- `GET /session-state`
- `GET /player-state`

### 8. Error Handling & Validation
- Validate all inputs (IDs, join codes, roles).
- Handle edge cases (duplicate joins, late answers, session not found).

### 9. Testing
- Unit and integration tests for all endpoints.
- Simulate real-time quiz flow with multiple players.

---

For more details, see the Supabase Edge Function implementation in `supabase/functions/live-quiz/index.ts`.
