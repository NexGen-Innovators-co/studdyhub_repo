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
          created_at: string
          extraction_model_used: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          processing_completed_at: string | null
          processing_error: string | null
          processing_metadata: Json | null
          processing_started_at: string | null
          processing_status: string | null
          title: string
          total_processing_time_ms: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_extracted?: string | null
          created_at?: string
          extraction_model_used?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_metadata?: Json | null
          processing_started_at?: string | null
          processing_status?: string | null
          title: string
          total_processing_time_ms?: number | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_extracted?: string | null
          created_at?: string
          extraction_model_used?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_metadata?: Json | null
          processing_started_at?: string | null
          processing_status?: string | null
          title?: string
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
      notes: {
        Row: {
          ai_summary: string | null
          category: Database["public"]["Enums"]["note_category"] | null
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
          category?: Database["public"]["Enums"]["note_category"] | null
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
          category?: Database["public"]["Enums"]["note_category"] | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          learning_preferences: Json | null
          learning_style: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          learning_preferences?: Json | null
          learning_style?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          learning_preferences?: Json | null
          learning_style?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          class_id: string | null
          created_at: string | null
          id: string
          questions: Json | null
          title: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          questions?: Json | null
          title: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          questions?: Json | null
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
      schedule_items: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          end_time: string
          id: string
          location: string | null
          start_time: string
          subject: string
          title: string
          type: Database["public"]["Enums"]["schedule_item_type"] | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          id?: string
          location?: string | null
          start_time: string
          subject: string
          title: string
          type?: Database["public"]["Enums"]["schedule_item_type"] | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          id?: string
          location?: string | null
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
      social_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          group_id?: string
          id?: string
          sender_id?: string
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
          is_verified?: boolean | null
          last_active?: string | null
          posts_count?: number | null
          updated_at?: string | null
          username?: string
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
    }
    Functions: {
      get_suggested_users: {
        Args: {
          p_user_id: string
          p_exclude_ids: string[]
          p_limit: number
          p_offset: number
        }
        Returns: {
          id: string
          username: string
          display_name: string
          avatar_url: string | null
          bio: string | null
          interests: string[] | null
          followers_count: number | null
          following_count: number | null
          posts_count: number | null
          is_verified: boolean | null
          last_active: string | null
          created_at: string | null
          recommendation_score: number
        }[]
      }
      generate_unique_username: { Args: { p_email: string }; Returns: string }
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
      is_admin: {
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
