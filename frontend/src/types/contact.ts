export type Tag = "professional" | "newsletter" | "personal" | "group";

export type EmailStatus = "UNKNOWN" | "RISKY" | "VALID" | "INVALID";

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
  occurence?: number;
  personid?: string;
  recency?: Date;
  alternate_names?: string[];
  tags?: Tag[];
}
