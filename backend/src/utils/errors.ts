type ImapFieldError = Record<string, string | string[]>;

export interface ErrorResponse {
  message: string;
  stack?: string;
  details?: string | Record<string, string> | ImapFieldError;
}

export class ImapAuthError extends Error {
  fieldErrors?: ImapFieldError;

  constructor(message: string, errors?: ImapFieldError) {
    super(message);
    this.name = 'ImapAuthError';
    this.fieldErrors = errors;
  }
}
