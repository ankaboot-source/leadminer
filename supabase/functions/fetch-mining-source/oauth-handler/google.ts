import { AuthorizationCode } from "simple-oauth2";
import generateOAuthConfig from "./utils.ts";
import { getRequiredEnv } from "../../_shared/env-helpers.ts";

type AuthParams = "access_type" | "prompt" | "state";

let client: AuthorizationCode<AuthParams> | undefined;

/**
 * Built lazily so a deployment that only configures Google does not crash
 * at import time when another module (e.g. oauth-handler/index.ts) pulls
 * both provider clients into scope. The credential check now runs on first
 * actual use of the Google client.
 */
export default function getGoogleOAuth2Client(): AuthorizationCode<AuthParams> {
  if (!client) {
    const config = generateOAuthConfig(
      getRequiredEnv("GOOGLE_CLIENT_ID"),
      getRequiredEnv("GOOGLE_SECRET"),
      "https://accounts.google.com",
      "/o/oauth2/v2/auth",
      "/o/oauth2/token",
    );
    client = new AuthorizationCode<AuthParams>(config);
  }
  return client;
}
