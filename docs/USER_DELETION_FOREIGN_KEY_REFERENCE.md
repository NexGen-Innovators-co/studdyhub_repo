-- ============================================================
-- User ID Foreign Key References Across All Tables
-- For implementing safe user deletion with cascading deletes
-- ============================================================

-- DIRECT AUTH.USERS(ID) REFERENCES
-- These tables directly reference auth.users(id) and need CASCADE on DELETE

1. ACHIEVEMENTS
   - user_id → auth.users(id)
   - Action: DELETE CASCADE

2. ADMIN_USERS
   - user_id → auth.users(id) [UNIQUE - one admin per user]
   - created_by → auth.users(id)
   - Action: DELETE CASCADE

3. AI_PODCASTS
   - user_id → auth.users(id)
   - Action: DELETE CASCADE

4. AI_USER_MEMORY
   - user_id → auth.users(id)
   - Action: DELETE CASCADE

5. APP_RATINGS
   - user_id → auth.users(id) [UNIQUE - one rating per user]
   - Action: DELETE CASCADE

6. APP_TESTIMONIALS
   - user_id → auth.users(id) [UNIQUE - one testimonial per user]
   - Action: DELETE CASCADE

7. AUDIO_PROCESSING_RESULTS
   - user_id → auth.users(id) [DEFAULT auth.uid()]
   - Action: DELETE CASCADE

8. CALENDAR_INTEGRATIONS
   - user_id → auth.users(id)
   - Action: DELETE CASCADE

9. CONTENT_MODERATION_LOG
   - user_id → auth.users(id)
   - Action: DELETE CASCADE

10. CONTENT_MODERATION_QUEUE
    - reported_by → auth.users(id)
    - Action: DELETE CASCADE

11. COURSES
    - created_by → auth.users(id)
    - Action: SET NULL or DELETE CASCADE (depends on if courses are deleted)

12. DAILY_NOTIFICATION_LOG
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

13. DOCUMENT_FOLDERS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

14. FLASHCARDS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

15. INSTITUTION_INVITES
    - invited_by → auth.users(id)
    - Action: DELETE CASCADE

16. INSTITUTION_MEMBERS
    - user_id → auth.users(id)
    - invited_by → auth.users(id)
    - Action: DELETE CASCADE

17. LEARNING_TOPIC_CONNECTIONS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

18. LIVE_QUIZ_ANSWERS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

19. LIVE_QUIZ_PLAYERS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

20. LIVE_QUIZ_SESSIONS
    - host_user_id → auth.users(id)
    - Action: DELETE CASCADE or SET NULL

21. NOTIFICATION_PREFERENCES
    - user_id → auth.users(id) [PRIMARY KEY]
    - Action: DELETE CASCADE

22. NOTIFICATION_SUBSCRIPTIONS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

23. NOTIFICATIONS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

24. PLATFORM_UPDATE_READS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

25. PLATFORM_UPDATES
    - created_by → auth.users(id)
    - updated_by → auth.users(id)
    - Action: SET NULL (preserve update history)

26. PODCAST_CREDIT_TRANSACTIONS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE or RESTRICT (preserve transaction history)

27. PODCAST_CREDITS
    - user_id → auth.users(id) [UNIQUE - one credit account per user]
    - Action: DELETE CASCADE or SET NULL

28. PODCAST_INVITES
    - inviter_id → auth.users(id)
    - invitee_id → auth.users(id)
    - Action: DELETE CASCADE

29. PODCAST_LISTENERS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

30. PODCAST_MEMBERS
    - user_id → auth.users(id)
    - invited_by → auth.users(id)
    - Action: DELETE CASCADE

31. PODCAST_SHARES
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

32. PROFILES
    - id → auth.users(id) [PRIMARY KEY]
    - role_verified_by → auth.users(id)
    - Action: DELETE CASCADE (delete profile when user deleted)

33. QUIZ_ATTEMPTS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

34. ROLE_VERIFICATION_REQUESTS
    - user_id → auth.users(id)
    - reviewed_by → auth.users(id)
    - Action: DELETE CASCADE

35. SCHEMA_AGENT_AUDIT
    - user_id → auth.users(id)
    - Action: DELETE CASCADE or RESTRICT (preserve audit history)

36. SOCIAL_USERS
    - id → auth.users(id) [PRIMARY KEY]
    - Action: DELETE CASCADE (delete social user when auth user deleted)

37. SOCIAL_POST_VIEWS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

38. SUBSCRIPTIONS
    - user_id → auth.users(id) [UNIQUE - one subscription per user]
    - Action: DELETE CASCADE

39. SYSTEM_ERROR_LOGS
    - user_id → auth.users(id)
    - resolved_by → auth.users(id)
    - Action: SET NULL (preserve error history)

40. SYSTEM_SETTINGS
    - updated_by → auth.users(id)
    - Action: SET NULL (preserve settings history)

41. USER_ACTIVITY_TRACKING
    - user_id → auth.users(id) [UNIQUE - one tracking record per user]
    - Action: DELETE CASCADE

42. USER_EDUCATION_PROFILES
    - user_id → auth.users(id) [UNIQUE - one education profile per user]
    - Action: DELETE CASCADE

