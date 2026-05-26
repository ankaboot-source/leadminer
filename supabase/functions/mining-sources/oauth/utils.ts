import { Token } from "simple-oauth2";
import googleOAuth2Client from "./google.ts";
import azureOAuth2Client from "./azure.ts";

export type OAuthMiningSourceProvider = "azure" | "google";

export type TokenType = {
  email: string;
  refreshToken: string;
  accessToken: string;
  idToken: string;
  expiresAt: number;
};

export const providerScopes = {
  google: {
    scopes: [
      "openid",
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/contacts",
    ],
    requiredScopes: [
      "openid",
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/contacts",
    ],
  },
  azure: {
    scopes: [
      "https://outlook.office.com/IMAP.AccessAsUser.All",
      "offline_access",
      "email",
      "openid",
      "profile",
    ],
    requiredScopes: [
      "https://outlook.office.com/IMAP.AccessAsUser.All",
    ],
  },
};

export function getAuthClient(provider: OAuthMiningSourceProvider) {
  switch (provider) {
    case "google":
      return googleOAuth2Client;
    case "azure":
      return azureOAuth2Client;
    default:
      throw new Error("Not a valid OAuth provider");
  }
}

export function getTokenConfig(
  provider: OAuthMiningSourceProvider,
  callbackUrl: string,
): Record<string, string> {
  const config: Record<string, string> = {
    redirect_uri: callbackUrl,
    scope: providerScopes[provider].scopes.join(" "),
  };

  if (provider === "google") {
    config.prompt = "consent select_account";
    config.access_type = "offline";
  } else if (provider === "azure") {
    config.prompt = "select_account";
  }

  return config;
}

export function getSafeRedirectPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}

export function parseOAuthState(state: string) {
  if (!state) {
    throw new Error("Missing OAuth state");
  }
  const decoded = JSON.parse(atob(state));
  if (!decoded.userId) {
    throw new Error("Missing userId in OAuth state");
  }
  return {
    userId: decoded.userId,
    afterCallbackRedirect: getSafeRedirectPath(decoded.afterCallbackRedirect),
  };
}

export async function exchangeForToken(
  code: string,
  provider: OAuthMiningSourceProvider,
  callbackUrl: string,
): Promise<TokenType> {
  const client = getAuthClient(provider);
  const tokenConfig = getTokenConfig(provider, callbackUrl);
  const tokenResponse = (await client.getToken({
    ...tokenConfig,
    code,
  })) as Token;

  const approvedScopes = (tokenResponse.scope as string)?.split(" ") || [];
  const requiredScopes = providerScopes[provider].requiredScopes;
  const allRequiredApproved = requiredScopes.every((s) =>
    approvedScopes.includes(s),
  );

  if (!allRequiredApproved) {
    throw new Error("Missing required scopes");
  }

  const idToken = tokenResponse.id_token as string;
  const payload = JSON.parse(atob(idToken.split(".")[1]));

  return {
    email: payload.email,
    refreshToken: tokenResponse.refresh_token as string,
    accessToken: tokenResponse.access_token as string,
    idToken,
    expiresAt: tokenResponse.expires_at as number,
  };
}

export function generateOAuthConfig(
  clientId: string,
  clientSecret: string,
  tokenHost: string,
  authorizePath: string,
  tokenPath: string,
) {
  return {
    client: {
      id: clientId,
      secret: clientSecret,
    },
    auth: {
      tokenHost,
      authorizePath,
      tokenPath,
    },
  };
}
