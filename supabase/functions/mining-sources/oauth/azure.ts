import { AuthorizationCode } from "simple-oauth2";
import { generateOAuthConfig } from "./utils.ts";
import { getRequiredEnv } from "../../_shared/env-helpers.ts";

type AuthParams = "prompt" | "state";

let client: AuthorizationCode<AuthParams> | undefined;

/**
 * Built lazily so a deployment that only configures Azure does not crash
 * at import time (utils.ts imports every provider client). The credential
 * check now runs on first actual use of the Azure client.
 */
export default function getAzureOAuth2Client(): AuthorizationCode<AuthParams> {
  if (!client) {
    const config = generateOAuthConfig(
      getRequiredEnv("AZURE_CLIENT_ID"),
      getRequiredEnv("AZURE_SECRET"),
      "https://login.microsoftonline.com",
      "/common/oauth2/v2.0/authorize",
      "/common/oauth2/v2.0/token",
    );
    client = new AuthorizationCode<AuthParams>(config);
  }
  return client;
}
