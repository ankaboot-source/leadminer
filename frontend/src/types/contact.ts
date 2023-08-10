export type Tag = "professional" | "newsletter" | "personal" | "group";

export type EmailStatus = "UNKNOWN" | "RISKY" | "VALID" | "INVALID";

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
  status: EmailStatus;
  occurrence?: number;
  personid?: string;
  recency?: Date;
  seniority?: Date;
  alternate_names?: string[];
  tags?: Tag[];
}
