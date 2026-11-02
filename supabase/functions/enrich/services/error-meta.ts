/**
 * PII-safe error metadata for structured edge-function logs.
 *
 * Ported from the backend's `errorMeta()` helper
 * (`backend/src/utils/errors.ts`) after the post-fork logging hardening in
 * main. Serializes an unknown thrown value to error *shape*
 * (name/message/code/status/stack) instead of passing the raw error object
 * through the logger, so nested errors do not lose their fields and plain
 * objects are not dumped wholesale into logs.
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
    const status = typeof withStatus.status === "number"
      ? withStatus.status
      : withStatus.response?.status;
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      ...(withCode.code !== undefined ? { code: withCode.code } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { name: "UnknownError", message: String(error) };
}
