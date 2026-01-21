export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_system_settings: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          is_active: boolean | null
          last_login: string | null
          permissions: Json | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_podcasts: {
        Row: {
          audio_segments: Json
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          error_message: string | null
          id: string
          is_live: boolean | null
          is_public: boolean | null
          listen_count: number | null
          live_started_at: string | null
          podcast_type: string | null
          script: string
          share_count: number | null
          sources: string[]
          status: string
          style: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          visual_assets: Json | null
        }
        Insert: {
          audio_segments: Json
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          error_message?: string | null
          id?: string
          is_live?: boolean | null
          is_public?: boolean | null
          listen_count?: number | null
          live_started_at?: string | null
          podcast_type?: string | null
          script: string
          share_count?: number | null
          sources: string[]
          status?: string
          style: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          visual_assets?: Json | null
        }
        Update: {
          audio_segments?: Json
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          error_message?: string | null
          id?: string
          is_live?: boolean | null
          is_public?: boolean | null
          listen_count?: number | null
          live_started_at?: string | null
          podcast_type?: string | null
          script?: string
          share_count?: number | null
          sources?: string[]
          status?: string
          style?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          visual_assets?: Json | null
        }
        Relationships: []
      }
      ai_user_memory: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          fact_key: string
          fact_type: string
          fact_value: Json
          id: string
          last_referenced: string | null
          referenced_count: number | null
          source_session_id: string | null
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          fact_key: string
          fact_type: string
          fact_value: Json
          id?: string
          last_referenced?: string | null
          referenced_count?: number | null
          source_session_id?: string | null
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          fact_key?: string
          fact_type?: string
          fact_value?: Json
          id?: string
          last_referenced?: string | null
          referenced_count?: number | null
          source_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_user_memory_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "chat_session_memory_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_user_memory_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_stats: {
        Row: {
          active_users: string
          id: string
          notes_processed: string
          updated_at: string | null
          uptime: string
          user_rating: string
        }
        Insert: {
          active_users?: string
          id?: string
          notes_processed?: string
          updated_at?: string | null
          uptime?: string
          user_rating?: string
        }
        Update: {
          active_users?: string
          id?: string
          notes_processed?: string
          updated_at?: string | null
          uptime?: string
          user_rating?: string
        }
        Relationships: []
      }
      audio_processing_results: {
        Row: {
          created_at: string | null
          document_id: string | null
          error_message: string | null
          file_url: string
          id: string
          status: string
          summary: string | null
          target_language: string | null
          transcript: string | null
          translated_content: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_url: string
          id?: string
          status: string
          summary?: string | null
          target_language?: string | null
          transcript?: string | null
          translated_content?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_url?: string
          id?: string
          status?: string
          summary?: string | null
          target_language?: string | null
          transcript?: string | null
          translated_content?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_processing_results_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          requirement_type: string
          requirement_value: number
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
          xp_reward?: number
        }
        Relationships: []
      }
      calendar_integrations: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          sync_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attached_document_ids: string[] | null
          attached_note_ids: string[] | null
          content: string
          conversation_context: string | null
          files_metadata: Json[] | null
          has_been_displayed: boolean | null
          id: string
          image_mime_type: string | null
          image_url: string | null
          is_error: boolean | null
          role: Database["public"]["Enums"]["message_role"]
          session_id: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          attached_document_ids?: string[] | null
          attached_note_ids?: string[] | null
          content: string
          conversation_context?: string | null
          files_metadata?: Json[] | null
          has_been_displayed?: boolean | null
          id?: string
          image_mime_type?: string | null
          image_url?: string | null
          is_error?: boolean | null
          role: Database["public"]["Enums"]["message_role"]
          session_id?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          attached_document_ids?: string[] | null
          attached_note_ids?: string[] | null
          content?: string
          conversation_context?: string | null
          files_metadata?: Json[] | null
          has_been_displayed?: boolean | null
          id?: string
          image_mime_type?: string | null
          image_url?: string | null
          is_error?: boolean | null
          role?: Database["public"]["Enums"]["message_role"]
          session_id?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context_size_bytes: number | null
          context_summary: string | null
          created_at: string
          default_folder_id: string | null
          document_ids: string[] | null
          id: string
          last_message_at: string | null
          last_summary_update: number | null
          memory_strategy: string | null
          message_count: number | null
          title: string
          token_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_size_bytes?: number | null
          context_summary?: string | null
          created_at?: string
          default_folder_id?: string | null
          document_ids?: string[] | null
          id?: string
          last_message_at?: string | null
          last_summary_update?: number | null
          memory_strategy?: string | null
          message_count?: number | null
          title?: string
          token_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_size_bytes?: number | null
          context_summary?: string | null
          created_at?: string
          default_folder_id?: string | null
          document_ids?: string[] | null
          id?: string
          last_message_at?: string | null
          last_summary_update?: number | null
          memory_strategy?: string | null
          message_count?: number | null
          title?: string
          token_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_default_folder_id_fkey"
            columns: ["default_folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      class_recordings: {
        Row: {
          audio_url: string | null
          created_at: string | null
          date: string | null
          document_id: string | null
          duration: number | null
          id: string
          processing_error: string | null
          processing_status: string | null
          subject: string
          summary: string | null
          title: string
          transcript: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          date?: string | null
          document_id?: string | null
          duration?: number | null
          id?: string
          processing_error?: string | null
          processing_status?: string | null
          subject: string
          summary?: string | null
          title: string
          transcript?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          date?: string | null
          document_id?: string | null
          duration?: number | null
          id?: string
          processing_error?: string | null
          processing_status?: string | null
          subject?: string
          summary?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_recordings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_recordings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_moderation_log: {
        Row: {
          ai_analysis: Json | null
          category: string | null
          confidence: number | null
          content_preview: string
          content_type: string
          created_at: string | null
          decision: string
          educational_score: number | null
          id: string
          reason: string | null
          topics: string[] | null
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          category?: string | null
          confidence?: number | null
          content_preview: string
          content_type: string
          created_at?: string | null
          decision: string
          educational_score?: number | null
          id?: string
          reason?: string | null
          topics?: string[] | null
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          category?: string | null
          confidence?: number | null
          content_preview?: string
          content_type?: string
          created_at?: string | null
          decision?: string
          educational_score?: number | null
          id?: string
          reason?: string | null
          topics?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      content_moderation_queue: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          moderator_id: string | null
          moderator_notes: string | null
          priority: number | null
          reason: string
          reported_by: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          priority?: number | null
          reason: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          priority?: number | null
          reason?: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_moderation_queue_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          category: string | null
          course_id: string
          created_at: string
          description: string | null
          document_id: string | null
          downloads_count: number | null
          id: string
          title: string
        }
        Insert: {
          category?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          downloads_count?: number | null
          id?: string
          title: string
        }
        Update: {
          category?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          downloads_count?: number | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          department: string | null
          description: string | null
          id: string
          level: number | null
          school_name: string | null
          semester: number | null
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          level?: number | null
          school_name?: string | null
          semester?: number | null
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          level?: number | null
          school_name?: string | null
          semester?: number | null
          title?: string
        }
        Relationships: []
      }
      document_folder_items: {
        Row: {
          added_at: string | null
          document_id: string
          folder_id: string
          id: string
        }
        Insert: {
          added_at?: string | null
          document_id: string
          folder_id: string
          id?: string
        }
        Update: {
          added_at?: string | null
          document_id?: string
          folder_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folder_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folder_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_folder_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_folder_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_folder_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content_extracted: string | null
          continuation_attempt: number | null
          created_at: string
          current_chunk: number | null
          extraction_model_used: string | null
          extraction_progress: number | null
          extraction_warning: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          folder_ids: string[] | null
          id: string
          processing_completed_at: string | null
          processing_error: string | null
          processing_metadata: Json | null
          processing_started_at: string | null
          processing_status: string | null
          title: string
          total_chunks: number | null
          total_processing_time_ms: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_extracted?: string | null
          continuation_attempt?: number | null
          created_at?: string
          current_chunk?: number | null
          extraction_model_used?: string | null
          extraction_progress?: number | null
          extraction_warning?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          folder_ids?: string[] | null
          id?: string
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_metadata?: Json | null
          processing_started_at?: string | null
          processing_status?: string | null
          title: string
          total_chunks?: number | null
          total_processing_time_ms?: number | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_extracted?: string | null
          continuation_attempt?: number | null
          created_at?: string
          current_chunk?: number | null
          extraction_model_used?: string | null
          extraction_progress?: number | null
          extraction_warning?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          folder_ids?: string[] | null
          id?: string
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_metadata?: Json | null
          processing_started_at?: string | null
          processing_status?: string | null
          title?: string
          total_chunks?: number | null
          total_processing_time_ms?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          error_message: string | null
          error_time: string | null
          id: number
        }
        Insert: {
          error_message?: string | null
          error_time?: string | null
          id?: number
        }
        Update: {
          error_message?: string | null
          error_time?: string | null
          id?: number
        }
        Relationships: []
      }
      failed_chunks: {
        Row: {
          chunk_base64: string
          chunk_index: number
          created_at: string | null
          document_id: string | null
          error_message: string | null
          file_type: string
          id: string
        }
        Insert: {
          chunk_base64: string
          chunk_index: number
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_type: string
          id?: string
        }
        Update: {
          chunk_base64?: string
          chunk_index?: number
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failed_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          category: string | null
          created_at: string | null
          difficulty: string | null
          ease_factor: number | null
          front: string
          hint: string | null
          id: string
          interval_days: number | null
          last_reviewed_at: string | null
          next_review_at: string | null
          note_id: string | null
          review_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          back: string
          category?: string | null
          created_at?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          front: string
          hint?: string | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          next_review_at?: string | null
          note_id?: string | null
          review_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          back?: string
          category?: string | null
          created_at?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          front?: string
          hint?: string | null
          id?: string
          interval_days?: number | null
          last_reviewed_at?: string | null
          next_review_at?: string | null
          note_id?: string | null
          review_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_topic_connections: {
        Row: {
          connection_strength: number | null
          created_at: string | null
          from_session_id: string | null
          id: string
          to_session_id: string | null
          topic: string
          user_id: string
        }
        Insert: {
          connection_strength?: number | null
          created_at?: string | null
          from_session_id?: string | null
          id?: string
          to_session_id?: string | null
          topic: string
          user_id: string
        }
        Update: {
          connection_strength?: number | null
          created_at?: string | null
          from_session_id?: string | null
          id?: string
          to_session_id?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_topic_connections_from_session_id_fkey"
            columns: ["from_session_id"]
            isOneToOne: false
            referencedRelation: "chat_session_memory_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_topic_connections_from_session_id_fkey"
            columns: ["from_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_topic_connections_to_session_id_fkey"
            columns: ["to_session_id"]
            isOneToOne: false
            referencedRelation: "chat_session_memory_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_topic_connections_to_session_id_fkey"
            columns: ["to_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          ai_summary: string | null
          category: string | null
          content: string | null
          created_at: string | null
          document_id: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          document_id?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          assignment_reminders: boolean | null
          created_at: string | null
          email_notifications: boolean | null
          push_notifications: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          quiz_reminders: boolean | null
          reminder_time: number | null
          schedule_reminders: boolean | null
          social_notifications: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assignment_reminders?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiz_reminders?: boolean | null
          reminder_time?: number | null
          schedule_reminders?: boolean | null
          social_notifications?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assignment_reminders?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiz_reminders?: boolean | null
          reminder_time?: number | null
          schedule_reminders?: boolean | null
          social_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          auth: string
          browser: string | null
          created_at: string | null
          device_type: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          expires_at: string | null
          id: string
          message: string
          read: boolean | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      podcast_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invitee_email: string | null
          invitee_id: string | null
          inviter_id: string
          message: string | null
          podcast_id: string
          responded_at: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id: string
          message?: string | null
          podcast_id: string
          responded_at?: string | null
          role: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id?: string
          message?: string | null
          podcast_id?: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_invites_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "ai_podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_listeners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          joined_at: string
          left_at: string | null
          podcast_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          left_at?: string | null
          podcast_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          left_at?: string | null
          podcast_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_listeners_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "ai_podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          podcast_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          podcast_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          podcast_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_members_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "ai_podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_shares: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          podcast_id: string
          share_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          podcast_id: string
          share_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          podcast_id?: string
          share_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_shares_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "ai_podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bonus_ai_credits: number | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_public: boolean | null
          learning_preferences: Json | null
          learning_style: string | null
          points_balance: number | null
          quiz_preferences: Json | null
          referral_code: string | null
          referral_count: number | null
          school: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bonus_ai_credits?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_public?: boolean | null
          learning_preferences?: Json | null
          learning_style?: string | null
          points_balance?: number | null
          quiz_preferences?: Json | null
          referral_code?: string | null
          referral_count?: number | null
          school?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bonus_ai_credits?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_public?: boolean | null
          learning_preferences?: Json | null
          learning_style?: string | null
          points_balance?: number | null
          quiz_preferences?: Json | null
          referral_code?: string | null
          referral_count?: number | null
          school?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          percentage: number
          quiz_id: string
          score: number
          time_taken_seconds: number
          total_questions: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          percentage: number
          quiz_id: string
          score: number
          time_taken_seconds: number
          total_questions: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          percentage?: number
          quiz_id?: string
          score?: number
          time_taken_seconds?: number
          total_questions?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          class_id: string | null
          created_at: string | null
          id: string
          questions: Json | null
          source_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          questions?: Json | null
          source_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          questions?: Json | null
          source_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
          reward_granted: boolean | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
          reward_granted?: boolean | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
          reward_granted?: boolean | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          calendar_event_id: string | null
          color: string | null
          created_at: string | null
          description: string | null
          end_time: string
          id: string
          is_recurring: boolean | null
          location: string | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_pattern: string | null
          start_time: string
          subject: string
          title: string
          type: Database["public"]["Enums"]["schedule_item_type"] | null
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_pattern?: string | null
          start_time: string
          subject: string
          title: string
          type?: Database["public"]["Enums"]["schedule_item_type"] | null
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_pattern?: string | null
          start_time?: string
          subject?: string
          title?: string
          type?: Database["public"]["Enums"]["schedule_item_type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_reminders: {
        Row: {
          created_at: string | null
          id: string
          notification_sent: boolean | null
          notification_sent_at: string | null
          reminder_minutes: number
          schedule_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          reminder_minutes: number
          schedule_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          reminder_minutes?: number
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_reminders_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      social_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_chat_message_media: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          message_id: string
          mime_type: string
          size_bytes: number
          type: string
          url: string
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          message_id: string
          mime_type: string
          size_bytes: number
          type: string
          url: string
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_chat_message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "social_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      social_chat_message_reads: {
        Row: {
          created_at: string
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_chat_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "social_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_chat_message_resources: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          resource_id: string
          resource_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          resource_id: string
          resource_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_chat_message_resources_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "social_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      social_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          group_id: string | null
          id: string
          is_edited: boolean | null
          is_read: boolean | null
          read_at: string | null
          sender_id: string
          session_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_edited?: boolean | null
          is_read?: boolean | null
          read_at?: string | null
          sender_id: string
          session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_edited?: boolean | null
          is_read?: boolean | null
          read_at?: string | null
          sender_id?: string
          session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_session_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "social_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      social_chat_sessions: {
        Row: {
          chat_type: string
          created_at: string | null
          group_id: string | null
          id: string
          last_message_at: string | null
          updated_at: string | null
          user_id1: string | null
          user_id2: string | null
        }
        Insert: {
          chat_type: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
          user_id1?: string | null
          user_id2?: string | null
        }
        Update: {
          chat_type?: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
          user_id1?: string | null
          user_id2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_chat_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_sessions_user_id1_fkey"
            columns: ["user_id1"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_sessions_user_id2_fkey"
            columns: ["user_id2"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_comment_media: {
        Row: {
          comment_id: string
          created_at: string | null
          filename: string
          id: string
          mime_type: string
          size_bytes: number
          type: string
          url: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          filename: string
          id?: string
          mime_type: string
          size_bytes: number
          type: string
          url: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          filename?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comment_media_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      social_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          parent_comment_id: string | null
          post_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_event_attendees: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "social_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_events: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string
          group_id: string | null
          id: string
          is_online: boolean | null
          location: string | null
          max_attendees: number | null
          organizer_id: string
          start_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date: string
          group_id?: string | null
          id?: string
          is_online?: boolean | null
          location?: string | null
          max_attendees?: number | null
          organizer_id: string
          start_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string
          group_id?: string | null
          id?: string
          is_online?: boolean | null
          location?: string | null
          max_attendees?: number | null
          organizer_id?: string
          start_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_groups: {
        Row: {
          avatar_url: string | null
          category: string
          cover_image_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          members_count: number | null
          name: string
          posts_count: number | null
          privacy: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          category: string
          cover_image_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          members_count?: number | null
          name: string
          posts_count?: number | null
          privacy?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          category?: string
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          members_count?: number | null
          name?: string
          posts_count?: number | null
          privacy?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_hashtags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          posts_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          posts_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          posts_count?: number | null
        }
        Relationships: []
      }
      social_likes: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          mime_type: string
          post_id: string
          size_bytes: number
          thumbnail_url: string | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          mime_type: string
          post_id: string
          size_bytes: number
          thumbnail_url?: string | null
          type: string
          url: string
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          mime_type?: string
          post_id?: string
          size_bytes?: number
          thumbnail_url?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_notifications: {
        Row: {
          actor_id: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          post_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          post_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          post_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_hashtags: {
        Row: {
          created_at: string | null
          hashtag_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          hashtag_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          hashtag_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "social_hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_tags: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "social_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_views: {
        Row: {
          id: string
          post_id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          author_id: string
          bookmarks_count: number | null
          comments_count: number | null
          content: string
          created_at: string | null
          group_id: string | null
          id: string
          likes_count: number | null
          metadata: Json | null
          privacy: string | null
          shares_count: number | null
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          author_id: string
          bookmarks_count?: number | null
          comments_count?: number | null
          content: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          likes_count?: number | null
          metadata?: Json | null
          privacy?: string | null
          shares_count?: number | null
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          author_id?: string
          bookmarks_count?: number | null
          comments_count?: number | null
          content?: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          likes_count?: number | null
          metadata?: Json | null
          privacy?: string | null
          shares_count?: number | null
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_posts_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_reports: {
        Row: {
          comment_id: string | null
          created_at: string | null
          description: string | null
          group_id: string | null
          id: string
          moderator_id: string | null
          post_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          moderator_id?: string | null
          post_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          moderator_id?: string | null
          post_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_shares: {
        Row: {
          created_at: string | null
          id: string
          original_post_id: string
          share_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          original_post_id: string
          share_text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          original_post_id?: string
          share_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_shares_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      social_users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          email: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          interests: string[] | null
          is_contributor: boolean | null
          is_public: boolean | null
          is_verified: boolean | null
          last_active: string | null
          posts_count: number | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          email?: string | null
          followers_count?: number | null
          following_count?: number | null
          id: string
          interests?: string[] | null
          is_contributor?: boolean | null
          is_public?: boolean | null
          is_verified?: boolean | null
          last_active?: string | null
          posts_count?: number | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          email?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          interests?: string[] | null
          is_contributor?: boolean | null
          is_public?: boolean | null
          is_verified?: boolean | null
          last_active?: string | null
          posts_count?: number | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          paystack_customer_code: string | null
          paystack_sub_code: string | null
          plan_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_sub_code?: string | null
          plan_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_sub_code?: string | null
          plan_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_learning_goals: {
        Row: {
          category: string | null
          created_at: string | null
          goal_text: string
          id: string
          is_completed: boolean | null
          progress: number | null
          target_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          goal_text: string
          id?: string
          is_completed?: boolean | null
          progress?: number | null
          target_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          goal_text?: string
          id?: string
          is_completed?: boolean | null
          progress?: number | null
          target_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          average_score: number
          badges_earned: string[]
          created_at: string
          current_streak: number
          last_activity_date: string | null
          level: number
          longest_streak: number
          total_quizzes_attempted: number
          total_quizzes_completed: number
          total_study_time_seconds: number
          total_xp: number
          updated_at: string
          user_id: string
          weak_areas: string[] | null
        }
        Insert: {
          average_score?: number
          badges_earned?: string[]
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          total_quizzes_attempted?: number
          total_quizzes_completed?: number
          total_study_time_seconds?: number
          total_xp?: number
          updated_at?: string
          user_id: string
          weak_areas?: string[] | null
        }
        Update: {
          average_score?: number
          badges_earned?: string[]
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          total_quizzes_attempted?: number
          total_quizzes_completed?: number
          total_study_time_seconds?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
          weak_areas?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      chat_session_memory_stats: {
        Row: {
          context_size_bytes: number | null
          context_status: string | null
          created_at: string | null
          id: string | null
          last_message_at: string | null
          last_summary_update: number | null
          memory_strategy: string | null
          message_count: number | null
          messages_since_summary: number | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          context_size_bytes?: number | null
          context_status?: never
          created_at?: string | null
          id?: string | null
          last_message_at?: string | null
          last_summary_update?: number | null
          memory_strategy?: string | null
          message_count?: number | null
          messages_since_summary?: never
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          context_size_bytes?: number | null
          context_status?: never
          created_at?: string | null
          id?: string | null
          last_message_at?: string | null
          last_summary_update?: number | null
          memory_strategy?: string | null
          message_count?: number | null
          messages_since_summary?: never
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_session_summaries: {
        Row: {
          chat_type: string | null
          created_at: string | null
          group_id: string | null
          id: string | null
          last_message_at: string | null
          unread_count_user1: number | null
          unread_count_user2: number | null
          updated_at: string | null
          user_id1: string | null
          user_id2: string | null
        }
        Insert: {
          chat_type?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string | null
          last_message_at?: string | null
          unread_count_user1?: never
          unread_count_user2?: never
          updated_at?: string | null
          user_id1?: string | null
          user_id2?: string | null
        }
        Update: {
          chat_type?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string | null
          last_message_at?: string | null
          unread_count_user1?: never
          unread_count_user2?: never
          updated_at?: string | null
          user_id1?: string | null
          user_id2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_chat_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_sessions_user_id1_fkey"
            columns: ["user_id1"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_chat_sessions_user_id2_fkey"
            columns: ["user_id2"]
            isOneToOne: false
            referencedRelation: "social_users"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_stats: {
        Row: {
          avg_reviews: number | null
          due_for_review: number | null
          easy_cards: number | null
          hard_cards: number | null
          last_study_session: string | null
          medium_cards: number | null
          note_id: string | null
          total_cards: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _social_groups_recalc_members_count_for: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      approve_group_member: {
        Args: {
          p_approver_id: string
          p_group_id: string
          p_membership_id: string
          p_user_id: string
        }
        Returns: Json
      }
      check_user_is_cohost: {
        Args: { p_podcast_id: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      expire_old_podcast_invites: { Args: never; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      generate_unique_username: { Args: { p_email: string }; Returns: string }
      get_due_flashcards: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          back: string
          category: string
          difficulty: string
          ease_factor: number
          front: string
          hint: string
          id: string
          review_count: number
        }[]
      }
      get_folder_documents_recursive: {
        Args: { p_folder_id: string; p_user_id: string }
        Returns: {
          content_extracted: string
          file_name: string
          file_type: string
          id: string
          processing_status: string
          title: string
          type: string
        }[]
      }
      get_learning_velocity: {
        Args: { p_user_id: string; p_weeks: number }
        Returns: {
          items: number
          week: string
        }[]
      }
      get_or_create_group_chat_session: {
        Args: { p_group_id: string }
        Returns: string
      }
      get_session_unread_count: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      get_suggested_users: {
        Args: {
          p_exclude_ids: string[]
          p_limit: number
          p_offset: number
          p_user_id: string
        }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          followers_count: number
          following_count: number
          id: string
          interests: string[]
          is_verified: boolean
          last_active: string
          posts_count: number
          recommendation_score: number
          username: string
        }[]
      }
      get_user_activity_stats: {
        Args: { p_days: number; p_user_id: string }
        Returns: {
          date: string
          documents: number
          messages: number
          notes: number
          recordings: number
          total: number
        }[]
      }
      get_user_stats_with_achievements: {
        Args: { user_uuid: string }
        Returns: {
          achievements_count: number
          average_score: number
          badges_earned: string[]
          current_streak: number
          last_activity_date: string
          level: number
          longest_streak: number
          total_quizzes_attempted: number
          total_quizzes_completed: number
          total_study_time_seconds: number
          total_xp: number
          user_id: string
        }[]
      }
      get_user_streak: {
        Args: { p_user_id: string }
        Returns: {
          current_streak: number
          max_streak: number
        }[]
      }
      get_user_unread_count: { Args: { p_user_id: string }; Returns: number }
      get_xp_for_level: { Args: { level_num: number }; Returns: number }
      handle_new_user_inner: { Args: { p_new: Json }; Returns: undefined }
      increment_podcast_listen_count: {
        Args: { podcast_id: string }
        Returns: undefined
      }
      increment_podcast_share_count: {
        Args: { podcast_id: string }
        Returns: undefined
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | {
            Args: {
              _min_role?: Database["public"]["Enums"]["admin_role"]
              _user_id: string
            }
            Returns: boolean
          }
      log_admin_activity: {
        Args: {
          _action: string
          _details?: Json
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { notification_id: string }
        Returns: undefined
      }
      mark_session_messages_read: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      process_referral_reward: {
        Args: { p_referee_id: string; p_referral_code: string }
        Returns: Json
      }
      review_flashcard: {
        Args: { p_flashcard_id: string; p_quality: number; p_user_id: string }
        Returns: undefined
      }
      update_goal_progress: {
        Args: { goal_id: string; new_progress: number }
        Returns: undefined
      }
      upsert_notification_subscription: {
        Args: {
          p_auth: string
          p_browser: string
          p_device_type: string
          p_endpoint: string
          p_p256dh: string
        }
        Returns: Json
      }
    }
    Enums: {
      admin_role: "super_admin" | "admin" | "moderator"
      message_role: "user" | "assistant"
      note_category:
        | "general"
        | "math"
        | "science"
        | "history"
        | "language"
        | "other"
      schedule_item_type: "class" | "study" | "assignment" | "exam" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["super_admin", "admin", "moderator"],
      message_role: ["user", "assistant"],
      note_category: [
        "general",
        "math",
        "science",
        "history",
        "language",
        "other",
      ],
      schedule_item_type: ["class", "study", "assignment", "exam", "other"],
    },
  },
} as const
