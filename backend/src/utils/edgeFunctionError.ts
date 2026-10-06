interface EdgeFunctionErrorLike {
  message?: string;
  status?: number;
  context?: { status?: number };
}

function statusOf(error: unknown): number | undefined {
  const err = (error ?? {}) as EdgeFunctionErrorLike;
  return typeof err.status === 'number' ? err.status : err.context?.status;
}

/**
 * Formats a supabase edge-function failure with the function name and HTTP
 * status. The supabase-js message ("Edge Function returned a non-2xx status
 * code") alone does not identify which function failed.
 */
export function formatEdgeFunctionError(
  functionName: string,
  error: unknown
): string {
  const err = (error ?? {}) as EdgeFunctionErrorLike;
  const status = statusOf(error);
  return `Edge Function '${functionName}' failed${status !== undefined ? ` (HTTP ${status})` : ''}: ${err.message ?? String(error)}`;
}

export function edgeFunctionError(functionName: string, error: unknown): Error {
  const wrapped = new Error(formatEdgeFunctionError(functionName, error));
  const status = statusOf(error);
  if (status !== undefined) {
    (wrapped as { status?: number }).status = status;
  }
  return wrapped;
}
