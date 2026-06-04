export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
export type Database = {
  private: {
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
      email_campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_type: Database["private"]["Enums"]["email_campaign_event_type"]
          id: number
          recipient_id: string
          url: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_type: Database["private"]["Enums"]["email_campaign_event_type"]
          id?: never
          recipient_id: string
          url?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_type?: Database["private"]["Enums"]["email_campaign_event_type"]
          id?: never
          recipient_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_links: {
        Row: {
          campaign_id: string
          created_at: string
          recipient_id: string
          short_token: string | null
          token: string
          url: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          recipient_id: string
          short_token?: string | null
          token?: string
          url: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          recipient_id?: string
          short_token?: string | null
          token?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_links_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          attempt_count: number
          bounce_type: string | null
          campaign_id: string
          contact_email: string
          contact_temperature: number | null
          created_at: string
          family_name: string | null
          given_name: string | null
          id: string
          job_title: string | null
          last_error: string | null
          location: string | null
          name: string | null
          open_short_token: string
          open_token: string
          send_status: Database["private"]["Enums"]["email_campaign_recipient_status"]
          sender_email: string
          sent_at: string | null
          smtp_code: string | null
          status: string | null
          unsubscribe_short_token: string
          unsubscribe_token: string
          updated_at: string
          user_id: string
          works_for: string | null
        }
        Insert: {
          attempt_count?: number
          bounce_type?: string | null
          campaign_id: string
          contact_email: string
          contact_temperature?: number | null
          created_at?: string
          family_name?: string | null
          given_name?: string | null
          id?: string
          job_title?: string | null
          last_error?: string | null
          location?: string | null
          name?: string | null
          open_short_token: string
          open_token?: string
          send_status?: Database["private"]["Enums"]["email_campaign_recipient_status"]
          sender_email: string
          sent_at?: string | null
          smtp_code?: string | null
          status?: string | null
          unsubscribe_short_token: string
          unsubscribe_token?: string
          updated_at?: string
          user_id: string
          works_for?: string | null
        }
        Update: {
          attempt_count?: number
          bounce_type?: string | null
          campaign_id?: string
          contact_email?: string
          contact_temperature?: number | null
          created_at?: string
          family_name?: string | null
          given_name?: string | null
          id?: string
          job_title?: string | null
          last_error?: string | null
          location?: string | null
          name?: string | null
          open_short_token?: string
          open_token?: string
          send_status?: Database["private"]["Enums"]["email_campaign_recipient_status"]
          sender_email?: string
          sent_at?: string | null
          smtp_code?: string | null
          status?: string | null
          unsubscribe_short_token?: string
          unsubscribe_token?: string
          updated_at?: string
          user_id?: string
          works_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body_html_template: string | null
          body_text_template: string | null
          completed_at: string | null
          created_at: string
          footer_html_template: string
          footer_text_template: string
          id: string
          only_valid_contacts: boolean
          owner_email: string
          plain_text_only: boolean
          reply_to: string
          sender_daily_limit: number
          sender_email: string
          sender_name: string
          started_at: string | null
          status: Database["private"]["Enums"]["email_campaign_status"]
          subject: string
          total_recipients: number
          track_click: boolean
          track_open: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html_template?: string | null
          body_text_template?: string | null
          completed_at?: string | null
          created_at?: string
          footer_html_template?: string
          footer_text_template?: string
          id?: string
          only_valid_contacts?: boolean
          owner_email: string
          plain_text_only?: boolean
          reply_to: string
          sender_daily_limit?: number
          sender_email: string
          sender_name: string
          started_at?: string | null
          status?: Database["private"]["Enums"]["email_campaign_status"]
          subject: string
          total_recipients?: number
          track_click?: boolean
          track_open?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html_template?: string | null
          body_text_template?: string | null
          completed_at?: string | null
          created_at?: string
          footer_html_template?: string
          footer_text_template?: string
          id?: string
          only_valid_contacts?: boolean
          owner_email?: string
          plain_text_only?: boolean
          reply_to?: string
          sender_daily_limit?: number
          sender_email?: string
          sender_name?: string
          started_at?: string | null
          status?: Database["private"]["Enums"]["email_campaign_status"]
          subject?: string
          total_recipients?: number
          track_click?: boolean
          track_open?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_status: {
        Row: {
          created_at: string
          details: Json | null
          email: string
          status: Database["private"]["Enums"]["status_enum"]
          updated_at: string
          user_id: string
          verified_on: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          email: string
          status: Database["private"]["Enums"]["status_enum"]
          updated_at?: string
          user_id: string
          verified_on: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          email?: string
          status?: Database["private"]["Enums"]["status_enum"]
          updated_at?: string
          user_id?: string
          verified_on?: string
        }
        Relationships: []
      }
      engagement: {
        Row: {
          engagement_created_at: string | null
          engagement_type: Database["private"]["Enums"]["engagement_type_enum"]
          person_id: string
          service: string
          user_id: string
        }
        Insert: {
          engagement_created_at?: string | null
          engagement_type: Database["private"]["Enums"]["engagement_type_enum"]
          person_id: string
          service: string
          user_id: string
        }
        Update: {
          engagement_created_at?: string | null
          engagement_type?: Database["private"]["Enums"]["engagement_type_enum"]
          person_id?: string
          service?: string
          user_id?: string
        }
        Relationships: []
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
          passive_mining: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials: string
          email: string
          passive_mining?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: string
          email?: string
          passive_mining?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          alternate_email: string[] | null
          alternate_name: string[] | null
          consent_changed_at: string | null
          consent_status: Database["private"]["Enums"]["contact_consent_status"]
          created_at: string
          email: string | null
          family_name: string | null
          given_name: string | null
          id: string
          identifiers: string[] | null
          image: string | null
          job_title: string | null
          location: string | null
          location_normalized: Json | null
          mining_id: string | null
          name: string | null
          same_as: string[] | null
          source: string
          status: string | null
          telephone: string[] | null
          updated_at: string
          url: string | null
          user_id: string
          works_for: string | null
        }
        Insert: {
          alternate_email?: string[] | null
          alternate_name?: string[] | null
          consent_changed_at?: string | null
          consent_status?: Database["private"]["Enums"]["contact_consent_status"]
          created_at?: string
          email?: string | null
          family_name?: string | null
          given_name?: string | null
          id?: string
          identifiers?: string[] | null
          image?: string | null
          job_title?: string | null
          location?: string | null
          location_normalized?: Json | null
          mining_id?: string | null
          name?: string | null
          same_as?: string[] | null
          source: string
          status?: string | null
          telephone?: string[] | null
          updated_at?: string
          url?: string | null
          user_id: string
          works_for?: string | null
        }
        Update: {
          alternate_email?: string[] | null
          alternate_name?: string[] | null
          consent_changed_at?: string | null
          consent_status?: Database["private"]["Enums"]["contact_consent_status"]
          created_at?: string
          email?: string | null
          family_name?: string | null
          given_name?: string | null
          id?: string
          identifiers?: string[] | null
          image?: string | null
          job_title?: string | null
          location?: string | null
          location_normalized?: Json | null
          mining_id?: string | null
          name?: string | null
          same_as?: string[] | null
          source?: string
          status?: string | null
          telephone?: string[] | null
          updated_at?: string
          url?: string | null
          user_id?: string
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
          person_id: string
          plus_address: string | null
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
          person_id: string
          plus_address?: string | null
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
          person_id?: string
          plus_address?: string | null
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
          person_id: string
          plus_address: string | null
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
          person_id: string
          plus_address?: string | null
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
          person_id?: string
          plus_address?: string | null
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
          person_id: string
          plus_address: string | null
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
          person_id: string
          plus_address?: string | null
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
          person_id?: string
          plus_address?: string | null
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
          person_id: string
          plus_address: string | null
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
          person_id: string
          plus_address?: string | null
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
          person_id?: string
          plus_address?: string | null
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
          gdpr_details: Json
          user_id: string
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          gdpr_details?: Json
          user_id: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          gdpr_details?: Json
          user_id?: string
        }
        Relationships: []
      }
      refinedpersons: {
        Row: {
          consent_changed_at: string | null
          conversations: number | null
          created_at: string
          engagement: number | null
          occurrence: number | null
          person_id: string
          recency: string | null
          recipient: number | null
          replied_conversations: number | null
          sender: number | null
          seniority: string | null
          tags: string[] | null
          temperature: number | null
          updated_at: string
          user_id: string
          user_tags: string[] | null
        }
        Insert: {
          consent_changed_at?: string | null
          conversations?: number | null
          created_at?: string
          engagement?: number | null
          occurrence?: number | null
          person_id: string
          recency?: string | null
          recipient?: number | null
          replied_conversations?: number | null
          sender?: number | null
          seniority?: string | null
          tags?: string[] | null
          temperature?: number | null
          updated_at?: string
          user_id: string
          user_tags?: string[] | null
        }
        Update: {
          consent_changed_at?: string | null
          conversations?: number | null
          created_at?: string
          engagement?: number | null
          occurrence?: number | null
          person_id?: string
          recency?: string | null
          recipient?: number | null
          replied_conversations?: number | null
          sender?: number | null
          seniority?: string | null
          tags?: string[] | null
          temperature?: number | null
          updated_at?: string
          user_id?: string
          user_tags?: string[] | null
        }
        Relationships: []
      }
      signatures: {
        Row: {
          created_at: string | null
          details: Json
          extracted_signature: Json
          message_id: string
          person_email: string
          raw_signature: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details: Json
          extracted_signature: Json
          message_id: string
          person_email: string
          raw_signature: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json
          extracted_signature?: Json
          message_id?: string
          person_email?: string
          raw_signature?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          name: string
          person_id: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_id: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_id?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags_0: {
        Row: {
          name: string
          person_id: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_id: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_id?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags_1: {
        Row: {
          name: string
          person_id: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_id: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_id?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags_2: {
        Row: {
          name: string
          person_id: string
          reachable: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          name: string
          person_id: string
          reachable?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          name?: string
          person_id?: string
          reachable?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: Database["private"]["Enums"]["task_category_enum"]
          details: Json | null
          duration: number | null
          id: string
          started_at: string
          status: Database["private"]["Enums"]["task_status_enum"] | null
          stopped_at: string | null
          type: Database["private"]["Enums"]["task_type_enum"]
          user_id: string | null
        }
        Insert: {
          category: Database["private"]["Enums"]["task_category_enum"]
          details?: Json | null
          duration?: number | null
          id?: string
          started_at?: string
          status?: Database["private"]["Enums"]["task_status_enum"] | null
          stopped_at?: string | null
          type: Database["private"]["Enums"]["task_type_enum"]
          user_id?: string | null
        }
        Update: {
          category?: Database["private"]["Enums"]["task_category_enum"]
          details?: Json | null
          duration?: number | null
          id?: string
          started_at?: string
          status?: Database["private"]["Enums"]["task_status_enum"] | null
          stopped_at?: string | null
          type?: Database["private"]["Enums"]["task_type_enum"]
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      contacts_view: {
        Row: {
          alternate_email: string[] | null
          alternate_name: string[] | null
          consent_changed_at: string | null
          consent_status:
            | Database["private"]["Enums"]["contact_consent_status"]
            | null
          created_at: string | null
          email: string | null
          family_name: string | null
          given_name: string | null
          id: string | null
          identifier: string | null
          image: string | null
          job_title: string | null
          location: string | null
          location_normalized: Json | null
          mining_id: string | null
          name: string | null
          same_as: string[] | null
          sources: string[] | null
          status: string | null
          telephone: string[] | null
          updated_at: string | null
          user_id: string | null
          works_for: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      contact_temperature: {
        Args: {
          conversations_cnt: number
          recency_ts: string
          recipient_cnt: number
          ref_ts?: string
          replied_conversations: number
          sender_cnt: number
          seniority_ts: string
        }
        Returns: number
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_contacts: {
        Args: { deleteallcontacts: boolean; ids: string[]; user_id: string }
        Returns: undefined
      }
      delete_expired_clean_cache: {
        Args: { delete_interval: string }
        Returns: undefined
      }
      delete_expired_enrich_cache: {
        Args: { delete_interval: string }
        Returns: undefined
      }
      delete_user_data: { Args: { user_id: string }; Returns: undefined }
      enrich_contacts: {
        Args: { p_contacts_data: Json[]; p_update_empty_fields_only?: boolean }
        Returns: undefined
      }
      enriched_most_recent: { Args: { emails: string[] }; Returns: Json[] }
      get_campaigns_overview: {
        Args: never
        Returns: {
          attempted: number
          clicked: number
          clicking_rate: number
          completed_at: string
          created_at: string
          delivered: number
          delivery_rate: number
          failed_other: number
          hard_bounced: number
          id: string
          link_clicks: Json
          opened: number
          opening_rate: number
          sender_daily_limit: number
          sender_email: string
          sender_name: string
          soft_bounced: number
          started_at: string
          status: Database["private"]["Enums"]["email_campaign_status"]
          subject: string
          total_batches: number
          total_recipients: number
          track_click: boolean
          track_open: boolean
          unsubscribe_rate: number
          unsubscribed: number
        }[]
      }
      get_contacts_table: {
        Args: { p_user_id: string }
        Returns: {
          alternate_email: string[]
          alternate_name: string[]
          consent_changed_at: string
          consent_status: Database["private"]["Enums"]["contact_consent_status"]
          conversations: number
          created_at: string
          email: string
          family_name: string
          given_name: string
          id: string
          identifier: string
          image: string
          job_title: string
          location: string
          location_normalized: Json
          mining_id: string
          name: string
          occurrence: number
          recency: string
          recipient: number
          replied_conversations: number
          same_as: string[]
          sender: number
          seniority: string
          sources: string[]
          status: string
          tags: string[]
          telephone: string[]
          temperature: number
          updated_at: string
          user_id: string
          user_tags: string[]
          works_for: string
        }[]
      }
      get_contacts_table_by_ids: {
        Args: { p_ids: string[]; p_user_id: string }
        Returns: {
          alternate_email: string[]
          alternate_name: string[]
          consent_changed_at: string
          consent_status: Database["private"]["Enums"]["contact_consent_status"]
          conversations: number
          created_at: string
          email: string
          family_name: string
          given_name: string
          id: string
          identifier: string
          image: string
          job_title: string
          location: string
          location_normalized: Json
          mining_id: string
          name: string
          occurrence: number
          recency: string
          recipient: number
          replied_conversations: number
          same_as: string[]
          sender: number
          seniority: string
          sources: string[]
          status: string
          tags: string[]
          telephone: string[]
          temperature: number
          updated_at: string
          user_id: string
          user_tags: string[]
          works_for: string
        }[]
      }
      get_distinct_or_exclude_from_array:
        | {
            Args: { exclude_array?: unknown; input_array: unknown }
            Returns: unknown
          }
        | {
            Args: { exclude_value?: unknown; input_array: unknown }
            Returns: unknown
          }
        | {
            Args: { exclude_array?: string[]; input_array: string[] }
            Returns: string[]
          }
      get_mining_source_credentials_for_user: {
        Args: { _encryption_key: string; _user_id: string }
        Returns: {
          credentials: Json
          email: string
          type: string
        }[]
      }
      get_mining_source_overview: {
        Args: { p_user_id: string }
        Returns: {
          last_mining_date: string
          source_email: string
          total_contacts: number
          total_email_contacts: number
          total_from_last_mining: number
          total_phone_contacts: number
        }[]
      }
      get_mining_stats: {
        Args: { mining_id: string }
        Returns: {
          source: string
          total_contacts_mined: number
          total_reachable: number
          total_with_company: number
          total_with_location: number
          total_with_phone: number
          user_id: string
        }[]
      }
      get_passive_mining_ids: {
        Args: { week_end: string; week_start: string }
        Returns: {
          mining_id: string
          user_id: string
        }[]
      }
      get_user_mining_source_credentials: {
        Args: { _encryption_key: string }
        Returns: {
          credentials: Json
          email: string
          type: string
        }[]
      }
      invoke_edge_function: {
        Args: { body?: Json; edge_function_name: string }
        Returns: Json
      }
      populate_refined: { Args: { _userid: string }; Returns: undefined }
      refine_persons: { Args: { p_user_id: string }; Returns: undefined }
      trigger_email_campaign_processor: { Args: never; Returns: undefined }
      upsert_mining_source: {
        Args: {
          _credentials: string
          _email: string
          _encryption_key: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      contact_consent_status: "legitimate_interest" | "opt_out" | "opt_in"
      email_campaign_event_type: "open" | "click" | "unsubscribe"
      email_campaign_recipient_status: "pending" | "sent" | "failed" | "skipped"
      email_campaign_status:
        | "queued"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      engagement_type_enum: "EXPORT" | "ENRICH"
      status_enum: "VALID" | "RISKY" | "INVALID" | "UNKNOWN"
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
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_old_pst_files: { Args: never; Returns: undefined }
      invoke_edge_function: {
        Args: { edge_function_name: string }
        Returns: Json
      }
    }
    Enums: {
      notification_type: "enrich" | "clean" | "extract" | "signature"
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
  private: {
    Enums: {
      contact_consent_status: ["legitimate_interest", "opt_out", "opt_in"],
      email_campaign_event_type: ["open", "click", "unsubscribe"],
      email_campaign_recipient_status: ["pending", "sent", "failed", "skipped"],
      email_campaign_status: [
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      engagement_type_enum: ["EXPORT", "ENRICH"],
      status_enum: ["VALID", "RISKY", "INVALID", "UNKNOWN"],
      task_category_enum: ["mining", "enriching", "cleaning"],
      task_status_enum: ["running", "canceled", "done"],
      task_type_enum: ["fetch", "extract", "edit", "export", "enrich", "clean"],
    },
  },
  public: {
    Enums: {
      notification_type: ["enrich", "clean", "extract", "signature"],
    },
  },
} as const
