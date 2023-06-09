/**
 * Constructs the full callback URL for an endpoint, based on the incoming request.
 * @param baseURL - The baseUrl protocol + host.
 * @param endpointPath - The path of the endpoint to build the URL for.
 * @returns The fully-constructed URL.
 */
export function buildEndpointURL(
  baseURL: string,
  endpointPath: string
): string {
  const url = new URL(endpointPath, baseURL);

  return url.href;
}

/**
 * Builds a redirect URL with query parameters.
 * @param redirectURL - The base URL for the redirect.
 * @param params - The query parameters as an object.
 * @param separator - The separator between the base URL and the query parameters. Default is '?'.
 * @returns The constructed redirect URL.
 * @throws {Error} If the redirectURL is not a valid URL.
 */
export function buildRedirectUrl(
  redirectURL: string,
  params: Record<string, string>,
  separator = '?'
): string {
  try {
    const url = new URL(redirectURL);
    const queryParams = new URLSearchParams(params).toString();
    return `${url.href}${separator}${queryParams}`;
  } catch (error) {
    throw new Error('Invalid redirectURL: Not a valid URL');
  }
}
