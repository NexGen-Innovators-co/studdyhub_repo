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
   - style: text
   - status: text
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
   - user_id: uuid (fk -> auth.users)
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
   - user_id: uuid (fk -> profiles)
   - content: text
   - role: message_role
   - timestamp: timestamp
   - session_id: uuid
   - is_error: boolean
   - image_url: text
   - attached_document_ids: uuid[]
   - attached_note_ids: uuid[]
   - image_mime_type: text
   - has_been_displayed: boolean
   - conversation_context: jsonb
   - files_metadata: jsonb[]
   - thinking_steps: jsonb

12. chat_sessions
   - id: uuid (pk)
   - user_id: uuid (fk -> profiles)
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
   - user_id: uuid (fk -> profiles)
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
   - user_id: uuid (fk -> auth.users)
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
   - moderator_id: uuid (fk -> admin_users)
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
   - institution_id: uuid (fk -> institutions)
   - created_by: uuid (fk -> profiles)
   - visibility: text
   - is_published: boolean
   - country_id: uuid (fk -> countries)
   - education_level_id: uuid (fk -> education_levels)
   - curriculum_id: uuid (fk -> curricula)

18. document_folder_items
   - id: uuid (pk)
   - folder_id: uuid (fk -> document_folders)
   - document_id: uuid (fk -> documents)
   - added_at: timestamp

19. document_folders
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - name: text
   - parent_folder_id: uuid (fk -> document_folders)
   - color: text
   - description: text
   - created_at: timestamp
   - updated_at: timestamp

20. documents
   - id: uuid (pk)
   - user_id: uuid (fk -> profiles)
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
   - processing_started_at: timestamp
   - processing_completed_at: timestamp
   - processing_metadata: jsonb
   - extraction_model_used: text
   - total_processing_time_ms: integer
   - folder_ids: uuid[]
   - extraction_progress: integer
   - continuation_attempt: integer
   - current_chunk: integer
   - total_chunks: integer
   - extraction_warning: text
   - is_public: boolean
   - folder_id: uuid

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
   - user_id: uuid (fk -> auth.users)
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
   - user_id: uuid (fk -> auth.users)
   - from_session_id: uuid (fk -> chat_sessions)
   - to_session_id: uuid (fk -> chat_sessions)
   - topic: text
   - connection_strength: numeric
   - created_at: timestamp

25. notes
   - id: uuid (pk)
   - user_id: uuid (fk -> profiles)
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
   - daily_categories: jsonb
   - preferred_notification_times: jsonb
   - max_notifications_per_day: integer
   - user_timezone: text

27. notification_subscriptions
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - endpoint: text
   - p256dh: text
   - auth: text
   - device_type: text
   - browser: text
   - created_at: timestamp
   - updated_at: timestamp

28. notifications
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
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
   - inviter_id: uuid (fk -> profiles)
   - invitee_id: uuid (fk -> profiles)
   - invitee_email: text
   - role: text
   - status: text
   - message: text
   - expires_at: timestamp
   - created_at: timestamp
   - responded_at: timestamp

30. podcast_listeners
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - user_id: uuid (fk -> auth.users)
   - joined_at: timestamp
   - left_at: timestamp
   - is_active: boolean
   - created_at: timestamp
   - updated_at: timestamp

31. podcast_members
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - user_id: uuid (fk -> auth.users)
   - role: text
   - joined_at: timestamp
   - invited_by: uuid (fk -> profiles)
   - created_at: timestamp

32. podcast_shares
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - user_id: uuid (fk -> auth.users)
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
   - personal_context: text
   - user_role: text
   - role_verified_at: timestamp
   - onboarding_completed: boolean
   - role_verification_status: text
   - role_verified_by: uuid
   - role_rejection_reason: text
   - institution_id: uuid (fk -> institutions)

34. quiz_attempts
   - id: uuid (pk)
   - quiz_id: uuid (fk -> quizzes)
   - user_id: uuid (fk -> auth.users)
   - score: integer
   - total_questions: integer
   - percentage: integer
   - time_taken_seconds: integer
   - answers: jsonb
   - xp_earned: integer
   - created_at: timestamp
   - live_results: jsonb

35. quizzes
   - id: uuid (pk)
   - user_id: uuid (fk -> profiles)
   - class_id: uuid (fk -> class_recordings)
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
   - user_id: uuid (fk -> profiles)
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
   - recurrence_days: integer[]
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
   - user_id: uuid (fk -> auth.users)
   - operation: text
   - table_name: text
   - query_intent: jsonb
   - success: boolean
   - error_message: text
   - execution_time_ms: integer
   - created_at: timestamp

