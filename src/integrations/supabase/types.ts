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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          absence_date: string
          created_at: string
          id: string
          reason: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          absence_date: string
          created_at?: string
          id?: string
          reason?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          absence_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      acompte_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          new_balance: number | null
          note: string | null
          previous_balance: number | null
          transaction_date: string
          type: string
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          new_balance?: number | null
          note?: string | null
          previous_balance?: number | null
          transaction_date?: string
          type: string
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          new_balance?: number | null
          note?: string | null
          previous_balance?: number | null
          transaction_date?: string
          type?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acompte_transactions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      conges: {
        Row: {
          conge_type: string
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          conge_type?: string
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          conge_type?: string
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conges_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: Json
          created_at: string
          document_type: string
          id: string
          rejection_reason: string | null
          responsible_validated_at: string | null
          responsible_validator_id: string | null
          rh_validated_at: string | null
          rh_validator_id: string | null
          status: Database["public"]["Enums"]["validation_status"]
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validated_by_responsible: boolean
          validated_by_rh: boolean
          worker_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          document_type: string
          id?: string
          rejection_reason?: string | null
          responsible_validated_at?: string | null
          responsible_validator_id?: string | null
          rh_validated_at?: string | null
          rh_validator_id?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_responsible?: boolean
          validated_by_rh?: boolean
          worker_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          document_type?: string
          id?: string
          rejection_reason?: string | null
          responsible_validated_at?: string | null
          responsible_validator_id?: string | null
          rh_validated_at?: string | null
          rh_validator_id?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_responsible?: boolean
          validated_by_rh?: boolean
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          acte_naissance: string | null
          address: string | null
          cin: string | null
          created_at: string
          current_balance: number
          date_debut_contrat: string | null
          date_demission: string | null
          date_fin_contrat: string | null
          date_naissance: string | null
          department: string | null
          duree_contrat: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_department_head: boolean
          lieu_naissance: string | null
          matricule: string | null
          monthly_retention: number
          numero_compte: string | null
          numero_social: string | null
          phone: string | null
          position: string | null
          sexe: string | null
          situation_familiale: string | null
          updated_at: string
        }
        Insert: {
          acte_naissance?: string | null
          address?: string | null
          cin?: string | null
          created_at?: string
          current_balance?: number
          date_debut_contrat?: string | null
          date_demission?: string | null
          date_fin_contrat?: string | null
          date_naissance?: string | null
          department?: string | null
          duree_contrat?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_department_head?: boolean
          lieu_naissance?: string | null
          matricule?: string | null
          monthly_retention?: number
          numero_compte?: string | null
          numero_social?: string | null
          phone?: string | null
          position?: string | null
          sexe?: string | null
          situation_familiale?: string | null
          updated_at?: string
        }
        Update: {
          acte_naissance?: string | null
          address?: string | null
          cin?: string | null
          created_at?: string
          current_balance?: number
          date_debut_contrat?: string | null
          date_demission?: string | null
          date_fin_contrat?: string | null
          date_naissance?: string | null
          department?: string | null
          duree_contrat?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_department_head?: boolean
          lieu_naissance?: string | null
          matricule?: string | null
          monthly_retention?: number
          numero_compte?: string | null
          numero_social?: string | null
          phone?: string | null
          position?: string | null
          sexe?: string | null
          situation_familiale?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      user_role:
        | "ADMIN"
        | "PRODUCTION"
        | "ENGINEER"
        | "MAINTENANCE"
        | "GDS"
        | "MONTAGE"
        | "IT"
        | "GENIE_CIVIL"
        | "RH"
        | "FINANCE"
        | "CLIENT"
        | "HSE"
        | "CNC"
        | "VISITEUR"
        | "UNITE_ONE"
        | "UNITE_TWO"
        | "GERANT"
      validation_status: "PENDING" | "VALIDATED" | "REJECTED"
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
      user_role: [
        "ADMIN",
        "PRODUCTION",
        "ENGINEER",
        "MAINTENANCE",
        "GDS",
        "MONTAGE",
        "IT",
        "GENIE_CIVIL",
        "RH",
        "FINANCE",
        "CLIENT",
        "HSE",
        "CNC",
        "VISITEUR",
        "UNITE_ONE",
        "UNITE_TWO",
        "GERANT",
      ],
      validation_status: ["PENDING", "VALIDATED", "REJECTED"],
    },
  },
} as const
