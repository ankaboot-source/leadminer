import { AuthorizationCode } from 'simple-oauth2';
import generateOAuthConfig from './utils.ts';
import { getRequiredEnv } from "../../_shared/env-helpers.ts";

const config = generateOAuthConfig(
  getRequiredEnv("GOOGLE_CLIENT_ID"),
  getRequiredEnv("GOOGLE_SECRET"),
  'https://accounts.google.com',
  '/o/oauth2/v2/auth',
  '/o/oauth2/token'
);

type AuthParams = 'access_type' | 'prompt' | 'state';
const googleOAuth2Client = new AuthorizationCode<AuthParams>(config);

export default googleOAuth2Client;
