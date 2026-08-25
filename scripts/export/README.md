# Export Files

Run each SQL query from `export-old-data.sql` in the OLD project's SQL Editor.
Save each result (click Download ⬇️) as the file listed below.

| # | Query | Save as |
|---|-------|---------|
| 1 | PROFILES | `profiles.json` |
| 2 | SOCIAL USERS | `social_users.json` |
| 3 | NOTES | `notes.json` |
| 4 | DOCUMENTS | `documents.json` |
| 5 | QUIZZES | `quizzes.json` |
| 6 | QUIZ ATTEMPTS | `quiz_attempts.json` |
| 7 | SCHEDULE ITEMS | `schedule_items.json` |
| 8 | CHAT SESSIONS | `chat_sessions.json` |
| 9 | USER STATS | `user_stats.json` |
| 10 | CLASS RECORDINGS | `class_recordings.json` |
| 11 | AI PODCASTS | `ai_podcasts.json` |
| 12 | FLASHCARDS | `flashcards.json` |
| 13 | SUBSCRIPTIONS | `subscriptions.json` |
| 14 | ACHIEVEMENTS | `achievements.json` |

After saving all files, run:
```bash
node scripts/import-data.js
```
