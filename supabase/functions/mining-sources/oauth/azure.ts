import { AuthorizationCode } from "simple-oauth2";
import { generateOAuthConfig } from "./utils.ts";
import { getRequiredEnv } from "../../_shared/env-helpers.ts";

const config = generateOAuthConfig(
  getRequiredEnv("AZURE_CLIENT_ID"),
  getRequiredEnv("AZURE_SECRET"),
  "https://login.microsoftonline.com",
  "/common/oauth2/v2.0/authorize",
  "/common/oauth2/v2.0/token",
);

type AuthParams = "prompt" | "state";
const azureOAuth2Client = new AuthorizationCode<AuthParams>(config);
export default azureOAuth2Client;