40. social_bookmarks
   - id: uuid (pk)
   - user_id: uuid (fk -> social_users)
   - post_id: uuid (fk -> social_posts)
   - created_at: timestamp

41. social_chat_message_media
   - id: uuid (pk)
   - message_id: uuid (fk -> social_chat_messages)
   - type: text
   - url: text
   - filename: text
   - size_bytes: bigint
   - mime_type: text
   - created_at: timestamp

42. social_chat_message_reads
   - id: uuid (pk)
   - message_id: uuid (fk -> social_chat_messages)
   - user_id: uuid (fk -> profiles)
   - read_at: timestamp
   - created_at: timestamp

43. social_chat_message_resources
   - id: uuid (pk)
   - message_id: uuid (fk -> social_chat_messages)
   - resource_id: uuid
   - resource_type: text
   - created_at: timestamp

44. social_chat_messages
   - id: uuid (pk)
   - group_id: uuid (fk -> social_groups)
   - sender_id: uuid (fk -> social_users)
   - content: text
   - created_at: timestamp
   - session_id: uuid (fk -> social_chat_sessions)
   - is_read: boolean
   - read_at: timestamp
   - is_edited: boolean
   - updated_at: timestamp

45. social_chat_sessions
   - id: uuid (pk)
   - chat_type: text
   - group_id: uuid (fk -> social_groups)
   - user_id1: uuid (fk -> social_users)
   - user_id2: uuid (fk -> social_users)
   - last_message_at: timestamp
   - created_at: timestamp
   - updated_at: timestamp

46. social_comment_media
   - id: uuid (pk)
   - comment_id: uuid (fk -> social_comments)
   - type: text
   - url: text
   - filename: text
   - size_bytes: bigint
   - mime_type: text
   - created_at: timestamp

47. social_comments
   - id: uuid (pk)
   - post_id: uuid (fk -> social_posts)
   - author_id: uuid (fk -> social_users)
   - content: text
   - parent_comment_id: uuid (fk -> social_comments)
   - likes_count: integer
   - created_at: timestamp
   - updated_at: timestamp

48. social_event_attendees
   - id: uuid (pk)
   - event_id: uuid (fk -> social_events)
   - user_id: uuid (fk -> profiles)
   - status: text
   - created_at: timestamp

49. social_events
   - id: uuid (pk)
   - title: text
   - description: text
   - group_id: uuid (fk -> social_groups)
   - organizer_id: uuid (fk -> profiles)
   - start_date: timestamp
   - end_date: timestamp
   - location: text
   - is_online: boolean
   - max_attendees: integer
   - created_at: timestamp
   - updated_at: timestamp

50. social_follows
   - id: uuid (pk)
   - follower_id: uuid (fk -> social_users)
   - following_id: uuid (fk -> social_users)
   - created_at: timestamp

51. social_group_members
   - id: uuid (pk)
   - group_id: uuid (fk -> social_groups)
   - user_id: uuid (fk -> profiles)
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
   - created_by: uuid (fk -> social_users)
   - created_at: timestamp
   - updated_at: timestamp

53. social_hashtags
   - id: uuid (pk)
   - name: text
   - posts_count: integer
   - created_at: timestamp

54. social_likes
   - id: uuid (pk)
   - user_id: uuid (fk -> social_users)
   - post_id: uuid (fk -> social_posts)
   - comment_id: uuid (fk -> social_comments)
   - created_at: timestamp

55. social_media
   - id: uuid (pk)
   - post_id: uuid (fk -> social_posts)
   - type: text
   - url: text
   - thumbnail_url: text
   - filename: text
   - size_bytes: bigint
   - mime_type: text
   - created_at: timestamp

56. social_notifications
   - id: uuid (pk)
   - user_id: uuid (fk -> profiles)
   - type: text
   - title: text
   - message: text
   - data: jsonb
   - is_read: boolean
   - created_at: timestamp
   - actor_id: uuid (fk -> social_users)
   - post_id: uuid (fk -> social_posts)

57. social_post_hashtags
   - id: uuid (pk)
   - post_id: uuid (fk -> social_posts)
   - hashtag_id: uuid (fk -> social_hashtags)
   - created_at: timestamp

58. social_post_tags
   - id: uuid (pk)
   - post_id: uuid (fk -> social_posts)
   - tag_id: uuid (fk -> social_tags)
   - created_at: timestamp

