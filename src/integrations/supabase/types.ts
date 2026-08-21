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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      allowed_email_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          criteria_description: string | null
          description: string | null
          icon_url: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          criteria_description?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          criteria_description?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      course_lessons: {
        Row: {
          created_at: string
          duration_minutes: number
          has_practice: boolean
          id: string
          order_index: number
          practice_topic: string | null
          section_id: string
          title: string
          youtube_video_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          has_practice?: boolean
          id?: string
          order_index?: number
          practice_topic?: string | null
          section_id: string
          title: string
          youtube_video_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          has_practice?: boolean
          id?: string
          order_index?: number
          practice_topic?: string | null
          section_id?: string
          title?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language_id?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      dictionary_terms: {
        Row: {
          created_at: string
          definition: string
          example_code: string | null
          id: string
          language_id: string | null
          tags: string[]
          term: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition: string
          example_code?: string | null
          id?: string
          language_id?: string | null
          tags?: string[]
          term: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: string
          example_code?: string | null
          id?: string
          language_id?: string | null
          tags?: string[]
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dictionary_terms_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          event_id: string
          id: string
          registered_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          registered_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          registered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          registration_link: string | null
          start_time: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          registration_link?: string | null
          start_time: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          registration_link?: string | null
          start_time?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          tags: string[]
          title: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          tags?: string[]
          title: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reply_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reply_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reply_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_votes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          name: string
          piston_language: string | null
          piston_version: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          piston_language?: string | null
          piston_version?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          piston_language?: string | null
          piston_version?: string | null
          slug?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          points: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          points?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          category: string
          constraints: string | null
          created_at: string
          description: string
          difficulty: string
          id: string
          language_id: string | null
          memory_limit_mb: number
          points: number
          sample_table: string | null
          slug: string
          sql_setup: string | null
          starter_code: string | null
          tier: string | null
          time_limit_ms: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          constraints?: string | null
          created_at?: string
          description: string
          difficulty: string
          id?: string
          language_id?: string | null
          memory_limit_mb?: number
          points?: number
          sample_table?: string | null
          slug: string
          sql_setup?: string | null
          starter_code?: string | null
          tier?: string | null
          time_limit_ms?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          constraints?: string | null
          created_at?: string
          description?: string
          difficulty?: string
          id?: string
          language_id?: string | null
          memory_limit_mb?: number
          points?: number
          sample_table?: string | null
          slug?: string
          sql_setup?: string | null
          starter_code?: string | null
          tier?: string | null
          time_limit_ms?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language_id: string | null
          source: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language_id?: string | null
          source?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language_id?: string | null
          source?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_links_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          code: string
          id: string
          is_first_solve: boolean
          language: string | null
          points_awarded: number
          question_id: string | null
          runtime_ms: number | null
          status: string | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          is_first_solve?: boolean
          language?: string | null
          points_awarded?: number
          question_id?: string | null
          runtime_ms?: number | null
          status?: string | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          is_first_solve?: boolean
          language?: string | null
          points_awarded?: number
          question_id?: string | null
          runtime_ms?: number | null
          status?: string | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          created_at: string
          expected_output: string | null
          id: string
          input: string | null
          is_hidden: boolean
          is_sample: boolean
          question_id: string
        }
        Insert: {
          created_at?: string
          expected_output?: string | null
          id?: string
          input?: string | null
          is_hidden?: boolean
          is_sample?: boolean
          question_id: string
        }
        Update: {
          created_at?: string
          expected_output?: string | null
          id?: string
          input?: string | null
          is_hidden?: boolean
          is_sample?: boolean
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          badge_count: number | null
          full_name: string | null
          month_points: number | null
          points: number | null
          rank: number | null
          solved_count: number | null
          user_id: string | null
          week_points: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_badge: {
        Args: { _name: string; _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      refresh_leaderboard: { Args: never; Returns: undefined }
      seed_question: {
        Args: {
          _category: string
          _constraints: string
          _description: string
          _difficulty: string
          _lang_slug: string
          _memory_limit_mb?: number
          _points: number
          _sample_table?: string
          _slug: string
          _sql_setup?: string
          _starter: string
          _tests: Json
          _tier?: string
          _time_limit_ms?: number
          _title: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "student" | "manager" | "admin"
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
      app_role: ["student", "manager", "admin"],
    },
  },
} as const
