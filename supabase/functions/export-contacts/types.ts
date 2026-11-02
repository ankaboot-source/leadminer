export enum ExportType {
  CSV = "csv",
  VCARD = "vcard",
  GOOGLE_CONTACTS = "google_contacts",
}

export interface ExportOptions {
  delimiter?: string;
  locale?: string;
  googleContactsOptions?: {
    userId: string;
    accessToken?: string;
    refreshToken?: string;
    updateEmptyFieldsOnly?: boolean;
  };
}

export interface ExportResult {
  content: string | Uint8Array;
  contentType: string;
  charset: string;
  extension: string;
}

export interface ExportStrategy<T> {
  readonly type: ExportType;
  export(data: T[], options?: ExportOptions): Promise<ExportResult>;
}

export interface Contact {
  id: string;
  user_id: string;
  email?: string;
  identifier?: string;
  engagement?: number;
  name?: string;
  sender?: string;
  recipient?: string;
  conversations?: number;
  replied_conversations?: number;
  status?: string | null;
  occurrence?: number;
  recency?: Date;
  seniority?: Date;
  tags?: { name: string; reachable: string; source: string }[];
  given_name?: string;
  family_name?: string;
  alternate_name?: string[];
  alternate_email?: string[];
  location?: string;
  works_for?: string;
  job_title?: string;
  same_as?: string[];
  image?: string;
  telephone?: string[];
}

export interface ContactFrontend {
  id: string;
  user_id: string;
  email?: string;
  identifier?: string;
  engagement?: number;
  name?: string;
  sender?: string;
  recipient?: string;
  conversations?: number;
  replied_conversations?: number;
  status?: string | null;
  occurrence?: number;
  recency?: Date;
  seniority?: Date;
  tags?: string[];
  given_name?: string;
  family_name?: string;
  alternate_name?: string[];
  alternate_email?: string[];
  location?: string;
  works_for?: string;
  job_title?: string;
  same_as?: string[];
  image?: string;
  telephone?: string[];
}

export interface ModalButton {
  title: string;
  link?: string;
  action?: string;
  severity?: "primary" | "secondary" | "contrast";
  variant?: "outlined" | "text" | "link";
  icon?: string;
}

export interface ModalResponse {
  type: "modal";
  title: string;
  description: string;
  data: {
    total: number;
    available: number;
    availableAlready: number;
    reason?: string;
    partial_continue?: "partial_one" | "partial_two";
  };
  buttons: ModalButton[];
}

export interface ExportRequestBody {
  ids?: string[];
  exportAllContacts: boolean;
  partialExport: boolean;
  updateEmptyFieldsOnly?: boolean;
  miningSourceId?: string;
}
