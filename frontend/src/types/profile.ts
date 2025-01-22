export interface Profile {
  user_id: string;
  email: string;
  full_name: string;
  credits: number;
  gdpr_details: { hasAcceptedEnriching: boolean };
}
