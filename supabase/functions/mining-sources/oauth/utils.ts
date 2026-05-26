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
      "openid",
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
): { redirect_uri: string; scope: string; prompt?: string; access_type?: string } {
  const config: { redirect_uri: string; scope: string; prompt?: string; access_type?: string } = {
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
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}

export function parseOAuthState(state: string) {
  if (!state) {
    throw new Error("Missing OAuth state");
  }
  let decoded: Record<string, unknown>;
  try {
    decoded = JSON.parse(atob(state));
  } catch {
    throw new Error("Invalid OAuth state");
  }
  if (!decoded.userId || typeof decoded.userId !== "string") {
    throw new Error("Missing userId in OAuth state");
  }
  return {
    userId: decoded.userId,
    afterCallbackRedirect: getSafeRedirectPath(decoded.afterCallbackRedirect as string | undefined),
  };
}

export async function exchangeForToken(
  code: string,
  provider: OAuthMiningSourceProvider,
  callbackUrl: string,
): Promise<TokenType> {
  const client = getAuthClient(provider);
  const tokenConfig = getTokenConfig(provider, callbackUrl);
  const { token: tokenResponse } = await client.getToken({
    ...tokenConfig,
    code,
  });

  const approvedScopes = (tokenResponse.scope as string)?.split(" ") || [];
  const requiredScopes = providerScopes[provider].requiredScopes;
  const allRequiredApproved = requiredScopes.every((s) =>
    approvedScopes.includes(s),
  );

  if (!allRequiredApproved) {
    throw new Error("Missing required scopes");
  }

  const idToken = tokenResponse.id_token;
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing id_token in token response");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(atob(idToken.split(".")[1]));
  } catch {
    throw new Error("Invalid id_token");
  }

  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("Missing email in id_token");
  }

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
