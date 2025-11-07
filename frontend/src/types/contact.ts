export type Tag = 'professional' | 'newsletter' | 'personal' | 'group' | 'chat';

export type EmailStatus = 'UNKNOWN' | 'RISKY' | 'VALID' | 'INVALID';

export const EmailStatusScore: Record<EmailStatus, number> = {
  VALID: 0,
  RISKY: 1,
  UNKNOWN: 2,
  INVALID: 3,
};

export interface NormalizedLocation {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, any>;
}
export interface Contact {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  alternate_name: string[] | null;
  telephone: string[] | null;
  location: string | null;
  location_normalized: NormalizedLocation | null;
  works_for: string | null;
  job_title: string | null;
  same_as: string[] | null;
  image: string | null;
  engagement?: number;
  sender?: string;
  recipient?: string;
  conversations?: number;
  replied_conversations?: number;
  status: EmailStatus | null;
  occurrence?: number;
  temperature: number | null;
  personid?: string;
  recency?: Date;
  seniority?: Date;
  tags?: Tag[];
  updated_at?: Date;
  created_at?: Date;
  mining_id?: string;
}

export interface ContactEdit {
  email: string;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  alternate_name: string | null;
  telephone: string | null;
  location: string | null;
  works_for: string | null;
  job_title: string | null;
  same_as: string | null;
  image: string | null;
}
