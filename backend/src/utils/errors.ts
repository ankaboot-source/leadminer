export interface ErrorResponse {
  message: string;
  stack?: string;
  details?: string | Record<string, string>;
}

/**
 * PII-safe, transport-stable error metadata for logs.
 *
 * Serializes an unknown thrown value to error *shape* (name/message/code/
 * status/stack) without ever carrying values. Raw `Error` objects passed as
 * winston meta lose their fields on the Loki/JSON transport (nested Errors
 * serialize to `{}`), while plain objects are fully stringified (PII risk);
 * this normalized form logs identically on every transport.
 */
export interface ErrorMeta {
  name: string;
  message: string;
  code?: string | number;
  status?: number;
  stack?: string;
}

export function errorMeta(error: unknown): ErrorMeta {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string | number };
    const withStatus = error as Error & {
      response?: { status?: number };
      status?: number;
    };
    const status =
      typeof withStatus.status === 'number'
        ? withStatus.status
        : withStatus.response?.status;
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      ...(withCode.code !== undefined ? { code: withCode.code } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(error.stack ? { stack: error.stack } : {})
    };
  }
  return { name: 'UnknownError', message: String(error) };
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
