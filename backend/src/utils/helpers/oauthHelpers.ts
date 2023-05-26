export interface JwtState {
  provider: string;
  nosignup?: boolean;
  redirectURL?: string;
  scopes: string | string[];
}

export interface AuthorizationParams {
  redirect_to?: string;
  provider: string;
  state?: string;
  scopes?: string[];
  access_type?: string;
}

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
 * @param {string} redirectURL - The base URL for the redirect.
 * @param {Record<string, any>} params - The query parameters as an object.
 * @returns {string} The constructed redirect URL.
 * @throws {Error} If the redirectURL is not a valid URL.
 */
export function buildRedirectUrl(
  redirectURL: string,
  params: Record<string, string>
): string {
  try {
    const url = new URL(redirectURL);
    return `${url.href}?${new URLSearchParams(params).toString()}`;
  } catch (error) {
    throw new Error('Invalid redirectURL: Not a valid URL');
  }
}
