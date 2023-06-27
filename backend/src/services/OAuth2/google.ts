import { AuthorizationCode } from 'simple-oauth2';
import ENV from '../../config';

const config = {
  client: {
    id: ENV.GOOGLE_CLIENT_ID,
    secret: ENV.GOOGLE_SECRET
  },
  auth: {
    tokenHost: 'https://accounts.google.com',
    authorizePath: '/o/oauth2/v2/auth',
    tokenPath: '/o/oauth2/token'
  }
};

const googleOAuth2Client = new AuthorizationCode(config);

export default googleOAuth2Client;