59. social_post_views
   - id: uuid (pk)
   - post_id: uuid (fk -> social_posts)
   - user_id: uuid (fk -> auth.users)
   - viewed_at: timestamp

60. social_posts
   - id: uuid (pk)
   - author_id: uuid (fk -> social_users)
   - content: text
   - privacy: text
   - group_id: uuid (fk -> social_groups)
   - likes_count: integer
   - comments_count: integer
   - shares_count: integer
   - bookmarks_count: integer
   - created_at: timestamp
   - updated_at: timestamp
   - views_count: integer
   - metadata: jsonb
   - ai_categories: text[]
   - ai_sentiment: text
   - ai_quality_score: smallint

61. social_reports
   - id: uuid (pk)
   - reporter_id: uuid (fk -> social_users)
   - reported_user_id: uuid (fk -> social_users)
   - post_id: uuid (fk -> social_posts)
   - comment_id: uuid (fk -> social_comments)
   - group_id: uuid (fk -> social_groups)
   - reason: text
   - description: text
   - status: text
   - moderator_id: uuid (fk -> social_users)
   - created_at: timestamp
   - updated_at: timestamp

62. social_shares
   - id: uuid (pk)
   - user_id: uuid (fk -> social_users)
   - original_post_id: uuid (fk -> social_posts)
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
   - ai_preferred_categories: jsonb
   - ai_preferred_authors: text[]
   - ai_profile_updated_at: timestamp
   - status: social_user_status
   - last_login_at: timestamp
   - last_logout_at: timestamp
   - current_session_started_at: timestamp
   - is_online: boolean
   - verification_metrics: jsonb

65. subscriptions
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
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
   - user_id: uuid (fk -> auth.users)
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
   - audio_url: text
   - storage_path: text
   - transcript: text
   - summary: text
   - mime_type: text
   - duration_seconds: integer
   - created_at: timestamp
   - updated_at: timestamp

70. live_quiz_answers
   - id: uuid (pk)
   - session_id: uuid (fk -> live_quiz_sessions)
   - question_id: uuid (fk -> live_quiz_questions)
   - user_id: uuid (fk -> auth.users)
   - answer_index: integer
   - answered_at: timestamp
   - is_correct: boolean
   - points_awarded: integer
   - selected_option: integer
   - time_taken: integer
   - status: text

71. live_quiz_players
   - id: uuid (pk)
   - session_id: uuid (fk -> live_quiz_sessions)
   - user_id: uuid (fk -> auth.users)
   - display_name: text
   - join_time: timestamp
   - score: integer
   - is_host: boolean
   - last_answered_at: timestamp
   - is_playing: boolean
   - is_mediator: boolean
   - current_question_idx: integer
   - individual_start_time: timestamp
   - individual_end_time: timestamp
   - questions_attempted: integer
   - questions_correct: integer
   - total_time_spent: integer
   - status: text

72. live_quiz_questions
   - id: uuid (pk)
   - session_id: uuid (fk -> live_quiz_sessions)
   - question_index: integer
   - question_text: text
   - options: jsonb
   - correct_answer: integer
   - explanation: text
   - start_time: timestamp
   - end_time: timestamp
   - time_limit: integer
   - status: text

73. live_quiz_sessions
   - id: uuid (pk)
   - quiz_id: uuid (fk -> quizzes)
   - host_user_id: uuid
   - status: text
   - start_time: timestamp
   - end_time: timestamp
   - join_code: text
   - created_at: timestamp
   - updated_at: timestamp
   - host_role: text
   - advance_mode: text
   - config: jsonb
   - quiz_mode: text
   - scheduled_start_time: timestamp
   - allow_late_join: boolean

74. player_question_progress
   - id: uuid (pk)
   - session_id: uuid (fk -> live_quiz_sessions)
   - player_id: uuid
   - question_id: uuid (fk -> live_quiz_questions)
   - question_index: integer
   - selected_option: integer
   - is_correct: boolean
   - points_awarded: integer
   - time_spent: integer
   - started_at: timestamp
   - answered_at: timestamp
   - status: text
   - created_at: timestamp

75. podcast_chunks
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - upload_session_id: text
   - chunk_index: integer
   - total_chunks: integer
   - storage_path: text
   - file_size: integer
   - mime_type: text
   - checksum: text
   - status: text
   - uploader_user_id: uuid
   - created_at: timestamp
   - updated_at: timestamp

76. podcast_cohosts
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - user_id: uuid (fk -> profiles)
   - permissions: text[]
   - is_active: boolean
   - created_at: timestamp
   - updated_at: timestamp

