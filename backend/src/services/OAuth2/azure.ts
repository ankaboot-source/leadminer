import { AuthorizationCode } from 'simple-oauth2';
import generateOAuthConfig from './utils';
import ENV from '../../config';

const config = generateOAuthConfig(
  ENV.AZURE_CLIENT_ID,
  ENV.AZURE_SECRET,
  'https://login.microsoftonline.com',
  '/common/oauth2/v2.0/authorize',
  '/common/oauth2/v2.0/token'
);

const azureOAuth2Client = new AuthorizationCode(config);

export default azureOAuth2Client;
