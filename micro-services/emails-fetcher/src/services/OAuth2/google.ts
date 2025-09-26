import { AuthorizationCode } from 'simple-oauth2';
import generateOAuthConfig from './utils';
import ENV from '../../config';

const config = generateOAuthConfig(
  ENV.GOOGLE_CLIENT_ID,
  ENV.GOOGLE_SECRET,
  'https://accounts.google.com',
  '/o/oauth2/v2/auth',
  '/o/oauth2/token'
);

type AuthParams = 'access_type' | 'prompt' | 'state';
const googleOAuth2Client = new AuthorizationCode<AuthParams>(config);

export default googleOAuth2Client;
