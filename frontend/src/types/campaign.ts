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

export interface CampaignOverview {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: CampaignStatus;
  total_recipients: number;
  attempted: number;
  delivered: number;
  hard_bounced: number;
  soft_bounced: number;
  failed_other: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  delivery_rate: number;
  opening_rate: number;
  clicking_rate: number;
  unsubscribe_rate: number;
  track_open: boolean;
  track_click: boolean;
  link_clicks: CampaignLinkClick[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  sender_daily_limit: number;
  total_batches: number;
}
