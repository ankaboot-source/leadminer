export interface ErrorResponse {
  message: string;
  stack?: string;
  details?: string | Record<string, string>;
}

export class ImapAuthError extends Error {
  message: string;

  status: number;

  fields?: string[];

  constructor(message: string, status: number, fields: string[]) {
    super(message);
    this.name = 'ImapAuthError';
    this.message = message;
    this.status = status;
    this.fields = fields;
  }
}
