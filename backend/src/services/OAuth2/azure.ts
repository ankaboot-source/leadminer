import { AuthorizationCode } from 'simple-oauth2';
import ENV from '../../config';

const config = {
  client: {
    id: ENV.AZURE_CLIENT_ID,
    secret: ENV.AZURE_SECRET
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: '/common/oauth2/v2.0/authorize',
    tokenPath: '/common/oauth2/v2.0/token'
  }
};

const azureOAuth2Client = new AuthorizationCode(config);

export default azureOAuth2Client;
