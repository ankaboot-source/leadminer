export type Tag = "professional" | "newsletter" | "personal" | "group";

export interface Contact {
  id: string;
  userid: string;
  email: string;
  engagement?: number;
  name?: string;
  occurence?: number;
  personid?: string;
  recency?: Date;
  alternate_names?: string[];
  tags?: Tag[];
}
