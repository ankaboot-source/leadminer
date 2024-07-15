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
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  alternate_names?: string[] | string | null;
  address?: string | null;
  works_for?: string | null;
  job_title?: string | null;
  same_as?: string[] | string | null;
  image?: string | null;
}

export interface ContactEditCleaned {
  email: string;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  alternate_names?: string[] | null;
  address?: string | null;
  works_for?: string | null;
  job_title?: string | null;
  same_as?: string[] | null;
  image?: string | null;
}
