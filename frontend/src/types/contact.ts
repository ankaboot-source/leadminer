export type Tag = 'professional' | 'newsletter' | 'personal' | 'group' | 'chat';

export type EmailStatus = 'UNKNOWN' | 'RISKY' | 'VALID' | 'INVALID';

export const EmailStatusScore: Record<EmailStatus, number> = {
  VALID: 0,
  RISKY: 1,
  UNKNOWN: 2,
  INVALID: 3,
};

export interface Contact {
  id: string;
  userid: string;
  email: string;
  engagement?: number;
  name?: string;
  sender?: string;
  recipient?: string;
  conversations?: number;
  replied_conversations?: number;
  status: EmailStatus | null;
  occurrence?: number;
  personid?: string;
  recency?: Date;
  seniority?: Date;
  tags?: Tag[];
  given_name?: string;
  family_name?: string;
  alternate_names?: string[];
  address?: string;
  works_for?: string;
  job_title?: string;
  same_as?: string[];
  image?: string;
}

export interface ContactEdit {
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  alternate_names?: string[] | string;
  address?: string;
  works_for?: string;
  job_title?: string;
  same_as?: string[] | string;
  image?: string;
}
