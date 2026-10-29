export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Versão do PostgREST do projeto na nuvem, como gerado por
  // `supabase gen types --linked`. Permite ao supabase-js inferir os tipos certos.
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          active: boolean;
          city: string | null;
          created_at: string;
          document: string | null;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          state: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          city?: string | null;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          city?: string | null;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          subtotal: number | null;
          unit_price: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          subtotal?: never;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          subtotal?: never;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          confirmed_at: string | null;
          created_at: string;
          created_by: string;
          customer_id: string;
          id: string;
          notes: string | null;
          number: number;
          status: Database["public"]["Enums"]["order_status"];
          total_amount: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          customer_id: string;
          id?: string;
          notes?: string | null;
          number?: never;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          customer_id?: string;
          id?: string;
          notes?: string | null;
          number?: never;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          category_id: string | null;
          cost_price: number;
          created_at: string;
          description: string | null;
          id: string;
          low_stock: boolean;
          min_stock: number;
          name: string;
          sale_price: number;
          sku: string;
          stock_quantity: number;
          unit: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          low_stock?: never;
          min_stock?: number;
          name: string;
          sale_price: number;
          sku: string;
          stock_quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          low_stock?: never;
          min_stock?: number;
          name?: string;
          sale_price?: number;
          sku?: string;
          stock_quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          created_at: string;
          full_name: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          full_name?: string;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          full_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          order_id: string | null;
          product_id: string;
          quantity: number;
          reason: string | null;
          type: Database["public"]["Enums"]["stock_movement_type"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          id?: string;
          order_id?: string | null;
          product_id: string;
          quantity: number;
          reason?: string | null;
          type: Database["public"]["Enums"]["stock_movement_type"];
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          order_id?: string | null;
          product_id?: string;
          quantity?: number;
          reason?: string | null;
          type?: Database["public"]["Enums"]["stock_movement_type"];
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      change_order_status: {
        Args: { p_order_id: string; p_status: Database["public"]["Enums"]["order_status"] };
        Returns: Database["public"]["Enums"]["order_status"];
      };
      save_order: {
        Args: { p_customer_id: string; p_items: Json; p_notes?: string; p_order_id?: string };
        Returns: string;
      };
      user_display_names: {
        Args: { user_ids: string[] };
        Returns: {
          full_name: string;
          id: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "operator";
      order_status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
      stock_movement_type: "in" | "out" | "adjustment";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator"],
      order_status: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      stock_movement_type: ["in", "out", "adjustment"],
    },
  },
} as const;
