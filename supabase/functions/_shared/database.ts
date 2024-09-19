export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      domains: {
        Row: {
          email_server_type: string | null
          id: string
          last_check: string | null
          name: string | null
        }
        Insert: {
          email_server_type?: string | null
          id?: string
          last_check?: string | null
          name?: string | null
        }
        Update: {
          email_server_type?: string | null
          id?: string
          last_check?: string | null
          name?: string | null
        }
        Relationships: []
      }
      engagement: {
        Row: {
          email: string
          engagement_created_at: string | null
          engagement_type: Database["public"]["Enums"]["engagement_type_enum"]
          user_id: string
        }
        Insert: {
          email: string
          engagement_created_at?: string | null
          engagement_type: Database["public"]["Enums"]["engagement_type_enum"]
          user_id: string
        }
        Update: {
          email?: string
          engagement_created_at?: string | null
          engagement_type?: Database["public"]["Enums"]["engagement_type_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string | null
          conversation: boolean | null
          date: string | null
          folder_path: string | null
          list_id: string | null
          message_id: string
          references: string[] | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id: string
          references?: string[] | null
          user_id: string
        }
        Update: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id?: string
          references?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      messages_0: {
        Row: {
          channel: string | null
          conversation: boolean | null
          date: string | null
          folder_path: string | null
          list_id: string | null
          message_id: string
          references: string[] | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id: string
          references?: string[] | null
          user_id: string
        }
        Update: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id?: string
          references?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      messages_1: {
        Row: {
          channel: string | null
          conversation: boolean | null
          date: string | null
          folder_path: string | null
          list_id: string | null
          message_id: string
          references: string[] | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id: string
          references?: string[] | null
          user_id: string
        }
        Update: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id?: string
          references?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2: {
        Row: {
          channel: string | null
          conversation: boolean | null
          date: string | null
          folder_path: string | null
          list_id: string | null
          message_id: string
          references: string[] | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id: string
          references?: string[] | null
          user_id: string
        }
        Update: {
          channel?: string | null
          conversation?: boolean | null
          date?: string | null
          folder_path?: string | null
          list_id?: string | null
          message_id?: string
          references?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      mining_sources: {
        Row: {
          created_at: string | null
          credentials: string
          email: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials: string
          email: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: string
          email?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          _domain: string | null
          alternate_name: string | null
          email: string | null
          founder: string | null
          id: string
          image: string | null
          legal_name: string | null
          location: string[] | null
          name: string
          telephone: string | null
          url: string | null
        }
        Insert: {
          _domain?: string | null
          alternate_name?: string | null
          email?: string | null
          founder?: string | null
          id?: string
          image?: string | null
          legal_name?: string | null
          location?: string[] | null
          name: string
          telephone?: string | null
          url?: string | null
        }
        Update: {
          _domain?: string | null
          alternate_name?: string | null
          email?: string | null
          founder?: string | null
          id?: string
          image?: string | null
          legal_name?: string | null
          location?: string[] | null
          name?: string
          telephone?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations__domain_fkey"
            columns: ["_domain"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          alternate_names: string[] | null
          created_at: string
          email: string
          family_name: string | null
          given_name: string | null
          identifiers: string[] | null
          image: string | null
          job_title: string | null
          location: string[] | null
          name: string | null
          same_as: string[] | null
          source: string
          status: string | null
          updated_at: string
          url: string | null
          user_id: string
          verification_details: Json | null
          works_for: string | null
        }
        Insert: {
          alternate_names?: string[] | null
          created_at?: string
          email: string
          family_name?: string | null
          given_name?: string | null
          identifiers?: string[] | null
          image?: string | null
          job_title?: string | null
          location?: string[] | null
          name?: string | null
          same_as?: string[] | null
          source: string
          status?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
          verification_details?: Json | null
          works_for?: string | null
        }
        Update: {
          alternate_names?: string[] | null
          created_at?: string
          email?: string
          family_name?: string | null
          given_name?: string | null
          identifiers?: string[] | null
          image?: string | null
          job_title?: string | null
          location?: string[] | null
          name?: string | null
          same_as?: string[] | null
          source?: string
          status?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
          verification_details?: Json | null
          works_for?: string | null
        }
        Relationships: []
      }
      pointsofcontact: {
        Row: {
          bcc: boolean | null
          body: boolean | null
          cc: boolean | null
          from: boolean | null
          id: string
          message_id: string | null
          name: string | null
          person_email: string | null
          reply_to: boolean | null
          to: boolean | null
          user_id: string
        }
        Insert: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id: string
        }
        Update: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      pointsofcontact_0: {
        Row: {
          bcc: boolean | null
          body: boolean | null
          cc: boolean | null
          from: boolean | null
          id: string
          message_id: string | null
          name: string | null
          person_email: string | null
          reply_to: boolean | null
          to: boolean | null
          user_id: string
        }
        Insert: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id: string
        }
        Update: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      pointsofcontact_1: {
        Row: {
          bcc: boolean | null
          body: boolean | null
          cc: boolean | null
          from: boolean | null
          id: string
          message_id: string | null
          name: string | null
          person_email: string | null
          reply_to: boolean | null
          to: boolean | null
          user_id: string
        }
        Insert: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id: string
        }
        Update: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      pointsofcontact_2: {
        Row: {
          bcc: boolean | null
          body: boolean | null
          cc: boolean | null
          from: boolean | null
          id: string
          message_id: string | null
          name: string | null
          person_email: string | null
          reply_to: boolean | null
          to: boolean | null
          user_id: string
        }
        Insert: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id: string
        }
        Update: {
          bcc?: boolean | null
          body?: boolean | null
          cc?: boolean | null
          from?: boolean | null
          id?: string
          message_id?: string | null
          name?: string | null
          person_email?: string | null
          reply_to?: boolean | null
          to?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          email: string | null
          full_name: string | null
          user_id: string
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          user_id: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refinedpersons: {
        Row: {
          conversations: number | null
          created_at: string
          email: string
          engagement: number | null
          occurrence: number | null
          recency: string | null
          recipient: number | null
          replied_conversations: number | null
          sender: number | null
          seniority: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversations?: number | null
          created_at?: string
          email: string
          engagement?: number | null
          occurrence?: number | null
          recency?: string | null
          recipient?: number | null
          replied_conversations?: number | null
          sender?: number | null
          seniority?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversations?: number | null
          created_at?: string
          email?: string
          engagement?: number | null
          occurrence?: number | null
          recency?: string | null
          recipient?: number | null
          replied_conversations?: number | null
          sender?: number | null
          seniority?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          name: string
          person_email: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_email: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_email?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags_0: {
        Row: {
          name: string
          person_email: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_email: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_email?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags_1: {
        Row: {
          name: string
          person_email: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_email: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_email?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags_2: {
        Row: {
          name: string
          person_email: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_email: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_email?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: Database["public"]["Enums"]["task_category_enum"]
          details: Json | null
          duration: number | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["task_status_enum"] | null
          stopped_at: string | null
          type: Database["public"]["Enums"]["task_type_enum"]
          user_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["task_category_enum"]
          details?: Json | null
          duration?: number | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["task_status_enum"] | null
          stopped_at?: string | null
          type: Database["public"]["Enums"]["task_type_enum"]
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category_enum"]
          details?: Json | null
          duration?: number | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["task_status_enum"] | null
          stopped_at?: string | null
          type?: Database["public"]["Enums"]["task_type_enum"]
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user_data: {
        Args: {
          user_id: string
        }
        Returns: undefined
      }
      enrich_contacts: {
        Args: {
          p_contacts_data: Json[]
          p_update_empty_fields_only?: boolean
        }
        Returns: undefined
      }
      get_contacts_table: {
        Args: {
          user_id: string
        }
        Returns: {
          source: string
          email: string
          name: string
          status: string
          image: string
          location: string[]
          alternate_names: string[]
          same_as: string[]
          given_name: string
          family_name: string
          job_title: string
          works_for: string
          recency: string
          seniority: string
          occurrence: number
          sender: number
          recipient: number
          conversations: number
          replied_conversations: number
          tags: string[]
          updated_at: string
          created_at: string
        }[]
      }
      get_contacts_table_by_emails: {
        Args: {
          user_id: string
          emails: string[]
        }
        Returns: {
          source: string
          email: string
          name: string
          status: string
          image: string
          location: string[]
          alternate_names: string[]
          same_as: string[]
          given_name: string
          family_name: string
          job_title: string
          works_for: string
          recency: string
          seniority: string
          occurrence: number
          sender: number
          recipient: number
          conversations: number
          replied_conversations: number
          tags: string[]
          updated_at: string
          created_at: string
        }[]
      }
      get_grouped_tags_by_person: {
        Args: {
          _userid: string
        }
        Returns: {
          email: string
          tags: string[]
          tags_reachability: number[]
        }[]
      }
      populate_refined: {
        Args: {
          _userid: string
        }
        Returns: undefined
      }
      refine_persons: {
        Args: {
          user_id: string
        }
        Returns: undefined
      }
      upsert_mining_source: {
        Args: {
          _user_id: string
          _email: string
          _type: string
          _credentials: string
          _encryption_key: string
        }
        Returns: undefined
      }
    }
    Enums: {
      engagement_type_enum: "CSV" | "ENRICH"
      task_category_enum: "mining" | "enriching" | "cleaning"
      task_status_enum: "running" | "canceled" | "done"
      task_type_enum:
        | "fetch"
        | "extract"
        | "edit"
        | "export"
        | "enrich"
        | "clean"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

