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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      client_deliveries: {
        Row: {
          watermark: boolean
          client_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          message: string | null
          password_hash: string | null
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          watermark?: boolean
          client_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          password_hash?: string | null
          title?: string
          token: string
          updated_at?: string
        }
        Update: {
          watermark?: boolean
          client_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          password_hash?: string | null
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_delivery_events: {
        Row: {
          created_at: string
          delivery_id: string
          file_id: string | null
          id: string
          kind: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          file_id?: string | null
          id?: string
          kind: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          file_id?: string | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "client_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_delivery_events_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "client_delivery_files"
            referencedColumns: ["id"]
          },
        ]
      }
      client_delivery_files: {
        Row: {
          preview_wm_path: string | null
          client_note: string | null
          created_at: string
          delivery_id: string
          favorite: boolean
          file_name: string
          h: number | null
          id: string
          position: number
          preview_path: string | null
          size: number
          storage_path: string
          w: number | null
        }
        Insert: {
          preview_wm_path?: string | null
          client_note?: string | null
          created_at?: string
          delivery_id: string
          favorite?: boolean
          file_name: string
          h?: number | null
          id?: string
          position?: number
          preview_path?: string | null
          size?: number
          storage_path: string
          w?: number | null
        }
        Update: {
          preview_wm_path?: string | null
          client_note?: string | null
          created_at?: string
          delivery_id?: string
          favorite?: boolean
          file_name?: string
          h?: number | null
          id?: string
          position?: number
          preview_path?: string | null
          size?: number
          storage_path?: string
          w?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_delivery_files_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "client_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          album: string | null
          created_at: string
          full_src: string
          h: number
          id: string
          origin_category: string | null
          sm: string
          source_piece_id: string | null
          source_url: string | null
          src: string
          storage_path: string | null
          w: number
        }
        Insert: {
          album?: string | null
          created_at?: string
          full_src: string
          h: number
          id?: string
          origin_category?: string | null
          sm: string
          source_piece_id?: string | null
          source_url?: string | null
          src: string
          storage_path?: string | null
          w: number
        }
        Update: {
          album?: string | null
          created_at?: string
          full_src?: string
          h?: number
          id?: string
          origin_category?: string | null
          sm?: string
          source_piece_id?: string | null
          source_url?: string | null
          src?: string
          storage_path?: string | null
          w?: number
        }
        Relationships: []
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          id: number
          path: string
          referrer: string | null
          visitor: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: never
          path: string
          referrer?: string | null
          visitor: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: never
          path?: string
          referrer?: string | null
          visitor?: string
        }
        Relationships: []
      }
      photoshoot_images: {
        Row: {
          media_id: string
          photoshoot_id: string
          position: number
        }
        Insert: {
          media_id: string
          photoshoot_id: string
          position?: number
        }
        Update: {
          media_id?: string
          photoshoot_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "photoshoot_images_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photoshoot_images_photoshoot_id_fkey"
            columns: ["photoshoot_id"]
            isOneToOne: false
            referencedRelation: "photoshoots"
            referencedColumns: ["id"]
          },
        ]
      }
      photoshoots: {
        Row: {
          album: string | null
          category: string
          cover_media_id: string | null
          created_at: string
          id: string
          import_batch: string | null
          review_status: string | null
          sort_order: number
          source_album: string | null
          source_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          album?: string | null
          category: string
          cover_media_id?: string | null
          created_at?: string
          id?: string
          import_batch?: string | null
          review_status?: string | null
          sort_order?: number
          source_album?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          album?: string | null
          category?: string
          cover_media_id?: string | null
          created_at?: string
          id?: string
          import_batch?: string | null
          review_status?: string | null
          sort_order?: number
          source_album?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photoshoots_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          avatar_url: string | null
          body: string
          created_at: string
          delivery_id: string | null
          id: string
          name: string
          rating: number | null
          source_key: string | null
          status: string
        }
        Insert: {
          avatar_url?: string | null
          body: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          name: string
          rating?: number | null
          source_key?: string | null
          status?: string
        }
        Update: {
          avatar_url?: string | null
          body?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          name?: string
          rating?: number | null
          source_key?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "client_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          report_week: string | null
          about_image: Json | null
          featured_columns: number | null
          featured_work: Json | null
          hero_slides: Json | null
          id: number
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          report_week?: string | null
          about_image?: Json | null
          featured_columns?: number | null
          featured_work?: Json | null
          hero_slides?: Json | null
          id?: number
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          report_week?: string | null
          about_image?: Json | null
          featured_columns?: number | null
          featured_work?: Json | null
          hero_slides?: Json | null
          id?: number
          updated_at?: string
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
