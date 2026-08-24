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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          type?: string
          user_id?: string
        }
        Relationships: []
      }
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
      certificates: {
        Row: {
          certificate_code: string
          course_id: string
          id: string
          issued_at: string
          user_id: string
        }
        Insert: {
          certificate_code: string
          course_id: string
          id?: string
          issued_at?: string
          user_id: string
        }
        Update: {
          certificate_code?: string
          course_id?: string
          id?: string
          issued_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          created_at: string
          drip_after_days: number | null
          duration_minutes: number
          has_practice: boolean
          id: string
          order_index: number
          practice_topic: string | null
          release_at: string | null
          section_id: string
          title: string
          youtube_video_id: string | null
        }
        Insert: {
          created_at?: string
          drip_after_days?: number | null
          duration_minutes?: number
          has_practice?: boolean
          id?: string
          order_index?: number
          practice_topic?: string | null
          release_at?: string | null
          section_id: string
          title: string
          youtube_video_id?: string | null
        }
        Update: {
          created_at?: string
          drip_after_days?: number | null
          duration_minutes?: number
          has_practice?: boolean
          id?: string
          order_index?: number
          practice_topic?: string | null
          release_at?: string | null
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
      course_prerequisites: {
        Row: {
          course_id: string
          created_at: string
          prerequisite_course_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          prerequisite_course_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          prerequisite_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_prerequisites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_prerequisite_course_id_fkey"
            columns: ["prerequisite_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_quizzes: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          pass_threshold: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          pass_threshold?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          pass_threshold?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          course_id: string
          created_at: string
          id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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
      daily_challenge_completions: {
        Row: {
          completed_at: string
          daily_challenge_id: string
          id: string
          submission_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          daily_challenge_id: string
          id?: string
          submission_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string
          daily_challenge_id?: string
          id?: string
          submission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenge_completions_daily_challenge_id_fkey"
            columns: ["daily_challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_challenge_completions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenges: {
        Row: {
          challenge_date: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          challenge_date: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          challenge_date?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
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
      event_feedback: {
        Row: {
          comment: string | null
          created_at: string
          event_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          event_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          event_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          checked_in_at: string | null
          event_id: string
          id: string
          registered_at: string
          reminder_sent_at: string | null
          status: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          event_id: string
          id?: string
          registered_at?: string
          reminder_sent_at?: string | null
          status?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          event_id?: string
          id?: string
          registered_at?: string
          reminder_sent_at?: string | null
          status?: string
          team_id?: string | null
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
          {
            foreignKeyName: "event_registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          banner_url: string | null
          capacity: number | null
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
          capacity?: number | null
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
          capacity?: number | null
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
          accepted_reply_id: string | null
          body: string
          created_at: string
          id: string
          question_id: string | null
          tags: string[]
          title: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          accepted_reply_id?: string | null
          body: string
          created_at?: string
          id?: string
          question_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          accepted_reply_id?: string | null
          body?: string
          created_at?: string
          id?: string
          question_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_accepted_reply_id_fkey"
            columns: ["accepted_reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
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
      group_challenges: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          group_id: string
          id: string
          question_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          group_id: string
          id?: string
          question_id: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          group_id?: string
          id?: string
          question_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_challenges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_challenges_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
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
      learning_path_courses: {
        Row: {
          course_id: string
          id: string
          order_index: number
          path_id: string
        }
        Insert: {
          course_id: string
          id?: string
          order_index?: number
          path_id: string
        }
        Update: {
          course_id?: string
          id?: string
          order_index?: number
          path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_courses_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: []
      }
      lesson_comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          lesson_id: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          lesson_id: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string
          id: string
          last_position_seconds: number
          lesson_id: string
          user_id: string
          watch_seconds: number
        }
        Insert: {
          completed?: boolean
          completed_at?: string
          id?: string
          last_position_seconds?: number
          lesson_id: string
          user_id: string
          watch_seconds?: number
        }
        Update: {
          completed?: boolean
          completed_at?: string
          id?: string
          last_position_seconds?: number
          lesson_id?: string
          user_id?: string
          watch_seconds?: number
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
      lesson_resources: {
        Row: {
          created_at: string
          file_url: string
          id: string
          lesson_id: string
          order_index: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          lesson_id: string
          order_index?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          lesson_id?: string
          order_index?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_assignments: {
        Row: {
          assigned_at: string
          id: string
          mentor_id: string
          student_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          mentor_id: string
          student_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          mentor_id?: string
          student_id?: string
        }
        Relationships: []
      }
      mentor_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_booked: boolean
          mentor_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_booked?: boolean
          mentor_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_booked?: boolean
          mentor_id?: string
          start_time?: string
        }
        Relationships: []
      }
      mentor_bookings: {
        Row: {
          availability_id: string
          cancelled_at: string | null
          created_at: string
          id: string
          mentee_id: string
          mentor_id: string
          status: string
        }
        Insert: {
          availability_id: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          mentee_id: string
          mentor_id: string
          status?: string
        }
        Update: {
          availability_id?: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          mentee_id?: string
          mentor_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_bookings_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: true
            referencedRelation: "mentor_availability"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_notes: {
        Row: {
          created_at: string
          id: string
          mentor_id: string
          note: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentor_id: string
          note: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentor_id?: string
          note?: string
          student_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          badge_earned: boolean
          created_at: string
          email_digest: boolean
          event_reminder: boolean
          forum_reply: boolean
          group_invite: boolean
          mentor_note: boolean
          streak_risk: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_earned?: boolean
          created_at?: string
          email_digest?: boolean
          event_reminder?: boolean
          forum_reply?: boolean
          group_invite?: boolean
          mentor_note?: boolean
          streak_risk?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_earned?: boolean
          created_at?: string
          email_digest?: boolean
          event_reminder?: boolean
          forum_reply?: boolean
          group_invite?: boolean
          mentor_note?: boolean
          streak_risk?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cp_rating: number
          created_at: string
          daily_streak_count: number
          daily_streak_last_date: string | null
          full_name: string | null
          id: string
          last_active_date: string | null
          leaderboard_opt_out: boolean
          points: number
          streak_count: number
          theme_preference: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cp_rating?: number
          created_at?: string
          daily_streak_count?: number
          daily_streak_last_date?: string | null
          full_name?: string | null
          id: string
          last_active_date?: string | null
          leaderboard_opt_out?: boolean
          points?: number
          streak_count?: number
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cp_rating?: number
          created_at?: string
          daily_streak_count?: number
          daily_streak_last_date?: string | null
          full_name?: string | null
          id?: string
          last_active_date?: string | null
          leaderboard_opt_out?: boolean
          points?: number
          streak_count?: number
          theme_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_hint_reveals: {
        Row: {
          hint_id: string
          revealed_at: string
          user_id: string
        }
        Insert: {
          hint_id: string
          revealed_at?: string
          user_id: string
        }
        Update: {
          hint_id?: string
          revealed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_hint_reveals_hint_id_fkey"
            columns: ["hint_id"]
            isOneToOne: false
            referencedRelation: "question_hints"
            referencedColumns: ["id"]
          },
        ]
      }
      question_hints: {
        Row: {
          created_at: string
          hint_text: string
          id: string
          order_index: number
          points_penalty: number
          question_id: string
        }
        Insert: {
          created_at?: string
          hint_text: string
          id?: string
          order_index?: number
          points_penalty?: number
          question_id: string
        }
        Update: {
          created_at?: string
          hint_text?: string
          id?: string
          order_index?: number
          points_penalty?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_hints_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_topics: {
        Row: {
          created_at: string
          id: string
          question_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_topics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "user_topic_mastery"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      questions: {
        Row: {
          category: string
          constraints: string | null
          created_at: string
          description: string
          difficulty: string
          editorial: string | null
          editorial_video_id: string | null
          id: string
          is_archived: boolean
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
          editorial?: string | null
          editorial_video_id?: string | null
          id?: string
          is_archived?: boolean
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
          editorial?: string | null
          editorial_video_id?: string | null
          id?: string
          is_archived?: boolean
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
      quiz_attempts: {
        Row: {
          attempted_at: string
          id: string
          passed: boolean
          quiz_id: string
          score: number
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          passed?: boolean
          quiz_id: string
          score?: number
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "course_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_option: number | null
          created_at: string
          explanation: string | null
          id: string
          kind: string
          options: Json
          order_index: number
          practice_question_id: string | null
          question_text: string
          quiz_id: string
        }
        Insert: {
          correct_option?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          kind?: string
          options?: Json
          order_index?: number
          practice_question_id?: string | null
          question_text: string
          quiz_id: string
        }
        Update: {
          correct_option?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          kind?: string
          options?: Json
          order_index?: number
          practice_question_id?: string | null
          question_text?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_practice_question_id_fkey"
            columns: ["practice_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "course_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_history: {
        Row: {
          created_at: string
          delta: number
          id: string
          new_rating: number
          old_rating: number
          question_id: string | null
          submission_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          new_rating: number
          old_rating: number
          question_id?: string | null
          submission_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          new_rating?: number
          old_rating?: number
          question_id?: string | null
          submission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
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
      study_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_posts: {
        Row: {
          body: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_replies: {
        Row: {
          body: string
          created_at: string
          group_id: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_replies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_group_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "study_group_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string
          is_public: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string
          is_public?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_public?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          score: number | null
          status: string | null
          submitted_at: string
          test_cases_passed: number
          test_cases_total: number
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
          score?: number | null
          status?: string | null
          submitted_at?: string
          test_cases_passed?: number
          test_cases_total?: number
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
          score?: number | null
          status?: string | null
          submitted_at?: string
          test_cases_passed?: number
          test_cases_total?: number
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
      team_members: {
        Row: {
          id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          invite_code: string
          max_size: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          invite_code?: string
          max_size?: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          invite_code?: string
          max_size?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      topics: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      user_topic_mastery: {
        Row: {
          accepted_submissions: number | null
          attempted: number | null
          pass_rate: number | null
          solved: number | null
          submissions: number | null
          topic_id: string | null
          topic_name: string | null
          topic_slug: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_cp_rating_update: {
        Args: { _question_id: string; _submission_id: string; _user_id: string }
        Returns: number
      }
      award_badge: {
        Args: { _name: string; _user_id: string }
        Returns: undefined
      }
      book_mentor_slot: {
        Args: { _availability_id: string; _mentee_id: string }
        Returns: string
      }
      cancel_mentor_booking: {
        Args: { _actor_id: string; _booking_id: string }
        Returns: undefined
      }
      create_notification: {
        Args: {
          _body?: string
          _link?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      gen_invite_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_course_unlocked: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      issue_certificate_if_complete: {
        Args: { _course_id: string; _user_id: string }
        Returns: string
      }
      notify_streak_risk: { Args: never; Returns: undefined }
      promote_next_waitlisted: {
        Args: { _event_id: string }
        Returns: undefined
      }
      refresh_leaderboard: { Args: never; Returns: undefined }
      register_for_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: string
      }
      reset_broken_streaks: { Args: never; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["student", "manager", "admin"],
    },
  },
} as const
