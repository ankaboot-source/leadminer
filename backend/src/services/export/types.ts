export enum ExportType {
  CSV = 'csv',
  VCARD = 'vcard',
  GOOGLE_CONTACTS = 'google_contacts'
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
  content: string | Buffer;
  contentType: string;
  charset: string;
  extension: string;
  metadata?: Record<string, unknown>;
}

export interface ExportStrategy<T> {
  readonly type: ExportType;

  export(data: T[], options?: ExportOptions): Promise<ExportResult>;
}
