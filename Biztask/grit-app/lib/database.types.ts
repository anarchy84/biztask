// 한글 주석: Supabase 자동 생성 타입 (수동 수정 금지)
//
// ▣ 재생성 방법:
//   - Cowork에서: mcp__supabase__generate_typescript_types 호출
//   - 로컬 CLI: npx supabase gen types typescript --project-id lqotquxmmrshikevqnsg > lib/database.types.ts
//
// ▣ V2 마이그레이션 (2026-04-28):
//   - profiles: tier/business_number/verified_at/subscription_until/region/years_in_business
//               /cover_url/grit_score/grit_score_updated_at/follower_count/following_count
//   - posts: quoted_post_id/is_quote/video_url/video_thumbnail_url/bookmark_count/quote_count/image_urls
//   - follows: 신규 테이블 (M009)
//   - user_tier enum: guest/general/verified/blue

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
          onboarded?: boolean
          region?: string | null
          subscription_until?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
          verified_at?: string | null
          years_in_business?: number | null
        }
        Relationships: []
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
      [_ in never]: never
    }
    Enums: {
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
      post_category: "humor" | "worry" | "question" | "tip"
      reaction_target: "post" | "comment"
      reaction_type: "like" | "dislike"
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
      post_category: ["humor", "worry", "question", "tip"],
      reaction_target: ["post", "comment"],
      reaction_type: ["like", "dislike"],
      user_tier: ["guest", "general", "verified", "blue"],
    },
  },
} as const
