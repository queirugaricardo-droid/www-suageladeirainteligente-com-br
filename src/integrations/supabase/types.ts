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
      analises_foto: {
        Row: {
          created_at: string
          fotos: number
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fotos?: number
          id?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          fotos?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          acesso_fim: string | null
          acesso_inicio: string | null
          created_at: string
          id: string
          pagamento_verificado_em: string | null
          plano: string
          provedor: string | null
          provedor_assinatura_id: string | null
          renovacao_em: string | null
          status: string
          transacao_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acesso_fim?: string | null
          acesso_inicio?: string | null
          created_at?: string
          id?: string
          pagamento_verificado_em?: string | null
          plano?: string
          provedor?: string | null
          provedor_assinatura_id?: string | null
          renovacao_em?: string | null
          status?: string
          transacao_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acesso_fim?: string | null
          acesso_inicio?: string | null
          created_at?: string
          id?: string
          pagamento_verificado_em?: string | null
          plano?: string
          provedor?: string | null
          provedor_assinatura_id?: string | null
          renovacao_em?: string | null
          status?: string
          transacao_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalogo_alimentos: {
        Row: {
          categoria: string
          chave_nome: string | null
          created_at: string
          emoji: string | null
          id: string
          nome: string
          origem: string
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          chave_nome?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          nome: string
          origem?: string
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          categoria?: string
          chave_nome?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          nome?: string
          origem?: string
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estoque_ideal: {
        Row: {
          categoria: string
          created_at: string
          emoji: string | null
          id: string
          nome: string
          quantidade: number
          unidade: string
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          emoji?: string | null
          id?: string
          nome: string
          quantidade?: number
          unidade?: string
          user_id?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          emoji?: string | null
          id?: string
          nome?: string
          quantidade?: number
          unidade?: string
          user_id?: string
        }
        Relationships: []
      }
      historico_analise_itens: {
        Row: {
          alimento_id: string | null
          analise_id: string
          categoria: string
          confianca: number | null
          emoji: string | null
          estimado: boolean
          id: string
          nome: string
          quantidade: number
          unidade: string
          user_id: string
        }
        Insert: {
          alimento_id?: string | null
          analise_id: string
          categoria?: string
          confianca?: number | null
          emoji?: string | null
          estimado?: boolean
          id?: string
          nome: string
          quantidade: number
          unidade: string
          user_id?: string
        }
        Update: {
          alimento_id?: string | null
          analise_id?: string
          categoria?: string
          confianca?: number | null
          emoji?: string | null
          estimado?: boolean
          id?: string
          nome?: string
          quantidade?: number
          unidade?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_analise_itens_alimento_id_user_id_fkey"
            columns: ["alimento_id", "user_id"]
            isOneToOne: false
            referencedRelation: "catalogo_alimentos"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "historico_analise_itens_analise_id_user_id_fkey"
            columns: ["analise_id", "user_id"]
            isOneToOne: false
            referencedRelation: "historico_analises"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      historico_analises: {
        Row: {
          created_at: string
          id: string
          relatorio: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relatorio: Json
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          relatorio?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome_completo: string
          termos_aceitos_em: string | null
          termos_versao: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nome_completo?: string
          termos_aceitos_em?: string | null
          termos_versao?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome_completo?: string
          termos_aceitos_em?: string | null
          termos_versao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_termos_conta: {
        Args: { p_aceito: boolean; p_nome: string }
        Returns: undefined
      }
      salvar_analise_confirmada: {
        Args: { p_id: string; p_relatorio: Json }
        Returns: string
      }
      tem_acesso_pago: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
