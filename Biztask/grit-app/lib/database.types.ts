// 한글 주석: Supabase 자동 생성 타입 (수동 수정 금지)
//
// ▣ 재생성 방법:
//   - Cowork에서: mcp__supabase__generate_typescript_types 호출
//   - 로컬 CLI: npx supabase gen types typescript --project-id lqotquxmmrshikevqnsg > lib/database.types.ts
//
// ▣ 마이그레이션 적용 (2026-04-29):
//   - M011: RLS + 카운터 트리거 보강 (current_user_tier_rank 등)
//   - M012: 활어 엔진 V2 - npc_personas/content_backlog/npc_activity_log + secret_* category
//   - M013: pg_cron 4종 (post-publisher/comment-bot/vote-bot/secret-lounge-bot)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          dislike_count: number
          id: string
          is_deleted: boolean
          like_count: number
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          dislike_count?: number
          id?: string
          is_deleted?: boolean
          like_count?: number
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          dislike_count?: number
          id?: string
          is_deleted?: boolean
          like_count?: number
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_backlog: {
        Row: {
          assigned_persona_id: string | null
          category: Database["public"]["Enums"]["post_category"]
          created_at: string
          id: string
          published_at: string | null
          published_post_id: string | null
          redaction_notes: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          scheduled_for: string | null
          source_body: string | null
          source_comments: Json | null
          source_title: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["backlog_status"]
          target_surface: Database["public"]["Enums"]["content_surface"]
        }
        Insert: {
          assigned_persona_id?: string | null
          category?: Database["public"]["Enums"]["post_category"]
          created_at?: string
          id?: string
          published_at?: string | null
          published_post_id?: string | null
          redaction_notes?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          scheduled_for?: string | null
          source_body?: string | null
          source_comments?: Json | null
          source_title?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["backlog_status"]
          target_surface?: Database["public"]["Enums"]["content_surface"]
        }
        Update: {
          assigned_persona_id?: string | null
          category?: Database["public"]["Enums"]["post_category"]
          created_at?: string
          id?: string
          published_at?: string | null
          published_post_id?: string | null
          redaction_notes?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          scheduled_for?: string | null
          source_body?: string | null
          source_comments?: Json | null
          source_title?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["backlog_status"]
          target_surface?: Database["public"]["Enums"]["content_surface"]
        }
        Relationships: [
          {
            foreignKeyName: "content_backlog_assigned_persona_id_fkey"
            columns: ["assigned_persona_id"]
            isOneToOne: false
            referencedRelation: "npc_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_backlog_published_post_id_fkey"
            columns: ["published_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_activity_log: {
        Row: {
          action_type: Database["public"]["Enums"]["npc_action_type"]
          created_at: string
          engine_version: string
          id: string
          persona_id: string
          surface: Database["public"]["Enums"]["content_surface"]
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["npc_action_type"]
          created_at?: string
          engine_version?: string
          id?: string
          persona_id: string
          surface?: Database["public"]["Enums"]["content_surface"]
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["npc_action_type"]
          created_at?: string
          engine_version?: string
          id?: string
          persona_id?: string
          surface?: Database["public"]["Enums"]["content_surface"]
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "npc_activity_log_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "npc_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_personas: {
        Row: {
          active_hours: number[]
          category_weights: Json
          comment_freq_per_day: number
          created_at: string
          display_name: string
          id: string
          industry: Database["public"]["Enums"]["industry"]
          is_active: boolean
          notes: string | null
          post_freq_per_day: number
          primary_categories: Database["public"]["Enums"]["post_category"][]
          profile_id: string | null
          region: string | null
          tier: Database["public"]["Enums"]["user_tier"]
          tone: string
          updated_at: string
          vote_freq_per_day: number
          years_in_business: number | null
        }
        Insert: {
          active_hours?: number[]
          category_weights?: Json
          comment_freq_per_day?: number
          created_at?: string
          display_name: string
          id?: string
          industry: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          notes?: string | null
          post_freq_per_day?: number
          primary_categories?: Database["public"]["Enums"]["post_category"][]
          profile_id?: string | null
          region?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          tone: string
          updated_at?: string
          vote_freq_per_day?: number
          years_in_business?: number | null
        }
        Update: {
          active_hours?: number[]
          category_weights?: Json
          comment_freq_per_day?: number
          created_at?: string
          display_name?: string
          id?: string
          industry?: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          notes?: string | null
          post_freq_per_day?: number
          primary_categories?: Database["public"]["Enums"]["post_category"][]
          profile_id?: string | null
          region?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          tone?: string
          updated_at?: string
          vote_freq_per_day?: number
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "npc_personas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          bookmark_count: number
          category: Database["public"]["Enums"]["post_category"]
          comment_count: number
          created_at: string
          dislike_count: number
          id: string
          image_url: string | null
          image_urls: string[]
          is_deleted: boolean
          is_quote: boolean
          like_count: number
          quote_count: number
          quoted_post_id: string | null
          title: string
          updated_at: string
          video_thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          author_id: string
          body: string
          bookmark_count?: number
          category?: Database["public"]["Enums"]["post_category"]
          comment_count?: number
          created_at?: string
          dislike_count?: number
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_deleted?: boolean
          is_quote?: boolean
          like_count?: number
          quote_count?: number
          quoted_post_id?: string | null
          title: string
          updated_at?: string
          video_thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          bookmark_count?: number
          category?: Database["public"]["Enums"]["post_category"]
          comment_count?: number
          created_at?: string
          dislike_count?: number
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_deleted?: boolean
          is_quote?: boolean
          like_count?: number
          quote_count?: number
          quoted_post_id?: string | null
          title?: string
          updated_at?: string
          video_thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_quoted_post_id_fkey"
            columns: ["quoted_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          business_number: string | null
          cover_url: string | null
          created_at: string
          follower_count: number
          following_count: number
          grit_score: number
          grit_score_updated_at: string | null
          id: string
          industry: Database["public"]["Enums"]["industry"]
          is_npc: boolean
          nickname: string
          npc_persona_id: string | null
          onboarded: boolean
          region: string | null
          subscription_until: string | null
          tier: Database["public"]["Enums"]["user_tier"]
          updated_at: string
          verified_at: string | null
          years_in_business: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          business_number?: string | null
          cover_url?: string | null
          created_at?: string
          follower_count?: number
          following_count?: number
          grit_score?: number
          grit_score_updated_at?: string | null
          id: string
          industry?: Database["public"]["Enums"]["industry"]
          is_npc?: boolean
          nickname: string
          npc_persona_id?: string | null
          onboarded?: boolean
          region?: string | null
          subscription_until?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
          verified_at?: string | null
          years_in_business?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          business_number?: string | null
          cover_url?: string | null
          created_at?: string
          follower_count?: number
          following_count?: number
          grit_score?: number
          grit_score_updated_at?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["industry"]
          is_npc?: boolean
          nickname?: string
          npc_persona_id?: string | null
          onboarded?: boolean
          region?: string | null
          subscription_until?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
          verified_at?: string | null
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_npc_persona_id_fkey"
            columns: ["npc_persona_id"]
            isOneToOne: false
            referencedRelation: "npc_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          type: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["reaction_target"]
          type: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["reaction_target"]
          type?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
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
      current_user_tier_rank: { Args: never; Returns: number }
      get_feed_ranked: {
        Args: { p_limit?: number; p_offset?: number; p_viewer_id: string }
        Returns: {
          author_id: string
          body: string
          bookmark_count: number
          category: Database["public"]["Enums"]["post_category"]
          comment_count: number
          created_at: string
          dislike_count: number
          id: string
          image_urls: string[]
          is_quote: boolean
          like_count: number
          quote_count: number
          quoted_post_id: string
          rank_score: number
          title: string
          video_thumbnail_url: string
          video_url: string
        }[]
      }
      get_npc_load_balance: {
        Args: {
          p_action_type?: Database["public"]["Enums"]["npc_action_type"]
          p_surface?: Database["public"]["Enums"]["content_surface"]
        }
        Returns: {
          load_score: number
          persona_id: string
          recent_count: number
        }[]
      }
    }
    Enums: {
      backlog_status: "queued" | "published" | "discarded"
      content_surface: "feed" | "secret_lounge"
      industry:
        | "cafe"
        | "food"
        | "beauty"
        | "retail"
        | "online"
        | "service"
        | "education"
        | "health"
        | "creative"
        | "etc"
      npc_action_type:
        | "post"
        | "comment"
        | "reply"
        | "reaction_like"
        | "reaction_dislike"
        | "follow"
      post_category:
        | "humor"
        | "worry"
        | "question"
        | "tip"
        | "secret_staffing"
        | "secret_cost"
        | "secret_property"
        | "secret_trouble"
      reaction_target: "post" | "comment"
      reaction_type: "like" | "dislike"
      risk_level: "low" | "medium" | "high"
      user_tier: "guest" | "general" | "verified" | "blue"
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
      backlog_status: ["queued", "published", "discarded"],
      content_surface: ["feed", "secret_lounge"],
      industry: [
        "cafe",
        "food",
        "beauty",
        "retail",
        "online",
        "service",
        "education",
        "health",
        "creative",
        "etc",
      ],
      npc_action_type: [
        "post",
        "comment",
        "reply",
        "reaction_like",
        "reaction_dislike",
        "follow",
      ],
      post_category: [
        "humor",
        "worry",
        "question",
        "tip",
        "secret_staffing",
        "secret_cost",
        "secret_property",
        "secret_trouble",
      ],
      reaction_target: ["post", "comment"],
      reaction_type: ["like", "dislike"],
      risk_level: ["low", "medium", "high"],
      user_tier: ["guest", "general", "verified", "blue"],
    },
  },
} as const