77. podcast_participation_requests
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - user_id: uuid (fk -> profiles)
   - status: text
   - request_type: text
   - created_at: timestamp
   - updated_at: timestamp
   - responded_at: timestamp
   - responder_id: uuid (fk -> profiles)

78. podcast_recordings
   - id: uuid (pk)
   - podcast_id: uuid (fk -> ai_podcasts)
   - session_id: text
   - user_id: uuid (fk -> auth.users)
   - status: text
   - started_at: timestamp
   - ended_at: timestamp
   - duration_seconds: integer
   - final_audio_url: text
   - storage_path: text
   - metadata: jsonb
   - created_at: timestamp
   - updated_at: timestamp

79. app_ratings
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - rating: smallint
   - created_at: timestamp
   - updated_at: timestamp

80. app_testimonials
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - content: text
   - rating: smallint
   - is_approved: boolean
   - created_at: timestamp
   - updated_at: timestamp

81. countries
   - id: uuid (pk)
   - code: text
   - name: text
   - flag_emoji: text
   - official_languages: text[]
   - metadata: jsonb
   - is_active: boolean
   - sort_order: integer
   - created_at: timestamp

82. course_enrollments
   - id: uuid (pk)
   - course_id: uuid (fk -> courses)
   - user_id: uuid (fk -> profiles)
   - enrolled_at: timestamp
   - progress_percent: integer
   - last_accessed_at: timestamp
   - status: text

83. course_progress
   - id: uuid (pk)
   - enrollment_id: uuid (fk -> course_enrollments)
   - resource_id: uuid (fk -> course_resources)
   - completed: boolean
   - completed_at: timestamp
   - score: integer
   - time_spent_seconds: integer
   - last_accessed_at: timestamp

84. course_resources
   - id: uuid (pk)
   - course_id: uuid (fk -> courses)
   - resource_type: text
   - resource_id: uuid
   - title: text
   - description: text
   - category: text
   - sort_order: integer
   - is_required: boolean
   - created_at: timestamp
   - created_by: uuid (fk -> profiles)

85. curricula
   - id: uuid (pk)
   - country_id: uuid (fk -> countries)
   - education_level_id: uuid (fk -> education_levels)
   - code: text
   - name: text
   - description: text
   - governing_body: text
   - metadata: jsonb
   - is_active: boolean
   - created_at: timestamp

86. daily_notification_log
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - notification_type: text
   - category: integer
   - scheduled_send_at: timestamp
   - actually_sent_at: timestamp
   - opened_by_user: boolean
   - opened_at: timestamp
   - deep_link_clicked: boolean
   - deep_link_clicked_at: timestamp
   - action_taken: boolean
   - action_taken_at: timestamp
   - personalization_data: jsonb
   - message_template: text
   - deep_link_url: text
   - created_at: timestamp

87. education_levels
   - id: uuid (pk)
   - country_id: uuid (fk -> countries)
   - code: text
   - name: text
   - short_name: text
   - category: text
   - sort_order: integer
   - typical_start_age: integer
   - typical_duration_years: integer
   - metadata: jsonb
   - is_active: boolean
   - created_at: timestamp

88. examinations
   - id: uuid (pk)
   - curriculum_id: uuid (fk -> curricula)
   - code: text
   - name: text
   - typical_date: date
   - recurrence: text
   - metadata: jsonb
   - is_active: boolean
   - created_at: timestamp

89. institution_invites
   - id: uuid (pk)
   - institution_id: uuid (fk -> institutions)
   - email: text
   - role: text
   - invited_by: uuid
   - status: text
   - token: text
   - expires_at: timestamp
   - created_at: timestamp

90. institution_members
   - id: uuid (pk)
   - institution_id: uuid (fk -> institutions)
   - user_id: uuid (fk -> auth.users)
   - role: text
   - status: text
   - title: text
   - department: text
   - invited_by: uuid
   - invite_code: text
   - joined_at: timestamp
   - created_at: timestamp
   - updated_at: timestamp

91. institutions
   - id: uuid (pk)
   - name: text
   - slug: text
   - type: text
   - country_id: uuid (fk -> countries)
   - education_level_id: uuid (fk -> education_levels)
   - address: text
   - city: text
   - region: text
   - website: text
   - logo_url: text
   - description: text
   - verification_status: text
   - verified_by: uuid (fk -> admin_users)
   - verified_at: timestamp
   - settings: jsonb
   - metadata: jsonb
   - is_active: boolean
   - created_at: timestamp
   - updated_at: timestamp

