-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT achievements_pkey PRIMARY KEY (id),
  CONSTRAINT achievements_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id),
  CONSTRAINT achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.admin_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_activity_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  category text DEFAULT 'general'::text,
  is_public boolean DEFAULT false,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_system_settings_pkey PRIMARY KEY (id),
  CONSTRAINT admin_system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'moderator'::admin_role,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login timestamp with time zone,
  created_by uuid,
  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ai_podcasts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  sources ARRAY NOT NULL,
  script text NOT NULL,
  audio_segments jsonb NOT NULL,
  duration_minutes integer NOT NULL,
  style text NOT NULL CHECK (style = ANY (ARRAY['casual'::text, 'educational'::text, 'deep-dive'::text])),
  status text NOT NULL DEFAULT 'processing'::text CHECK (status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_public boolean DEFAULT false,
  is_live boolean DEFAULT false,
  live_started_at timestamp with time zone,
  cover_image_url text,
  description text,
  tags ARRAY DEFAULT '{}'::text[],
  listen_count integer DEFAULT 0,
  share_count integer DEFAULT 0,
  podcast_type text DEFAULT 'audio'::text CHECK (podcast_type = ANY (ARRAY['audio'::text, 'image-audio'::text, 'video'::text, 'live-stream'::text])),
  visual_assets jsonb,
  CONSTRAINT ai_podcasts_pkey PRIMARY KEY (id),
  CONSTRAINT ai_podcasts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ai_user_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fact_type text NOT NULL CHECK (fact_type = ANY (ARRAY['preference'::text, 'learning_style'::text, 'personal_fact'::text, 'skill_level'::text, 'interest'::text])),
  fact_key text NOT NULL,
  fact_value jsonb NOT NULL,
  confidence_score numeric DEFAULT 1.0 CHECK (confidence_score >= 0::numeric AND confidence_score <= 1::numeric),
  source_session_id uuid,
  last_referenced timestamp with time zone DEFAULT now(),
  referenced_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_user_memory_pkey PRIMARY KEY (id),
  CONSTRAINT ai_user_memory_source_session_id_fkey FOREIGN KEY (source_session_id) REFERENCES public.chat_sessions(id),
  CONSTRAINT ai_user_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.app_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT app_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.app_stats (
  id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  active_users text NOT NULL DEFAULT '0+'::text,
  notes_processed text NOT NULL DEFAULT '0+'::text,
  uptime text NOT NULL DEFAULT '99.9%'::text,
  user_rating text NOT NULL DEFAULT '4.9/5'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_stats_pkey PRIMARY KEY (id)
);
CREATE TABLE public.app_testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  content text NOT NULL CHECK (char_length(content) >= 10 AND char_length(content) <= 500),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_testimonials_pkey PRIMARY KEY (id),
  CONSTRAINT app_testimonials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.audio_processing_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_url text NOT NULL,
  transcript text,
  summary text,
  translated_content text,
  status text NOT NULL,
  error_message text,
  target_language text DEFAULT 'en'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  document_id uuid,
  CONSTRAINT audio_processing_results_pkey PRIMARY KEY (id),
  CONSTRAINT audio_processing_results_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id),
  CONSTRAINT audio_processing_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.audio_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid,
  segment_index integer NOT NULL,
  audio_url text,
  storage_path text,
  transcript text,
  summary text,
  mime_type text,
  duration_seconds integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audio_segments_pkey PRIMARY KEY (id),
  CONSTRAINT audio_segments_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id)
);
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL,
  requirement_type text NOT NULL CHECK (requirement_type = ANY (ARRAY['quiz_count'::text, 'streak'::text, 'score'::text, 'xp'::text, 'perfect_score'::text])),
  requirement_value integer NOT NULL CHECK (requirement_value > 0),
  xp_reward integer NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT badges_pkey PRIMARY KEY (id)
);
CREATE TABLE public.calendar_integrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['google'::text, 'outlook'::text])),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  calendar_id text,
  sync_enabled boolean DEFAULT true,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT calendar_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  role USER-DEFINED NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  session_id uuid,
  is_error boolean DEFAULT false,
  image_url text,
  attached_document_ids ARRAY,
  attached_note_ids ARRAY,
  image_mime_type text,
  has_been_displayed boolean DEFAULT false,
  conversation_context text,
  files_metadata ARRAY,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Chat'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  document_ids ARRAY DEFAULT '{}'::text[],
  last_message_at timestamp with time zone DEFAULT now(),
  message_count integer DEFAULT 0,
  context_summary text,
  last_summary_update integer DEFAULT 0,
  memory_strategy text DEFAULT 'full_context'::text,
  context_size_bytes integer DEFAULT 0,
  default_folder_id uuid,
  token_count integer DEFAULT 0,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_default_folder_id_fkey FOREIGN KEY (default_folder_id) REFERENCES public.document_folders(id),
  CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.class_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  audio_url text,
  transcript text DEFAULT ''::text,
  summary text DEFAULT ''::text,
  duration integer DEFAULT 0,
  subject text NOT NULL,
  date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  document_id uuid,
  updated_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
  processing_status text DEFAULT 'completed'::text,
  processing_error text,
  CONSTRAINT class_recordings_pkey PRIMARY KEY (id),
  CONSTRAINT class_recordings_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id),
  CONSTRAINT class_recordings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.content_moderation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_preview text NOT NULL,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['post'::text, 'comment'::text, 'document'::text])),
  decision text NOT NULL CHECK (decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'flagged'::text])),
  reason text,
  confidence double precision,
  ai_analysis jsonb,
  educational_score double precision,
  category text,
  topics ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT content_moderation_log_pkey PRIMARY KEY (id),
  CONSTRAINT content_moderation_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.content_moderation_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  reported_by uuid,
  reason text NOT NULL,
  status text DEFAULT 'pending'::text,
  moderator_id uuid,
  moderator_notes text,
  priority integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT content_moderation_queue_pkey PRIMARY KEY (id),
  CONSTRAINT content_moderation_queue_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.admin_users(id),
  CONSTRAINT content_moderation_queue_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id)
);
CREATE TABLE public.countries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  flag_emoji text,
  official_languages ARRAY DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT countries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.course_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  user_id uuid NOT NULL,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_accessed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'dropped'::text])),
  CONSTRAINT course_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.course_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  document_id uuid,
  title text NOT NULL,
  description text,
  category text CHECK (category = ANY (ARRAY['lecture_notes'::text, 'past_questions'::text, 'slides'::text, 'textbook'::text, 'other'::text])),
  downloads_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT course_materials_pkey PRIMARY KEY (id),
  CONSTRAINT course_materials_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_materials_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id)
);
CREATE TABLE public.course_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  score integer,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  last_accessed_at timestamp with time zone,
  CONSTRAINT course_progress_pkey PRIMARY KEY (id),
  CONSTRAINT course_progress_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.course_resources(id),
  CONSTRAINT course_progress_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.course_enrollments(id)
);
CREATE TABLE public.course_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type = ANY (ARRAY['document'::text, 'quiz'::text, 'podcast'::text, 'note'::text, 'recording'::text])),
  resource_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT course_resources_pkey PRIMARY KEY (id),
  CONSTRAINT course_resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT course_resources_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  level integer,
  semester integer,
  department text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  school_name text,
  institution_id uuid,
  created_by uuid,
  visibility text NOT NULL DEFAULT 'public'::text CHECK (visibility = ANY (ARRAY['institution'::text, 'public'::text, 'unlisted'::text])),
  is_published boolean DEFAULT true,
  country_id uuid,
  education_level_id uuid,
  curriculum_id uuid,
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT courses_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id),
  CONSTRAINT courses_education_level_id_fkey FOREIGN KEY (education_level_id) REFERENCES public.education_levels(id),
  CONSTRAINT courses_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curricula(id),
  CONSTRAINT courses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.curricula (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL,
  education_level_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  governing_body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT curricula_pkey PRIMARY KEY (id),
  CONSTRAINT curricula_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id),
  CONSTRAINT curricula_education_level_id_fkey FOREIGN KEY (education_level_id) REFERENCES public.education_levels(id)
);
CREATE TABLE public.daily_notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type character varying NOT NULL,
  category integer CHECK (category >= 1 AND category <= 5),
  scheduled_send_at timestamp with time zone NOT NULL,
  actually_sent_at timestamp with time zone,
  opened_by_user boolean DEFAULT false,
  opened_at timestamp with time zone,
  deep_link_clicked boolean DEFAULT false,
  deep_link_clicked_at timestamp with time zone,
  action_taken boolean DEFAULT false,
  action_taken_at timestamp with time zone,
  personalization_data jsonb,
  message_template character varying,
  deep_link_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_notification_log_pkey PRIMARY KEY (id),
  CONSTRAINT daily_notification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.document_folder_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL,
  document_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_folder_items_pkey PRIMARY KEY (id),
  CONSTRAINT document_folder_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id),
  CONSTRAINT document_folder_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id)
);
CREATE TABLE public.document_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  parent_folder_id uuid,
  color text DEFAULT '#3B82F6'::text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_folders_pkey PRIMARY KEY (id),
  CONSTRAINT document_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.document_folders(id),
  CONSTRAINT document_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  content_extracted text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'text'::text,
  processing_error text,
  processing_status text,
  processing_started_at timestamp with time zone,
  processing_completed_at timestamp with time zone,
  processing_metadata jsonb,
  extraction_model_used text,
  total_processing_time_ms integer,
  folder_ids ARRAY DEFAULT '{}'::uuid[],
  extraction_progress integer DEFAULT 0,
  continuation_attempt integer,
  current_chunk integer,
  total_chunks integer,
  extraction_warning text,
  is_public boolean NOT NULL DEFAULT false,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.education_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  category text NOT NULL CHECK (category = ANY (ARRAY['pre_primary'::text, 'primary'::text, 'lower_secondary'::text, 'upper_secondary'::text, 'tertiary'::text, 'postgraduate'::text])),
  sort_order integer DEFAULT 0,
  typical_start_age integer,
  typical_duration_years integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT education_levels_pkey PRIMARY KEY (id),
  CONSTRAINT education_levels_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id)
);
CREATE TABLE public.error_logs (
  id integer NOT NULL DEFAULT nextval('error_logs_id_seq'::regclass),
  error_message text,
  error_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT error_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.examinations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  typical_date date,
  recurrence text DEFAULT 'annual'::text CHECK (recurrence = ANY (ARRAY['annual'::text, 'biannual'::text, 'quarterly'::text, 'on_demand'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT examinations_pkey PRIMARY KEY (id),
  CONSTRAINT examinations_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curricula(id)
);
CREATE TABLE public.failed_chunks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  document_id uuid,
  chunk_index integer NOT NULL,
  chunk_base64 text NOT NULL,
  file_type character varying NOT NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT failed_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT failed_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id)
);
CREATE TABLE public.flashcards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note_id uuid,
  front text NOT NULL,
  back text NOT NULL,
  category text,
  difficulty text DEFAULT 'medium'::text CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  hint text,
  review_count integer DEFAULT 0,
  last_reviewed_at timestamp with time zone,
  next_review_at timestamp with time zone,
  ease_factor numeric DEFAULT 2.5,
  interval_days integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT flashcards_pkey PRIMARY KEY (id),
  CONSTRAINT flashcards_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.notes(id),
  CONSTRAINT flashcards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ges_curriculum_chunks (
  id bigint NOT NULL DEFAULT nextval('ges_curriculum_chunks_id_seq'::regclass),
  content text NOT NULL,
  embedding USER-DEFINED,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ges_curriculum_chunks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.institution_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'educator'::text CHECK (role = ANY (ARRAY['educator'::text, 'student'::text])),
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'::text) UNIQUE,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT institution_invites_pkey PRIMARY KEY (id),
  CONSTRAINT institution_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT institution_invites_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id)
);
CREATE TABLE public.institution_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'student'::text CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'educator'::text, 'student'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['invited'::text, 'pending'::text, 'active'::text, 'suspended'::text, 'removed'::text])),
  title text,
  department text,
  invited_by uuid,
  invite_code text,
  joined_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT institution_members_pkey PRIMARY KEY (id),
  CONSTRAINT institution_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT institution_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT institution_members_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id)
);
CREATE TABLE public.institutions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'school'::text CHECK (type = ANY (ARRAY['school'::text, 'university'::text, 'tutoring_center'::text, 'online_academy'::text])),
  country_id uuid,
  education_level_id uuid,
  address text,
  city text,
  region text,
  website text,
  logo_url text,
  description text,
  verification_status text NOT NULL DEFAULT 'unverified'::text CHECK (verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  verified_by uuid,
  verified_at timestamp with time zone,
  settings jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT institutions_pkey PRIMARY KEY (id),
  CONSTRAINT institutions_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id),
  CONSTRAINT institutions_education_level_id_fkey FOREIGN KEY (education_level_id) REFERENCES public.education_levels(id),
  CONSTRAINT institutions_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.learning_topic_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_session_id uuid,
  to_session_id uuid,
  topic text NOT NULL,
  connection_strength numeric DEFAULT 1.0 CHECK (connection_strength >= 0::numeric AND connection_strength <= 1::numeric),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT learning_topic_connections_pkey PRIMARY KEY (id),
  CONSTRAINT learning_topic_connections_from_session_id_fkey FOREIGN KEY (from_session_id) REFERENCES public.chat_sessions(id),
  CONSTRAINT learning_topic_connections_to_session_id_fkey FOREIGN KEY (to_session_id) REFERENCES public.chat_sessions(id),
  CONSTRAINT learning_topic_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.live_quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question_id uuid NOT NULL,
  user_id uuid NOT NULL,
  answer_index integer NOT NULL,
  answered_at timestamp with time zone DEFAULT now(),
  is_correct boolean,
  points_awarded integer DEFAULT 0,
  selected_option integer,
  time_taken integer,
  status text DEFAULT 'answered'::text,
  CONSTRAINT live_quiz_answers_pkey PRIMARY KEY (id),
  CONSTRAINT live_quiz_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT live_quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.live_quiz_questions(id),
  CONSTRAINT live_quiz_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_quiz_sessions(id)
);
CREATE TABLE public.live_quiz_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  join_time timestamp with time zone DEFAULT now(),
  score integer DEFAULT 0,
  is_host boolean DEFAULT false,
  last_answered_at timestamp with time zone,
  is_playing boolean DEFAULT true,
  is_mediator boolean DEFAULT false,
  current_question_idx integer DEFAULT 0,
  individual_start_time timestamp with time zone,
  individual_end_time timestamp with time zone,
  questions_attempted integer DEFAULT 0,
  questions_correct integer DEFAULT 0,
  total_time_spent integer DEFAULT 0,
  status character varying DEFAULT 'playing'::character varying,
  CONSTRAINT live_quiz_players_pkey PRIMARY KEY (id),
  CONSTRAINT live_quiz_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT live_quiz_players_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_quiz_sessions(id)
);
CREATE TABLE public.live_quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question_index integer NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_answer integer NOT NULL,
  explanation text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  time_limit integer DEFAULT 30,
  status text DEFAULT 'pending'::text,
  CONSTRAINT live_quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT live_quiz_questions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_quiz_sessions(id)
);
CREATE TABLE public.live_quiz_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  host_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'waiting'::text CHECK (status = ANY (ARRAY['waiting'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  join_code text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  host_role text NOT NULL DEFAULT 'participant'::text,
  advance_mode text NOT NULL DEFAULT 'auto'::text,
  config jsonb DEFAULT '{"auto_advance": true, "question_time_limit": 30}'::jsonb,
  quiz_mode character varying DEFAULT 'synchronized'::character varying,
  scheduled_start_time timestamp with time zone,
  allow_late_join boolean DEFAULT true,
  CONSTRAINT live_quiz_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT live_quiz_sessions_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES auth.users(id),
  CONSTRAINT live_quiz_sessions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);
CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Note'::text,
  content text DEFAULT ''::text,
  category text DEFAULT 'General'::text,
  tags ARRAY DEFAULT '{}'::text[],
  ai_summary text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  document_id uuid,
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  push_notifications boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  schedule_reminders boolean DEFAULT true,
  quiz_reminders boolean DEFAULT true,
  assignment_reminders boolean DEFAULT true,
  social_notifications boolean DEFAULT true,
  quiet_hours_enabled boolean DEFAULT false,
  quiet_hours_start time without time zone DEFAULT '22:00:00'::time without time zone,
  quiet_hours_end time without time zone DEFAULT '08:00:00'::time without time zone,
  reminder_time integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  daily_categories jsonb DEFAULT '{"group_nudge": true, "quiz_challenge": true, "study_planning": true, "podcast_discovery": true, "progress_tracking": true}'::jsonb,
  preferred_notification_times jsonb DEFAULT '{"group_nudge": ["17:00"], "quiz_challenge": ["14:00"], "study_planning": ["08:00"], "podcast_discovery": ["07:00", "19:00"], "progress_tracking": "flexible"}'::jsonb,
  max_notifications_per_day integer DEFAULT 3 CHECK (max_notifications_per_day >= 0 AND max_notifications_per_day <= 10),
  user_timezone character varying DEFAULT 'UTC'::character varying,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notification_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_type text CHECK (device_type = ANY (ARRAY['web'::text, 'mobile'::text, 'desktop'::text])),
  browser text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT notification_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['schedule_reminder'::text, 'quiz_due'::text, 'assignment_due'::text, 'social_like'::text, 'social_comment'::text, 'social_mention'::text, 'ai_message'::text, 'ai_limit_warning'::text, 'document_shared'::text, 'system_update'::text, 'achievement'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.platform_update_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  update_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  dismissed boolean NOT NULL DEFAULT false,
  CONSTRAINT platform_update_reads_pkey PRIMARY KEY (id),
  CONSTRAINT platform_update_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT platform_update_reads_update_id_fkey FOREIGN KEY (update_id) REFERENCES public.platform_updates(id)
);
CREATE TABLE public.platform_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  content text,
  update_type text NOT NULL DEFAULT 'feature'::text CHECK (update_type = ANY (ARRAY['feature'::text, 'improvement'::text, 'bugfix'::text, 'maintenance'::text, 'announcement'::text, 'breaking'::text])),
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text])),
  video_url text,
  documentation_url text,
  image_url text,
  version_tag text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text])),
  scheduled_for timestamp with time zone,
  published_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_updates_pkey PRIMARY KEY (id),
  CONSTRAINT platform_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT platform_updates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.player_question_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  player_id uuid,
  question_id uuid,
  question_index integer NOT NULL,
  selected_option integer,
  is_correct boolean,
  points_awarded integer DEFAULT 0,
  time_spent integer DEFAULT 0,
  started_at timestamp with time zone,
  answered_at timestamp with time zone,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_question_progress_pkey PRIMARY KEY (id),
  CONSTRAINT player_question_progress_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id),
  CONSTRAINT player_question_progress_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_quiz_sessions(id),
  CONSTRAINT player_question_progress_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.live_quiz_questions(id)
);
CREATE TABLE public.podcast_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid,
  upload_session_id text NOT NULL,
  chunk_index integer NOT NULL,
  total_chunks integer,
  storage_path text,
  file_size integer,
  mime_type text,
  checksum text,
  status text DEFAULT 'uploaded'::text,
  uploader_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT podcast_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_chunks_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id)
);
CREATE TABLE public.podcast_cohosts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permissions ARRAY DEFAULT ARRAY['speak'::text, 'moderate'::text],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT podcast_cohosts_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_cohosts_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id),
  CONSTRAINT podcast_cohosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.podcast_credit_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_ghs numeric NOT NULL,
  price_display text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT podcast_credit_packs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.podcast_credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['monthly_grant'::text, 'purchase'::text, 'generation_audio'::text, 'generation_image'::text, 'generation_video'::text, 'refund'::text, 'admin_adjustment'::text, 'bonus'::text])),
  description text,
  reference_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT podcast_credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.podcast_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  last_monthly_grant_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT podcast_credits_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.podcast_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid,
  invitee_email text,
  role text NOT NULL CHECK (role = ANY (ARRAY['co-host'::text, 'listener'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text])),
  message text,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT podcast_invites_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_invites_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id),
  CONSTRAINT podcast_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id),
  CONSTRAINT podcast_invites_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.podcast_listeners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT podcast_listeners_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_listeners_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id),
  CONSTRAINT podcast_listeners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.podcast_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'co-host'::text, 'listener'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT podcast_members_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_members_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id),
  CONSTRAINT podcast_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT podcast_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.podcast_participation_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'revoked'::text])),
  request_type text DEFAULT 'speak'::text CHECK (request_type = ANY (ARRAY['speak'::text, 'cohost'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  responded_at timestamp with time zone,
  responder_id uuid,
  CONSTRAINT podcast_participation_requests_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_participation_requests_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id),
  CONSTRAINT podcast_participation_requests_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES public.profiles(id),
  CONSTRAINT podcast_participation_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.podcast_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid,
  session_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'in_progress'::text,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  final_audio_url text,
  storage_path text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT podcast_recordings_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_recordings_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id)
);
CREATE TABLE public.podcast_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL,
  user_id uuid NOT NULL,
  share_type text NOT NULL CHECK (share_type = ANY (ARRAY['link'::text, 'social_post'::text, 'direct_message'::text])),
  platform text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT podcast_shares_pkey PRIMARY KEY (id),
  CONSTRAINT podcast_shares_podcast_id_fkey FOREIGN KEY (podcast_id) REFERENCES public.ai_podcasts(id),
  CONSTRAINT podcast_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  learning_style text DEFAULT 'visual'::text,
  learning_preferences jsonb DEFAULT '{"examples": true, "difficulty": "medium", "explanation_style": "detailed"}'::jsonb,
  username text,
  quiz_preferences jsonb DEFAULT '{"difficulty": "intermediate", "question_types": ["multiple_choice", "true_false"], "time_per_question": 60}'::jsonb,
  is_public boolean DEFAULT true,
  referral_code text UNIQUE,
  referral_count integer DEFAULT 0,
  points_balance integer DEFAULT 0,
  bonus_ai_credits integer DEFAULT 0,
  school text,
  personal_context text DEFAULT ''::text,
  user_role text NOT NULL DEFAULT 'student'::text CHECK (user_role = ANY (ARRAY['student'::text, 'school_admin'::text, 'tutor_affiliated'::text, 'tutor_independent'::text])),
  role_verified_at timestamp with time zone,
  onboarding_completed boolean DEFAULT false,
  role_verification_status text NOT NULL DEFAULT 'not_required'::text CHECK (role_verification_status = ANY (ARRAY['not_required'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  role_verified_by uuid,
  role_rejection_reason text,
  institution_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT profiles_role_verified_by_fkey FOREIGN KEY (role_verified_by) REFERENCES auth.users(id)
);
CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0),
  total_questions integer NOT NULL CHECK (total_questions > 0),
  percentage integer NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  time_taken_seconds integer NOT NULL CHECK (time_taken_seconds >= 0),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  xp_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_id uuid,
  title text NOT NULL,
  questions jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  source_type text DEFAULT 'recording'::text CHECK (source_type = ANY (ARRAY['recording'::text, 'notes'::text, 'ai'::text, 'live_custom'::text])),
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class_recordings(id),
  CONSTRAINT quizzes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text])),
  reward_granted boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id),
  CONSTRAINT referrals_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES auth.users(id)
);
CREATE TABLE public.role_verification_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_role text NOT NULL CHECK (requested_role = ANY (ARRAY['school_admin'::text, 'tutor_affiliated'::text, 'tutor_independent'::text])),
  institution_id uuid,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  documents jsonb DEFAULT '[]'::jsonb,
  qualifications text,
  years_experience text,
  specializations ARRAY,
  additional_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_verification_requests_pkey PRIMARY KEY (id),
  CONSTRAINT role_verification_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT role_verification_requests_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT role_verification_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.schedule_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  type USER-DEFINED DEFAULT 'other'::schedule_item_type,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  location text,
  description text,
  color text DEFAULT '#3B82F6'::text,
  created_at timestamp with time zone DEFAULT now(),
  calendar_event_id text,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text CHECK (recurrence_pattern = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])),
  recurrence_interval integer DEFAULT 1,
  recurrence_days ARRAY,
  recurrence_end_date timestamp with time zone,
  CONSTRAINT schedule_items_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.schedule_reminders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL,
  reminder_minutes integer NOT NULL,
  notification_sent boolean DEFAULT false,
  notification_sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedule_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_reminders_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedule_items(id)
);
CREATE TABLE public.schema_agent_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  operation text NOT NULL,
  table_name text NOT NULL,
  query_intent jsonb NOT NULL,
  success boolean NOT NULL,
  error_message text,
  execution_time_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schema_agent_audit_pkey PRIMARY KEY (id),
  CONSTRAINT schema_agent_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.social_bookmarks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_bookmarks_pkey PRIMARY KEY (id),
  CONSTRAINT social_bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id),
  CONSTRAINT social_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_chat_message_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text])),
  url text NOT NULL,
  filename text NOT NULL,
  size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_chat_message_media_pkey PRIMARY KEY (id),
  CONSTRAINT social_chat_message_media_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.social_chat_messages(id)
);
CREATE TABLE public.social_chat_message_reads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT social_chat_message_reads_pkey PRIMARY KEY (id),
  CONSTRAINT social_chat_message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.social_chat_messages(id),
  CONSTRAINT social_chat_message_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.social_chat_message_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  resource_type character varying NOT NULL CHECK (resource_type::text = ANY (ARRAY['note'::character varying::text, 'document'::character varying::text, 'post'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_chat_message_resources_pkey PRIMARY KEY (id),
  CONSTRAINT social_chat_message_resources_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.social_chat_messages(id)
);
CREATE TABLE public.social_chat_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  session_id uuid,
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  is_edited boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT social_chat_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.social_groups(id),
  CONSTRAINT social_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.social_chat_sessions(id),
  CONSTRAINT social_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_type character varying NOT NULL CHECK (chat_type::text = ANY (ARRAY['group'::character varying::text, 'p2p'::character varying::text])),
  group_id uuid,
  user_id1 uuid,
  user_id2 uuid,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT social_chat_sessions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.social_groups(id),
  CONSTRAINT social_chat_sessions_user_id1_fkey FOREIGN KEY (user_id1) REFERENCES public.social_users(id),
  CONSTRAINT social_chat_sessions_user_id2_fkey FOREIGN KEY (user_id2) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_comment_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  comment_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text])),
  url text NOT NULL,
  filename text NOT NULL,
  size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_comment_media_pkey PRIMARY KEY (id),
  CONSTRAINT social_comment_media_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.social_comments(id)
);
CREATE TABLE public.social_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  parent_comment_id uuid,
  likes_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_comments_pkey PRIMARY KEY (id),
  CONSTRAINT social_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.social_comments(id),
  CONSTRAINT social_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id),
  CONSTRAINT social_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_event_attendees (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text DEFAULT 'attending'::text CHECK (status = ANY (ARRAY['attending'::text, 'maybe'::text, 'declined'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_event_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT social_event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.social_events(id),
  CONSTRAINT social_event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.social_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  group_id uuid,
  organizer_id uuid NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  location text,
  is_online boolean DEFAULT false,
  max_attendees integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_events_pkey PRIMARY KEY (id),
  CONSTRAINT social_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.social_groups(id),
  CONSTRAINT social_events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.social_follows (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_follows_pkey PRIMARY KEY (id),
  CONSTRAINT social_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.social_users(id),
  CONSTRAINT social_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_group_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text CHECK (role = ANY (ARRAY['admin'::text, 'moderator'::text, 'member'::text])),
  joined_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'pending'::text, 'banned'::text])),
  CONSTRAINT social_group_members_pkey PRIMARY KEY (id),
  CONSTRAINT social_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.social_groups(id),
  CONSTRAINT social_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.social_groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  avatar_url text,
  cover_image_url text,
  category text NOT NULL,
  privacy text DEFAULT 'public'::text CHECK (privacy = ANY (ARRAY['public'::text, 'private'::text])),
  members_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_groups_pkey PRIMARY KEY (id),
  CONSTRAINT social_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_hashtags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  posts_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_hashtags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.social_likes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  post_id uuid,
  comment_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_likes_pkey PRIMARY KEY (id),
  CONSTRAINT social_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.social_comments(id),
  CONSTRAINT social_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id),
  CONSTRAINT social_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text])),
  url text NOT NULL,
  thumbnail_url text,
  filename text NOT NULL,
  size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_media_pkey PRIMARY KEY (id),
  CONSTRAINT social_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id)
);
CREATE TABLE public.social_notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'share'::text, 'follow'::text, 'group_invite'::text, 'mention'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  actor_id uuid,
  post_id uuid,
  CONSTRAINT social_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT social_notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id),
  CONSTRAINT social_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT social_notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_post_hashtags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  hashtag_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_post_hashtags_pkey PRIMARY KEY (id),
  CONSTRAINT social_post_hashtags_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.social_hashtags(id),
  CONSTRAINT social_post_hashtags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id)
);
CREATE TABLE public.social_post_tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_post_tags_pkey PRIMARY KEY (id),
  CONSTRAINT social_post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.social_tags(id),
  CONSTRAINT social_post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id)
);
CREATE TABLE public.social_post_views (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_post_views_pkey PRIMARY KEY (id),
  CONSTRAINT social_post_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT social_post_views_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id)
);
CREATE TABLE public.social_posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  author_id uuid NOT NULL,
  content text NOT NULL,
  privacy text DEFAULT 'public'::text CHECK (privacy = ANY (ARRAY['public'::text, 'followers'::text, 'private'::text])),
  group_id uuid,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  bookmarks_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  views_count integer DEFAULT 0,
  metadata jsonb,
  ai_categories ARRAY DEFAULT '{}'::text[],
  ai_sentiment text,
  ai_quality_score smallint,
  CONSTRAINT social_posts_pkey PRIMARY KEY (id),
  CONSTRAINT fk_posts_group_id FOREIGN KEY (group_id) REFERENCES public.social_groups(id),
  CONSTRAINT social_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid,
  post_id uuid,
  comment_id uuid,
  group_id uuid,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text])),
  moderator_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_reports_pkey PRIMARY KEY (id),
  CONSTRAINT social_reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.social_comments(id),
  CONSTRAINT social_reports_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.social_groups(id),
  CONSTRAINT social_reports_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.social_users(id),
  CONSTRAINT social_reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id),
  CONSTRAINT social_reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.social_users(id),
  CONSTRAINT social_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_shares (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  original_post_id uuid NOT NULL,
  share_text text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_shares_pkey PRIMARY KEY (id),
  CONSTRAINT social_shares_original_post_id_fkey FOREIGN KEY (original_post_id) REFERENCES public.social_posts(id),
  CONSTRAINT social_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.social_users(id)
);
CREATE TABLE public.social_tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.social_user_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  signal_type text NOT NULL,
  signal_value real DEFAULT 1.0,
  categories ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_user_signals_pkey PRIMARY KEY (id),
  CONSTRAINT social_user_signals_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id),
  CONSTRAINT social_user_signals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.social_users (
  id uuid NOT NULL,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  interests ARRAY DEFAULT '{}'::text[],
  is_verified boolean DEFAULT false,
  is_contributor boolean DEFAULT false,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  last_active timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text,
  is_public boolean DEFAULT true,
  ai_preferred_categories jsonb DEFAULT '{}'::jsonb,
  ai_preferred_authors ARRAY DEFAULT '{}'::text[],
  ai_profile_updated_at timestamp with time zone,
  status USER-DEFINED NOT NULL DEFAULT 'active'::social_user_status,
  last_login_at timestamp with time zone,
  last_logout_at timestamp with time zone,
  current_session_started_at timestamp with time zone,
  is_online boolean DEFAULT false,
  verification_metrics jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT social_users_pkey PRIMARY KEY (id),
  CONSTRAINT social_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'core'::text CHECK (category = ANY (ARRAY['core'::text, 'elective'::text])),
  sort_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curricula(id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_type text NOT NULL DEFAULT 'free'::text CHECK (plan_type = ANY (ARRAY['free'::text, 'scholar'::text, 'genius'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'past_due'::text, 'expired'::text])),
  current_period_end timestamp with time zone,
  paystack_sub_code text,
  paystack_customer_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.system_error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'error'::text CHECK (severity = ANY (ARRAY['critical'::text, 'error'::text, 'warning'::text, 'info'::text])),
  source text NOT NULL,
  component text,
  error_code text,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  user_id uuid,
  request_id text,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text, 'ignored'::text])),
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT system_error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT system_error_logs_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id)
);
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id),
  CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.user_activity_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  last_active timestamp with time zone DEFAULT now(),
  last_chat_at timestamp with time zone,
  last_note_at timestamp with time zone,
  last_quiz_at timestamp with time zone,
  last_post_at timestamp with time zone,
  last_group_interaction_at timestamp with time zone,
  last_podcast_play_at timestamp with time zone,
  chat_sessions_count integer DEFAULT 0,
  notes_count integer DEFAULT 0,
  documents_count integer DEFAULT 0,
  quiz_attempts_count integer DEFAULT 0,
  quiz_streak integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  group_interactions_count integer DEFAULT 0,
  engagement_tier character varying DEFAULT 'cold'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_activity_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT user_activity_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_daily_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  activity_type character varying NOT NULL,
  action_count integer DEFAULT 1,
  xp_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_daily_activity_pkey PRIMARY KEY (id),
  CONSTRAINT user_daily_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_education_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  country_id uuid,
  education_level_id uuid,
  curriculum_id uuid,
  target_examination_id uuid,
  institution_name text,
  year_or_grade text,
  expected_completion date,
  goals jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_education_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_education_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_education_profiles_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id),
  CONSTRAINT user_education_profiles_education_level_id_fkey FOREIGN KEY (education_level_id) REFERENCES public.education_levels(id),
  CONSTRAINT user_education_profiles_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curricula(id),
  CONSTRAINT user_education_profiles_target_examination_id_fkey FOREIGN KEY (target_examination_id) REFERENCES public.examinations(id)
);
CREATE TABLE public.user_learning_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_text text NOT NULL,
  target_date timestamp with time zone,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  category text DEFAULT 'general'::text,
  is_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_learning_goals_pkey PRIMARY KEY (id),
  CONSTRAINT user_learning_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_stats (
  user_id uuid NOT NULL,
  total_xp integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  total_quizzes_attempted integer NOT NULL DEFAULT 0 CHECK (total_quizzes_attempted >= 0),
  total_quizzes_completed integer NOT NULL DEFAULT 0 CHECK (total_quizzes_completed >= 0),
  average_score numeric NOT NULL DEFAULT 0 CHECK (average_score >= 0::numeric AND average_score <= 100::numeric),
  total_study_time_seconds integer NOT NULL DEFAULT 0 CHECK (total_study_time_seconds >= 0),
  badges_earned ARRAY NOT NULL DEFAULT ARRAY[]::text[],
  last_activity_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  weak_areas ARRAY DEFAULT '{}'::text[],
  CONSTRAINT user_stats_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_education_profile_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT user_subjects_user_education_profile_id_fkey FOREIGN KEY (user_education_profile_id) REFERENCES public.user_education_profiles(id),
  CONSTRAINT user_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);