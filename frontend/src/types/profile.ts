export interface Profile {
  user_id: string;
  email: string;
  full_name: string;
  credits: number;
  gdpr_details: { hasAcceptedEnriching: boolean };
  smsgate_base_url?: string | null;
  smsgate_username?: string | null;
  smsgate_password?: string | null;
}