92. platform_update_reads
   - id: uuid (pk)
   - update_id: uuid (fk -> platform_updates)
   - user_id: uuid (fk -> auth.users)
   - read_at: timestamp
   - dismissed: boolean

93. platform_updates
   - id: uuid (pk)
   - title: text
   - summary: text
   - content: text
   - update_type: text
   - priority: text
   - video_url: text
   - documentation_url: text
   - image_url: text
   - version_tag: text
   - status: text
   - scheduled_for: timestamp
   - published_at: timestamp
   - expires_at: timestamp
   - created_by: uuid (fk -> profiles)
   - updated_by: uuid (fk -> profiles)
   - created_at: timestamp
   - updated_at: timestamp

94. podcast_credit_packs
   - id: uuid (pk)
   - name: text
   - credits: integer
   - price_ghs: numeric
   - price_display: text
   - is_active: boolean
   - sort_order: integer
   - created_at: timestamp

95. podcast_credit_transactions
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - amount: integer
   - balance_after: integer
   - transaction_type: text
   - description: text
   - reference_id: text
   - created_at: timestamp

96. podcast_credits
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - balance: integer
   - lifetime_purchased: integer
   - lifetime_earned: integer
   - lifetime_spent: integer
   - last_monthly_grant_at: timestamp
   - created_at: timestamp
   - updated_at: timestamp

97. role_verification_requests
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - requested_role: text
   - institution_id: uuid (fk -> institutions)
   - status: text
   - documents: jsonb
   - qualifications: text
   - years_experience: text
   - specializations: text[]
   - additional_notes: text
   - reviewed_by: uuid
   - reviewed_at: timestamp
   - review_notes: text
   - created_at: timestamp
   - updated_at: timestamp

98. social_user_signals
   - id: uuid (pk)
   - user_id: uuid (fk -> profiles)
   - post_id: uuid (fk -> social_posts)
   - signal_type: text
   - signal_value: real
   - categories: text[]
   - created_at: timestamp

99. subjects
   - id: uuid (pk)
   - curriculum_id: uuid (fk -> curricula)
   - code: text
   - name: text
   - category: text
   - sort_order: integer
   - metadata: jsonb
   - is_active: boolean
   - created_at: timestamp

100. system_error_logs
   - id: uuid (pk)
   - severity: text
   - source: text
   - component: text
   - error_code: text
   - message: text
   - details: jsonb
   - user_id: uuid (fk -> auth.users)
   - request_id: text
   - status: text
   - resolved_by: uuid
   - resolved_at: timestamp
   - resolution_notes: text
   - created_at: timestamp
   - updated_at: timestamp

101. user_activity_tracking
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - last_active: timestamp
   - last_chat_at: timestamp
   - last_note_at: timestamp
   - last_quiz_at: timestamp
   - last_post_at: timestamp
   - last_group_interaction_at: timestamp
   - last_podcast_play_at: timestamp
   - chat_sessions_count: integer
   - notes_count: integer
   - documents_count: integer
   - quiz_attempts_count: integer
   - quiz_streak: integer
   - posts_count: integer
   - group_interactions_count: integer
   - engagement_tier: text
   - created_at: timestamp
   - updated_at: timestamp

102. user_daily_activity
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - activity_date: date
   - activity_type: text
   - action_count: integer
   - xp_earned: integer
   - created_at: timestamp
   - updated_at: timestamp

103. user_education_profiles
   - id: uuid (pk)
   - user_id: uuid (fk -> auth.users)
   - country_id: uuid (fk -> countries)
   - education_level_id: uuid (fk -> education_levels)
   - curriculum_id: uuid (fk -> curricula)
   - target_examination_id: uuid (fk -> examinations)
   - institution_name: text
   - year_or_grade: text
   - expected_completion: date
   - goals: jsonb
   - metadata: jsonb
   - created_at: timestamp
   - updated_at: timestamp

104. user_session_digests
   - id: uuid (pk)
   - user_id: uuid (fk -> profiles)
   - session_id: uuid
   - summary: text
   - topics: text[]
   - created_at: timestamp

105. user_subjects
   - id: uuid (pk)
   - user_education_profile_id: uuid (fk -> user_education_profiles)
   - subject_id: uuid (fk -> subjects)
   - is_primary: boolean
   - created_at: timestamp
GUIDELINES:
- Always use the correct UUIDs when linking tables.
- For 'user_id', the system will automatically inject the authenticated user's ID, but you can include it if you have it.
- JSON fields like 'questions' in 'quizzes' should be strictly formatted.
- Respect table relationships (foreign keys).
`;
