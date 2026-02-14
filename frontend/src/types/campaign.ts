export type CampaignStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface CampaignOverview {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: CampaignStatus;
  total_recipients: number;
  attempted: number;
  delivered: number;
  opened: number;
  clicked: number;
  delivery_rate: number;
  opening_rate: number;
  clicking_rate: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