43. USER_LEARNING_GOALS
    - user_id → auth.users(id)
    - Action: DELETE CASCADE

44. USER_STATS
    - user_id → auth.users(id) [PRIMARY KEY]
    - Action: DELETE CASCADE


-- INDIRECT REFERENCES VIA PROFILES(ID)
-- These reference profiles(id), which itself references auth.users(id)
-- When user is deleted, profiles cascade delete, which cascades to these

45. CHAT_MESSAGES
    - user_id → profiles(id)
    - Cascade: Deletes when profile deleted

46. CLASS_RECORDINGS
    - user_id → profiles(id)
    - Cascade: Deletes when profile deleted

47. COURSE_ENROLLMENTS
    - user_id → profiles(id)
    - Cascade: Deletes when profile deleted

48. COURSE_RESOURCES
    - created_by → profiles(id)
    - Cascade: Deletes when profile deleted

49. NOTES
    - user_id → profiles(id)
    - Cascade: Deletes when profile deleted

50. QUIZZES
    - user_id → profiles(id)
    - Cascade: Deletes when profile deleted

51. SCHEDULE_ITEMS
    - user_id → profiles(id)
    - Cascade: Deletes when profile deleted


-- INDIRECT REFERENCES VIA SOCIAL_USERS(ID)
-- These reference social_users(id), which itself references auth.users(id)
-- When user is deleted, social_users cascade delete, which cascades to these

52. SOCIAL_BOOKMARKS
    - user_id → social_users(id)
    - Cascade: Deletes when social_users deleted

53. SOCIAL_CHAT_MESSAGE_READS
    - user_id → social_users(id)
    - Cascade: Deletes when social_users deleted

54. SOCIAL_CHAT_MESSAGES
    - sender_id → social_users(id)
    - Cascade: Deletes when social_users deleted

55. SOCIAL_COMMENTS
    - author_id → social_users(id)
    - Cascade: Deletes when social_users deleted

56. SOCIAL_EVENT_ATTENDEES
    - user_id → social_users(id)
    - Cascade: Deletes when social_users deleted

57. SOCIAL_EVENTS
    - organizer_id → social_users(id)
    - Cascade: Deletes when social_users deleted

58. SOCIAL_FOLLOWS
    - follower_id → social_users(id)
    - following_id → social_users(id)
    - Cascade: Deletes when social_users deleted

59. SOCIAL_GROUP_MEMBERS
    - user_id → social_users(id)
    - Cascade: Deletes when social_users deleted

60. SOCIAL_GROUPS
    - created_by → social_users(id)
    - Cascade: Deletes when social_users deleted

61. SOCIAL_LIKES
    - user_id → social_users(id)
    - Cascade: Deletes when social_users deleted

62. SOCIAL_NOTIFICATIONS
    - user_id → social_users(id)
    - actor_id → social_users(id)
    - Cascade: Deletes when social_users deleted

63. SOCIAL_REPORTS
    - reporter_id → social_users(id)
    - reported_user_id → social_users(id)
    - moderator_id → social_users(id)
    - Cascade: Deletes when social_users deleted

64. SOCIAL_SHARES
    - user_id → social_users(id)
    - Cascade: Deletes when social_users deleted

65. SOCIAL_USER_SIGNALS
    - user_id → social_users(id)
    - Cascade: Deletes when social_users deleted


-- SPECIAL CASES & CONSIDERATIONS

UNIQUE CONSTRAINTS (one per user):
- admin_users.user_id
- app_ratings.user_id
- app_testimonials.user_id
- notification_preferences.user_id [PRIMARY KEY]
- podcast_credits.user_id
- profiles.id [PRIMARY KEY]
- social_users.id [PRIMARY KEY]
- subscriptions.user_id
- user_activity_tracking.user_id
- user_education_profiles.user_id
- user_stats.user_id

CASCADE VS SET NULL DECISION:
- CASCADE: Use for content created by user (notes, podcasts, quizzes)
- SET NULL: Use for audit/history (who created/updated something, but want to keep record)
  - platform_updates.created_by/updated_by
  - system_error_logs.resolved_by
  - system_settings.updated_by
  - schema_agent_audit (consider RESTRICT to preserve)
  - podcast_credit_transactions (consider RESTRICT to preserve)

PRESERVE HISTORY (RESTRICT or SET NULL):
- schema_agent_audit
- podcast_credit_transactions
- system_error_logs
- Any audit/logging tables


-- ============================================================
-- DELETION STRATEGY
-- ============================================================

DELETE ORDER (respecting foreign key dependencies):
1. Delete from auth.users (with ON DELETE CASCADE set on all FKs)
2. Supabase automatically cascades to:
   - All direct auth.users(id) references (achievements, admin_users, etc.)
   - profiles.id → cascades to profiles and all profile-dependent tables
   - social_users.id → cascades to social_users and all social-dependent tables

-- Or use Supabase Auth Admin API:
DELETE FROM auth.users WHERE id = 'user-uuid' CASCADE;

-- The key is ensuring ON DELETE CASCADE is set on ALL foreign keys above
