export type SmsGatewayProvider = 'smsgate' | 'simple-sms-gateway' | 'twilio';

export interface SmsFleetGateway {
  id: string;
  user_id: string;
  name: string;
  provider: SmsGatewayProvider;
  config: SmsGatewayConfig;
  is_active: boolean;
  daily_limit: number;
  monthly_limit: number;
  sent_today: number;
  sent_this_month: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface SmsGatewayConfig {
  // SMSGate specific
  baseUrl?: string;
  username?: string;
  password?: string;
  // Simple SMS Gateway specific
  simpleSmsGatewayBaseUrl?: string;
  // Twilio specific
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export interface SmsGatewayCreatePayload {
  name: string;
  provider: SmsGatewayProvider;
  config: SmsGatewayConfig;
  daily_limit?: number;
  monthly_limit?: number;
  is_active?: boolean;
}

export interface SmsGatewayTestResult {
  success: boolean;
  message: string;
}

export interface CampaignRecipientGateway {
  id: string;
  campaign_id: string;
  recipient_id: string;
  gateway_id: string | null;
  gateway_name: string | null;
  gateway_provider: string | null;
  assigned_at: string;
  sent_at: string | null;
}
