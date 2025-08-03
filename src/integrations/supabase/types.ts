export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
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
      app_stats: { // Added app_stats table definition
        Row: {
          id: string
          active_users: string
          notes_processed: string
          uptime: string
          user_rating: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          active_users?: string
          notes_processed?: string
          uptime?: string
          user_rating?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          active_users?: string
          notes_processed?: string
          uptime?: string
          user_rating?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          id: string
          is_error: boolean | null
          role: Database["public"]["Enums"]["message_role"]
          session_id: string | null
          timestamp: string | null
          user_id: string
          image_url?: string;
          image_mime_type?: string;
            attached_document_ids?: string[] | null; // Array of document IDs attached to this message
            attached_note_ids?: string[] | null; // Array of note IDs attached to this message
            has_been_displayed: boolean // Indicates if the message has been displayed to the user
        }
        Insert: {
          content: string
          id?: string
          is_error?: boolean | null
          role: Database["public"]["Enums"]["message_role"]
          session_id?: string | null
          timestamp?: string | null
          user_id: string
          image_url?: string;
          image_mime_type?: string;
            attached_document_ids?: string[] | null; // Array of document IDs attached to this message
            attached_note_ids?: string[] | null; // Array of note IDs attached to this message
            has_been_displayed:boolean
        }
        Update: {
          content?: string
          id?: string
          is_error?: boolean | null
          role?: Database["public"]["Enums"]["message_role"]
          session_id?: string | null
          timestamp?: string | null
          user_id?: string
          image_url?: string;
          image_mime_type?: string;
            attached_document_ids?: string[] | null; // Array of document IDs attached to this message
            attached_note_ids?: string[] | null; // Array of note IDs attached to this message
            has_been_displayed:boolean
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
          created_at: string
          document_ids: string[] | null
          id: string
          last_message_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_ids?: string[] | null
          id?: string
          last_message_at?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_ids?: string[] | null
          id?: string
          last_message_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      documents: {
        Row: {
          content_extracted: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          title: string
          updated_at: string
          user_id: string
          type: "text" | "image" | "audio"
          processing_error: string // This column needs to exist in your 'documents' table schema
          processing_status: string

        }
        Insert: {
          content_extracted?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
          type: "text" | "image" | "audio"
          processing_error?: string // This column needs to exist in your 'documents' table schema
          processing_status: String
        }
        Update: {
          content_extracted?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          type?: "text" | "image" | "audio"
          processing_error?: string // This column needs to exist in your 'documents' table schema
          processing_status: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
