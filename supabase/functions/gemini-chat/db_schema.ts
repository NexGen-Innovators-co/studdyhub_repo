export const DB_SCHEMA_DEFINITION = `
DATABASE SCHEMA DEFINITION

Allowed Tables & Operations:
You may perform INSERT, UPDATE, DELETE, and SELECT operations on the following tables.

1. achievements
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - badge_id: uuid (fk -> badges)
   - earned_at: timestamp

2. admin_activity_logs
   - id: uuid (pk)
   - admin_id: uuid (fk -> admin_users)
   - action: text
   - target_type: text
   - target_id: uuid
   - details: jsonb
   - ip_address: inet
   - user_agent: text
   - created_at: timestamp

3. admin_system_settings
   - id: uuid (pk)
   - key: text
   - value: jsonb
   - description: text
   - category: text
   - is_public: boolean
   - updated_by: uuid (fk -> admin_users)
   - created_at: timestamp
   - updated_at: timestamp

4. admin_users
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - email: text
   - role: admin_role
   - permissions: jsonb
   - is_active: boolean
   - created_at: timestamp
   - updated_at: timestamp
   - last_login: timestamp
   - created_by: uuid

5. ai_podcasts
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - title: text
   - sources: text[]
   - script: text
   - audio_segments: jsonb
   - duration_minutes: integer
   - style: text (casual, educational, deep-dive)
   - status: text (processing, completed, failed)
   - error_message: text
   - created_at: timestamp
   - updated_at: timestamp
   - is_public: boolean
   - is_live: boolean
   - live_started_at: timestamp
   - cover_image_url: text
   - description: text
   - tags: text[]
   - listen_count: integer
   - share_count: integer
   - podcast_type: text
   - visual_assets: jsonb

6. ai_user_memory
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - fact_type: text
   - fact_key: text
   - fact_value: jsonb
   - confidence_score: numeric
   - source_session_id: uuid (fk -> chat_sessions)
   - last_referenced: timestamp
   - referenced_count: integer
   - created_at: timestamp

7. app_stats
   - id: uuid (pk)
   - active_users: text
   - notes_processed: text
   - uptime: text
   - user_rating: text
   - updated_at: timestamp

8. audio_processing_results
   - id: uuid (pk)
   - file_url: text
   - transcript: text
   - summary: text
   - translated_content: text
   - status: text
   - error_message: text
   - target_language: text
   - created_at: timestamp
   - updated_at: timestamp
   - user_id: uuid
   - document_id: uuid (fk -> documents)

9. badges
   - id: uuid (pk)
   - name: text
   - description: text
   - icon: text
   - requirement_type: text
   - requirement_value: integer
   - xp_reward: integer
   - created_at: timestamp

10. calendar_integrations
    - id: uuid (pk)
    - user_id: uuid (fk -> auth.users)
    - provider: text
    - access_token: text
    - refresh_token: text
    - expires_at: timestamp
    - calendar_id: text
    - sync_enabled: boolean
    - last_synced_at: timestamp
    - created_at: timestamp
    - updated_at: timestamp

11. chat_messages
    - id: uuid (pk)
    - user_id: uuid
    - content: text
    - role: message_role
    - timestamp: timestamp
    - session_id: uuid
    - is_error: boolean
    - image_url: text
    - attached_document_ids: text[]
    - attached_note_ids: text[]
    - image_mime_type: text
    - has_been_displayed: boolean
    - conversation_context: text
    - files_metadata: jsonb[]

12. chat_sessions
    - id: uuid (pk)
    - user_id: uuid
    - title: text
    - created_at: timestamp
    - updated_at: timestamp
    - document_ids: text[]
    - last_message_at: timestamp
    - message_count: integer
    - context_summary: text
    - last_summary_update: integer
    - memory_strategy: text
    - context_size_bytes: integer
    - default_folder_id: uuid (fk -> document_folders)
    - token_count: integer

13. class_recordings
    - id: uuid (pk)
    - user_id: uuid
    - title: text
    - audio_url: text
    - transcript: text
    - summary: text
    - duration: integer
    - subject: text
    - date: timestamp
    - created_at: timestamp
    - document_id: uuid (fk -> documents)
    - updated_at: timestamp
    - processing_status: text
    - processing_error: text

14. content_moderation_log
    - id: uuid (pk)
    - user_id: uuid
    - content_preview: text
    - content_type: text
    - decision: text
    - reason: text
    - confidence: double precision
    - ai_analysis: jsonb
    - educational_score: double precision
    - category: text
    - topics: text[]
    - created_at: timestamp

15. content_moderation_queue
    - id: uuid (pk)
    - content_type: text
    - content_id: uuid
    - reported_by: uuid
    - reason: text
    - status: text
    - moderator_id: uuid
    - moderator_notes: text
    - priority: integer
    - created_at: timestamp
    - resolved_at: timestamp

16. course_materials
    - id: uuid (pk)
    - course_id: uuid (fk -> courses)
    - document_id: uuid (fk -> documents)
    - title: text
    - description: text
    - category: text
    - downloads_count: integer
    - created_at: timestamp

17. courses
    - id: uuid (pk)
    - code: text
    - title: text
    - description: text
    - level: integer
    - semester: integer
    - department: text
    - created_at: timestamp
    - school_name: text

18. document_folder_items
    - id: uuid (pk)
    - folder_id: uuid (fk -> document_folders)
    - document_id: uuid (fk -> documents)
    - added_at: timestamp

19. document_folders
    - id: uuid (pk)
    - user_id: uuid
    - name: text
    - parent_folder_id: uuid (fk -> document_folders)
    - color: text
    - description: text
    - created_at: timestamp
    - updated_at: timestamp

20. documents
    - id: uuid (pk)
    - user_id: uuid
    - title: text
    - file_name: text
    - file_url: text
    - file_type: text
    - file_size: integer
    - content_extracted: text
    - created_at: timestamp
    - updated_at: timestamp
    - type: text
    - processing_error: text
    - processing_status: text
    - folder_ids: uuid[]
    - is_public: boolean

21. error_logs
    - id: integer (pk)
    - error_message: text
    - error_time: timestamp

22. failed_chunks
    - id: uuid (pk)
    - document_id: uuid (fk -> documents)
    - chunk_index: integer
    - chunk_base64: text
    - file_type: text
    - error_message: text
    - created_at: timestamp

23. flashcards
    - id: uuid (pk)
    - user_id: uuid
    - note_id: uuid (fk -> notes)
    - front: text
    - back: text
    - category: text
    - difficulty: text
    - hint: text
    - review_count: integer
    - last_reviewed_at: timestamp
    - next_review_at: timestamp
    - ease_factor: numeric
    - interval_days: integer
    - created_at: timestamp
    - updated_at: timestamp

24. learning_topic_connections
    - id: uuid (pk)
    - user_id: uuid
    - from_session_id: uuid
    - to_session_id: uuid
    - topic: text
    - connection_strength: numeric
    - created_at: timestamp

25. notes
    - id: uuid (pk)
    - user_id: uuid
    - title: text
    - content: text
    - category: text
    - tags: text[]
    - ai_summary: text
    - created_at: timestamp
    - updated_at: timestamp
    - document_id: uuid (fk -> documents)

26. notification_preferences
    - user_id: uuid (pk)
    - push_notifications: boolean
    - email_notifications: boolean
    - schedule_reminders: boolean
    - quiz_reminders: boolean
    - assignment_reminders: boolean
    - social_notifications: boolean
    - quiet_hours_enabled: boolean
    - quiet_hours_start: time
    - quiet_hours_end: time
    - reminder_time: integer
    - created_at: timestamp
    - updated_at: timestamp

27. notification_subscriptions
    - id: uuid (pk)
    - user_id: uuid
    - endpoint: text
    - p256dh: text
    - auth: text
    - device_type: text
    - browser: text
    - created_at: timestamp
    - updated_at: timestamp

28. notifications
    - id: uuid (pk)
    - user_id: uuid
    - type: text
    - title: text
    - message: text
    - data: jsonb
    - read: boolean
    - read_at: timestamp
    - created_at: timestamp
    - expires_at: timestamp

29. podcast_invites
    - id: uuid (pk)
    - podcast_id: uuid (fk -> ai_podcasts)
    - inviter_id: uuid
    - invitee_id: uuid
    - invitee_email: text
    - role: text
    - status: text
    - message: text
    - expires_at: timestamp
    - created_at: timestamp
    - responded_at: timestamp

30. podcast_listeners
    - id: uuid (pk)
    - podcast_id: uuid
    - user_id: uuid
    - joined_at: timestamp
    - left_at: timestamp
    - is_active: boolean
    - created_at: timestamp
    - updated_at: timestamp

31. podcast_members
    - id: uuid (pk)
    - podcast_id: uuid
    - user_id: uuid
    - role: text
    - joined_at: timestamp
    - invited_by: uuid
    - created_at: timestamp

32. podcast_shares
    - id: uuid (pk)
    - podcast_id: uuid
    - user_id: uuid
    - share_type: text
    - platform: text
    - created_at: timestamp

33. profiles
    - id: uuid (pk)
    - email: text
    - full_name: text
    - avatar_url: text
    - created_at: timestamp
    - updated_at: timestamp
    - learning_style: text
    - learning_preferences: jsonb
    - username: text
    - quiz_preferences: jsonb
    - is_public: boolean
    - referral_code: text
    - referral_count: integer
    - points_balance: integer
    - bonus_ai_credits: integer
    - school: text

34. quiz_attempts
    - id: uuid (pk)
    - quiz_id: uuid (fk -> quizzes)
    - user_id: uuid
    - score: integer
    - total_questions: integer
    - percentage: integer
    - time_taken_seconds: integer
    - answers: jsonb
    - xp_earned: integer
    - created_at: timestamp

35. quizzes
    - id: uuid (pk)
    - user_id: uuid
    - class_id: uuid
    - title: text
    - questions: jsonb
    - created_at: timestamp
    - source_type: text

36. referrals
    - id: uuid (pk)
    - referrer_id: uuid
    - referee_id: uuid
    - status: text
    - reward_granted: boolean
    - created_at: timestamp

37. schedule_items
    - id: uuid (pk)
    - user_id: uuid
    - title: text
    - subject: text
    - type: schedule_item_type
    - start_time: timestamp
    - end_time: timestamp
    - location: text
    - description: text
    - color: text
    - created_at: timestamp
    - calendar_event_id: text
    - is_recurring: boolean
    - recurrence_pattern: text
    - recurrence_interval: integer
    - recurrence_days: text[]
    - recurrence_end_date: timestamp

38. schedule_reminders
    - id: uuid (pk)
    - schedule_id: uuid (fk -> schedule_items)
    - reminder_minutes: integer
    - notification_sent: boolean
    - notification_sent_at: timestamp
    - created_at: timestamp

39. schema_agent_audit
    - id: uuid (pk)
    - user_id: uuid
    - operation: text
    - table_name: text
    - query_intent: jsonb
    - success: boolean
    - error_message: text
    - execution_time_ms: integer
    - created_at: timestamp

40. social_bookmarks
    - id: uuid (pk)
    - user_id: uuid
    - post_id: uuid
    - created_at: timestamp

41. social_chat_message_media
    - id: uuid (pk)
    - message_id: uuid
    - type: text
    - url: text
    - filename: text
    - size_bytes: bigint
    - mime_type: text
    - created_at: timestamp

42. social_chat_message_reads
    - id: uuid (pk)
    - message_id: uuid
    - user_id: uuid
    - read_at: timestamp
    - created_at: timestamp

43. social_chat_message_resources
    - id: uuid (pk)
    - message_id: uuid
    - resource_id: uuid
    - resource_type: text
    - created_at: timestamp

44. social_chat_messages
    - id: uuid (pk)
    - group_id: uuid
    - sender_id: uuid
    - content: text
    - created_at: timestamp
    - session_id: uuid
    - is_read: boolean
    - read_at: timestamp
    - is_edited: boolean
    - updated_at: timestamp

45. social_chat_sessions
    - id: uuid (pk)
    - chat_type: text
    - group_id: uuid
    - user_id1: uuid
    - user_id2: uuid
    - last_message_at: timestamp
    - created_at: timestamp
    - updated_at: timestamp

46. social_comment_media
    - id: uuid (pk)
    - comment_id: uuid
    - type: text
    - url: text
    - filename: text
    - size_bytes: bigint
    - mime_type: text
    - created_at: timestamp

47. social_comments
    - id: uuid (pk)
    - post_id: uuid
    - author_id: uuid
    - content: text
    - parent_comment_id: uuid
    - likes_count: integer
    - created_at: timestamp
    - updated_at: timestamp

48. social_event_attendees
    - id: uuid (pk)
    - event_id: uuid
    - user_id: uuid
    - status: text
    - created_at: timestamp

49. social_events
    - id: uuid (pk)
    - title: text
    - description: text
    - group_id: uuid
    - organizer_id: uuid
    - start_date: timestamp
    - end_date: timestamp
    - location: text
    - is_online: boolean
    - max_attendees: integer
    - created_at: timestamp
    - updated_at: timestamp

50. social_follows
    - id: uuid (pk)
    - follower_id: uuid
    - following_id: uuid
    - created_at: timestamp

51. social_group_members
    - id: uuid (pk)
    - group_id: uuid
    - user_id: uuid
    - role: text
    - joined_at: timestamp
    - status: text

52. social_groups
    - id: uuid (pk)
    - name: text
    - description: text
    - avatar_url: text
    - cover_image_url: text
    - category: text
    - privacy: text
    - members_count: integer
    - posts_count: integer
    - created_by: uuid
    - created_at: timestamp
    - updated_at: timestamp

53. social_hashtags
    - id: uuid (pk)
    - name: text
    - posts_count: integer
    - created_at: timestamp

54. social_likes
    - id: uuid (pk)
    - user_id: uuid
    - post_id: uuid
    - comment_id: uuid
    - created_at: timestamp

55. social_media
    - id: uuid (pk)
    - post_id: uuid
    - type: text
    - url: text
    - thumbnail_url: text
    - filename: text
    - size_bytes: bigint
    - mime_type: text
    - created_at: timestamp

56. social_notifications
    - id: uuid (pk)
    - user_id: uuid
    - type: text
    - title: text
    - message: text
    - data: jsonb
    - is_read: boolean
    - created_at: timestamp
    - actor_id: uuid
    - post_id: uuid

57. social_post_hashtags
    - id: uuid (pk)
    - post_id: uuid
    - hashtag_id: uuid
    - created_at: timestamp

58. social_post_tags
    - id: uuid (pk)
    - post_id: uuid
    - tag_id: uuid
    - created_at: timestamp

59. social_post_views
    - id: uuid (pk)
    - post_id: uuid
    - user_id: uuid
    - viewed_at: timestamp

60. social_posts
    - id: uuid (pk)
    - author_id: uuid
    - content: text
    - privacy: text
    - group_id: uuid
    - likes_count: integer
    - comments_count: integer
    - shares_count: integer
    - bookmarks_count: integer
    - created_at: timestamp
    - updated_at: timestamp
    - views_count: integer
    - metadata: jsonb

61. social_reports
    - id: uuid (pk)
    - reporter_id: uuid
    - reported_user_id: uuid
    - post_id: uuid
    - comment_id: uuid
    - group_id: uuid
    - reason: text
    - description: text
    - status: text
    - moderator_id: uuid
    - created_at: timestamp
    - updated_at: timestamp

62. social_shares
    - id: uuid (pk)
    - user_id: uuid
    - original_post_id: uuid
    - share_text: text
    - created_at: timestamp

63. social_tags
    - id: uuid (pk)
    - name: text
    - created_at: timestamp

64. social_users
    - id: uuid (pk)
    - username: text
    - display_name: text
    - avatar_url: text
    - bio: text
    - interests: text[]
    - is_verified: boolean
    - is_contributor: boolean
    - followers_count: integer
    - following_count: integer
    - posts_count: integer
    - last_active: timestamp
    - created_at: timestamp
    - updated_at: timestamp
    - email: text
    - is_public: boolean

65. subscriptions
    - id: uuid (pk)
    - user_id: uuid
    - plan_type: text
    - status: text
    - current_period_end: timestamp
    - paystack_sub_code: text
    - paystack_customer_code: text
    - created_at: timestamp
    - updated_at: timestamp

66. system_settings
    - id: uuid (pk)
    - key: text
    - value: jsonb
    - description: text
    - updated_by: uuid
    - created_at: timestamp
    - updated_at: timestamp

67. user_learning_goals
    - id: uuid (pk)
    - user_id: uuid
    - goal_text: text
    - target_date: timestamp
    - progress: integer
    - category: text
    - is_completed: boolean
    - created_at: timestamp
    - updated_at: timestamp

68. user_stats
    - user_id: uuid (pk)
    - total_xp: integer
    - level: integer
    - current_streak: integer
    - longest_streak: integer
    - total_quizzes_attempted: integer
    - total_quizzes_completed: integer
    - average_score: numeric
    - total_study_time_seconds: integer
    - badges_earned: text[]
    - last_activity_date: timestamp
    - created_at: timestamp
    - updated_at: timestamp
    - weak_areas: text[]

69. audio_segments
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - segment_index: integer
   - transcript: text
   - summary: text
   - duration_seconds: double precision
   - audio_url: text
   - created_at: timestamp

70. live_quiz_answers
   - id: uuid (pk)
   - session_id: uuid (fk -> live_quiz_sessions)
   - user_id: uuid
   - question_id: uuid (fk -> live_quiz_questions)
   - selected_option: integer
   - is_correct: boolean
   - time_taken: double precision
   - points_awarded: integer
   - answered_at: timestamp

71. live_quiz_players
   - id: uuid (pk)
   - session_id: uuid (fk -> live_quiz_sessions)
   - user_id: uuid
   - display_name: text
   - score: integer
   - status: text
   - is_host: boolean
   - join_time: timestamp
   - last_answered_at: timestamp

72. live_quiz_questions
   - id: uuid (pk)
   - session_id: uuid (fk -> live_quiz_sessions)
   - question_text: text
   - options: jsonb
   - correct_answer: integer
   - time_limit: integer
   - question_index: integer
   - status: text

73. live_quiz_sessions
   - id: uuid (pk)
   - quiz_id: uuid (fk -> quizzes)
   - host_user_id: uuid
   - join_code: text
   - status: text
   - current_question_index: integer
   - start_time: timestamp
   - end_time: timestamp
   - created_at: timestamp

74. player_question_progress
   - id: uuid (pk)
   - session_id: uuid
   - user_id: uuid
   - question_idx: integer
   - status: text
   - time_spent: double precision
   - started_at: timestamp
   - completed_at: timestamp

75. podcast_chunks
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - chunk_index: integer
   - status: text
   - storage_path: text
   - created_at: timestamp

76. podcast_cohosts
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - user_id: uuid
   - is_active: boolean
   - permissions: text[]
   - created_at: timestamp

77. podcast_participation_requests
   - id: uuid (pk)
   - podcast_id: uuid
   - user_id: uuid
   - request_type: text
   - status: text
   - responder_id: uuid
   - responded_at: timestamp
   - created_at: timestamp

78. podcast_recordings
   - id: uuid (pk)
   - podcast_id: uuid
   - session_id: uuid
   - user_id: uuid
   - status: text
   - started_at: timestamp
   - ended_at: timestamp
   - duration_seconds: double precision
   - storage_path: text
   - final_audio_url: text

GUIDELINES:
- Always use the correct UUIDs when linking tables.
- For 'user_id', the system will automatically inject the authenticated user's ID, but you can include it if you have it.
- JSON fields like 'questions' in 'quizzes' should be strictly formatted.
- Respect table relationships (foreign keys).
`;
