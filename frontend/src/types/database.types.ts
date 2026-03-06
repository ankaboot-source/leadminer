export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  private: {
    Tables: {
      domains: {
        Row: {
          email_server_type: string | null;
          id: string;
          last_check: string | null;
          name: string | null;
        };
        Insert: {
          email_server_type?: string | null;
          id?: string;
          last_check?: string | null;
          name?: string | null;
        };
        Update: {
          email_server_type?: string | null;
          id?: string;
          last_check?: string | null;
          name?: string | null;
        };
        Relationships: [];
      };
      email_status: {
        Row: {
          created_at: string;
          details: Json | null;
          email: string;
          status: Database['private']['Enums']['status_enum'];
          updated_at: string;
          user_id: string;
          verified_on: string;
        };
        Insert: {
          created_at?: string;
          details?: Json | null;
          email: string;
          status: Database['private']['Enums']['status_enum'];
          updated_at?: string;
          user_id: string;
          verified_on: string;
        };
        Update: {
          created_at?: string;
          details?: Json | null;
          email?: string;
          status?: Database['private']['Enums']['status_enum'];
          updated_at?: string;
          user_id?: string;
          verified_on?: string;
        };
        Relationships: [];
      };
      engagement: {
        Row: {
          email: string;
          engagement_created_at: string | null;
          engagement_type: Database['private']['Enums']['engagement_type_enum'];
          service: string;
          user_id: string;
        };
        Insert: {
          email: string;
          engagement_created_at?: string | null;
          engagement_type: Database['private']['Enums']['engagement_type_enum'];
          service: string;
          user_id: string;
        };
        Update: {
          email?: string;
          engagement_created_at?: string | null;
          engagement_type?: Database['private']['Enums']['engagement_type_enum'];
          service?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          channel: string | null;
          conversation: boolean | null;
          date: string | null;
          folder_path: string | null;
          list_id: string | null;
          message_id: string;
          references: string[] | null;
          user_id: string;
        };
        Insert: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id: string;
          references?: string[] | null;
          user_id: string;
        };
        Update: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id?: string;
          references?: string[] | null;
          user_id?: string;
        };
        Relationships: [];
      };
      messages_0: {
        Row: {
          channel: string | null;
          conversation: boolean | null;
          date: string | null;
          folder_path: string | null;
          list_id: string | null;
          message_id: string;
          references: string[] | null;
          user_id: string;
        };
        Insert: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id: string;
          references?: string[] | null;
          user_id: string;
        };
        Update: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id?: string;
          references?: string[] | null;
          user_id?: string;
        };
        Relationships: [];
      };
      messages_1: {
        Row: {
          channel: string | null;
          conversation: boolean | null;
          date: string | null;
          folder_path: string | null;
          list_id: string | null;
          message_id: string;
          references: string[] | null;
          user_id: string;
        };
        Insert: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id: string;
          references?: string[] | null;
          user_id: string;
        };
        Update: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id?: string;
          references?: string[] | null;
          user_id?: string;
        };
        Relationships: [];
      };
      messages_2: {
        Row: {
          channel: string | null;
          conversation: boolean | null;
          date: string | null;
          folder_path: string | null;
          list_id: string | null;
          message_id: string;
          references: string[] | null;
          user_id: string;
        };
        Insert: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id: string;
          references?: string[] | null;
          user_id: string;
        };
        Update: {
          channel?: string | null;
          conversation?: boolean | null;
          date?: string | null;
          folder_path?: string | null;
          list_id?: string | null;
          message_id?: string;
          references?: string[] | null;
          user_id?: string;
        };
        Relationships: [];
      };
      mining_sources: {
        Row: {
          created_at: string | null;
          credentials: string;
          email: string;
          passive_mining: boolean | null;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          credentials: string;
          email: string;
          passive_mining?: boolean | null;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          credentials?: string;
          email?: string;
          passive_mining?: boolean | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string | null;
          details: Json | null;
          id: string;
          type: Database['public']['Enums']['notification_type'];
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          type: Database['public']['Enums']['notification_type'];
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          type?: Database['public']['Enums']['notification_type'];
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          _domain: string | null;
          alternate_name: string | null;
          email: string | null;
          founder: string | null;
          id: string;
          image: string | null;
          legal_name: string | null;
          location: string[] | null;
          name: string;
          telephone: string | null;
          url: string | null;
        };
        Insert: {
          _domain?: string | null;
          alternate_name?: string | null;
          email?: string | null;
          founder?: string | null;
          id?: string;
          image?: string | null;
          legal_name?: string | null;
          location?: string[] | null;
          name: string;
          telephone?: string | null;
          url?: string | null;
        };
        Update: {
          _domain?: string | null;
          alternate_name?: string | null;
          email?: string | null;
          founder?: string | null;
          id?: string;
          image?: string | null;
          legal_name?: string | null;
          location?: string[] | null;
          name?: string;
          telephone?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations__domain_fkey';
            columns: ['_domain'];
            isOneToOne: false;
            referencedRelation: 'domains';
            referencedColumns: ['id'];
          },
        ];
      };
      persons: {
        Row: {
          alternate_email: string[] | null;
          alternate_name: string[] | null;
          created_at: string;
          email: string;
          family_name: string | null;
          given_name: string | null;
          identifiers: string[] | null;
          image: string | null;
          job_title: string | null;
          location: string | null;
          location_normalized: Json | null;
          mining_id: string | null;
          name: string | null;
          same_as: string[] | null;
          source: string;
          status: string | null;
          telephone: string[] | null;
          updated_at: string;
          url: string | null;
          user_id: string;
          works_for: string | null;
        };
        Insert: {
          alternate_email?: string[] | null;
          alternate_name?: string[] | null;
          created_at?: string;
          email: string;
          family_name?: string | null;
          given_name?: string | null;
          identifiers?: string[] | null;
          image?: string | null;
          job_title?: string | null;
          location?: string | null;
          location_normalized?: Json | null;
          mining_id?: string | null;
          name?: string | null;
          same_as?: string[] | null;
          source: string;
          status?: string | null;
          telephone?: string[] | null;
          updated_at?: string;
          url?: string | null;
          user_id: string;
          works_for?: string | null;
        };
        Update: {
          alternate_email?: string[] | null;
          alternate_name?: string[] | null;
          created_at?: string;
          email?: string;
          family_name?: string | null;
          given_name?: string | null;
          identifiers?: string[] | null;
          image?: string | null;
          job_title?: string | null;
          location?: string | null;
          location_normalized?: Json | null;
          mining_id?: string | null;
          name?: string | null;
          same_as?: string[] | null;
          source?: string;
          status?: string | null;
          telephone?: string[] | null;
          updated_at?: string;
          url?: string | null;
          user_id?: string;
          works_for?: string | null;
        };
        Relationships: [];
      };
      pointsofcontact: {
        Row: {
          bcc: boolean | null;
          body: boolean | null;
          cc: boolean | null;
          from: boolean | null;
          id: string;
          message_id: string | null;
          name: string | null;
          person_email: string | null;
          plus_address: string | null;
          reply_to: boolean | null;
          to: boolean | null;
          user_id: string;
        };
        Insert: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id: string;
        };
        Update: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id?: string;
        };
        Relationships: [];
      };
      pointsofcontact_0: {
        Row: {
          bcc: boolean | null;
          body: boolean | null;
          cc: boolean | null;
          from: boolean | null;
          id: string;
          message_id: string | null;
          name: string | null;
          person_email: string | null;
          plus_address: string | null;
          reply_to: boolean | null;
          to: boolean | null;
          user_id: string;
        };
        Insert: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id: string;
        };
        Update: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id?: string;
        };
        Relationships: [];
      };
      pointsofcontact_1: {
        Row: {
          bcc: boolean | null;
          body: boolean | null;
          cc: boolean | null;
          from: boolean | null;
          id: string;
          message_id: string | null;
          name: string | null;
          person_email: string | null;
          plus_address: string | null;
          reply_to: boolean | null;
          to: boolean | null;
          user_id: string;
        };
        Insert: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id: string;
        };
        Update: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id?: string;
        };
        Relationships: [];
      };
      pointsofcontact_2: {
        Row: {
          bcc: boolean | null;
          body: boolean | null;
          cc: boolean | null;
          from: boolean | null;
          id: string;
          message_id: string | null;
          name: string | null;
          person_email: string | null;
          plus_address: string | null;
          reply_to: boolean | null;
          to: boolean | null;
          user_id: string;
        };
        Insert: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id: string;
        };
        Update: {
          bcc?: boolean | null;
          body?: boolean | null;
          cc?: boolean | null;
          from?: boolean | null;
          id?: string;
          message_id?: string | null;
          name?: string | null;
          person_email?: string | null;
          plus_address?: string | null;
          reply_to?: boolean | null;
          to?: boolean | null;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          email: string | null;
          full_name: string | null;
          gdpr_details: Json;
          user_id: string;
        };
        Insert: {
          email?: string | null;
          full_name?: string | null;
          gdpr_details?: Json;
          user_id: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          gdpr_details?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      refinedpersons: {
        Row: {
          conversations: number | null;
          created_at: string;
          email: string;
          engagement: number | null;
          occurrence: number | null;
          recency: string | null;
          recipient: number | null;
          replied_conversations: number | null;
          sender: number | null;
          seniority: string | null;
          tags: string[] | null;
          temperature: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversations?: number | null;
          created_at?: string;
          email: string;
          engagement?: number | null;
          occurrence?: number | null;
          recency?: string | null;
          recipient?: number | null;
          replied_conversations?: number | null;
          sender?: number | null;
          seniority?: string | null;
          tags?: string[] | null;
          temperature?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversations?: number | null;
          created_at?: string;
          email?: string;
          engagement?: number | null;
          occurrence?: number | null;
          recency?: string | null;
          recipient?: number | null;
          replied_conversations?: number | null;
          sender?: number | null;
          seniority?: string | null;
          tags?: string[] | null;
          temperature?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      signatures: {
        Row: {
          created_at: string | null;
          details: Json;
          extracted_signature: Json;
          message_id: string;
          person_email: string;
          raw_signature: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          details: Json;
          extracted_signature: Json;
          message_id: string;
          person_email: string;
          raw_signature: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          details?: Json;
          extracted_signature?: Json;
          message_id?: string;
          person_email?: string;
          raw_signature?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          name: string;
          person_email: string;
          reachable: number | null;
          source: string | null;
          user_id: string;
        };
        Insert: {
          name: string;
          person_email: string;
          reachable?: number | null;
          source?: string | null;
          user_id: string;
        };
        Update: {
          name?: string;
          person_email?: string;
          reachable?: number | null;
          source?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tags_0: {
        Row: {
          name: string;
          person_email: string;
          reachable: number | null;
          source: string | null;
          user_id: string;
        };
        Insert: {
          name: string;
          person_email: string;
          reachable?: number | null;
          source?: string | null;
          user_id: string;
        };
        Update: {
          name?: string;
          person_email?: string;
          reachable?: number | null;
          source?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tags_1: {
        Row: {
          name: string;
          person_email: string;
          reachable: number | null;
          source: string | null;
          user_id: string;
        };
        Insert: {
          name: string;
          person_email: string;
          reachable?: number | null;
          source?: string | null;
          user_id: string;
        };
        Update: {
          name?: string;
          person_email?: string;
          reachable?: number | null;
          source?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tags_2: {
        Row: {
          name: string;
          person_email: string;
          reachable: number | null;
          source: string | null;
          user_id: string;
        };
        Insert: {
          name: string;
          person_email: string;
          reachable?: number | null;
          source?: string | null;
          user_id: string;
        };
        Update: {
          name?: string;
          person_email?: string;
          reachable?: number | null;
          source?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          category: Database['private']['Enums']['task_category_enum'];
          details: Json | null;
          duration: number | null;
          id: string;
          started_at: string;
          status: Database['private']['Enums']['task_status_enum'] | null;
          stopped_at: string | null;
          type: Database['private']['Enums']['task_type_enum'];
          user_id: string | null;
        };
        Insert: {
          category: Database['private']['Enums']['task_category_enum'];
          details?: Json | null;
          duration?: number | null;
          id?: string;
          started_at?: string;
          status?: Database['private']['Enums']['task_status_enum'] | null;
          stopped_at?: string | null;
          type: Database['private']['Enums']['task_type_enum'];
          user_id?: string | null;
        };
        Update: {
          category?: Database['private']['Enums']['task_category_enum'];
          details?: Json | null;
          duration?: number | null;
          id?: string;
          started_at?: string;
          status?: Database['private']['Enums']['task_status_enum'] | null;
          stopped_at?: string | null;
          type?: Database['private']['Enums']['task_type_enum'];
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      contact_temperature: {
        Args: {
          sender_cnt: number;
          recipient_cnt: number;
          conversations_cnt: number;
          replied_conversations: number;
          recency_ts: string;
          seniority_ts: string;
          ref_ts?: string;
        };
        Returns: number;
      };
      custom_access_token_hook: {
        Args: {
          event: Json;
        };
        Returns: Json;
      };
      delete_contacts: {
        Args: {
          user_id: string;
          emails: string[];
          deleteallcontacts: boolean;
        };
        Returns: undefined;
      };
      delete_expired_clean_cache: {
        Args: {
          delete_interval: unknown;
        };
        Returns: undefined;
      };
      delete_expired_enrich_cache: {
        Args: {
          delete_interval: unknown;
        };
        Returns: undefined;
      };
      delete_user_data: {
        Args: {
          user_id: string;
        };
        Returns: undefined;
      };
      enrich_contacts: {
        Args: {
          p_contacts_data: Json[];
          p_update_empty_fields_only?: boolean;
        };
        Returns: undefined;
      };
      enriched_most_recent: {
        Args: {
          emails: string[];
        };
        Returns: Json[];
      };
      get_contacts_table: {
        Args: {
          user_id: string;
        };
        Returns: {
          source: string;
          email: string;
          name: string;
          status: string;
          image: string;
          location: string;
          location_normalized: Json;
          alternate_name: string[];
          alternate_email: string[];
          telephone: string[];
          same_as: string[];
          given_name: string;
          family_name: string;
          job_title: string;
          works_for: string;
          recency: string;
          seniority: string;
          occurrence: number;
          temperature: number;
          sender: number;
          recipient: number;
          conversations: number;
          replied_conversations: number;
          tags: string[];
          updated_at: string;
          created_at: string;
          mining_id: string;
        }[];
      };
      get_contacts_table_by_emails: {
        Args: {
          user_id: string;
          emails: string[];
        };
        Returns: {
          source: string;
          email: string;
          name: string;
          status: string;
          image: string;
          location: string;
          location_normalized: Json;
          alternate_name: string[];
          alternate_email: string[];
          telephone: string[];
          same_as: string[];
          given_name: string;
          family_name: string;
          job_title: string;
          works_for: string;
          recency: string;
          seniority: string;
          occurrence: number;
          temperature: number;
          sender: number;
          recipient: number;
          conversations: number;
          replied_conversations: number;
          tags: string[];
          updated_at: string;
          created_at: string;
          mining_id: string;
        }[];
      };
      get_distinct_or_exclude_from_array:
        | {
            Args: {
              input_array: string[];
              exclude_array?: string[];
            };
            Returns: string[];
          }
        | {
            Args: {
              input_array: unknown;
              exclude_array?: unknown;
            };
            Returns: unknown;
          }
        | {
            Args: {
              input_array: unknown;
              exclude_value?: unknown;
            };
            Returns: unknown;
          };
      get_mining_stats: {
        Args: {
          mining_id: string;
        };
        Returns: {
          user_id: string;
          source: string;
          total_contacts_mined: number;
          total_reachable: number;
          total_with_phone: number;
          total_with_company: number;
          total_with_location: number;
        }[];
      };
      populate_refined: {
        Args: {
          _userid: string;
        };
        Returns: undefined;
      };
      refine_persons: {
        Args: {
          userid: string;
        };
        Returns: undefined;
      };
      upsert_mining_source: {
        Args: {
          _user_id: string;
          _email: string;
          _type: string;
          _credentials: string;
          _encryption_key: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      engagement_type_enum: 'EXPORT' | 'ENRICH';
      status_enum: 'VALID' | 'RISKY' | 'INVALID' | 'UNKNOWN';
      task_category_enum: 'mining' | 'enriching' | 'cleaning';
      task_status_enum: 'running' | 'canceled' | 'done';
      task_type_enum:
        | 'fetch'
        | 'extract'
        | 'edit'
        | 'export'
        | 'enrich'
        | 'clean';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_old_pst_files: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      notification_type: 'enrich' | 'clean' | 'extract' | 'signature';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
        PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
    ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;
