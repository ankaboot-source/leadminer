export type CampaignStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CampaignLinkClick {
  url: string;
  unique_clicks: number;
  total_clicks: number;
}

export type CampaignChannel = 'email' | 'sms';

export interface CampaignOverview {
  id: string;
  channel: CampaignChannel;
  sender_name: string;
  sender_email?: string;
  sender_phone?: string;
  provider?: 'twilio' | 'smsgate' | 'simple-sms-gateway';
  subject?: string;
  status: CampaignStatus;
  total_recipients?: number;
  recipient_count?: number;
  attempted?: number;
  delivered?: number;
  sent_count?: number;
  hard_bounced: number;
  soft_bounced: number;
  failed_other: number;
  failed_count?: number;
  opened: number;
  open_count?: number;
  clicked: number;
  click_count?: number;
  unsubscribed: number;
  unsubscribe_count?: number;
  delivery_rate: number;
  opening_rate: number;
  clicking_rate: number;
  unsubscribe_rate: number;
  track_open?: boolean;
  track_click?: boolean;
  link_clicks?: CampaignLinkClick[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  sender_daily_limit?: number;
  total_batches?: number;
  use_short_links?: boolean;
  message_template?: string;
}
