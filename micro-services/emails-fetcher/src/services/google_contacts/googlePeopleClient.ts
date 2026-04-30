import { google, people_v1 } from 'googleapis';
import { AuthorizationCode } from 'simple-oauth2';
import ENV from '../../config';

const config = {
  auth: {
    authorizePath: '/o/oauth2/v2/auth',
    tokenHost: 'https://accounts.google.com',
    tokenPath: '/o/oauth2/token'
  },
  client: {
    id: ENV.GOOGLE_CLIENT_ID,
    secret: ENV.GOOGLE_SECRET
  }
};

const googleOAuth2Client = new AuthorizationCode(config);

async function warmupSearchIndex(service: people_v1.People): Promise<void> {
  await service.people.searchContacts({
    query: '',
    readMask: 'names,emailAddresses'
  });

  await service.people.connections.list({
    resourceName: 'people/me',
    pageSize: 1,
    personFields: 'metadata'
  });
}

export async function getPeopleService(options: {
  accessToken?: string;
  refreshToken?: string;
}): Promise<people_v1.People> {
  const accessToken = options?.accessToken;
  const refreshToken = options?.refreshToken;

  if (!accessToken && !refreshToken) {
    throw new Error('Invalid credentials.');
  }

  const oauth2ClientAuth = new google.auth.OAuth2(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_SECRET
  );

  const token = googleOAuth2Client.createToken({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (token.expired(1000) && !refreshToken) {
    throw new Error('Invalid credentials.');
  }

  oauth2ClientAuth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  const peopleService = google.people({
    version: 'v1',
    auth: oauth2ClientAuth
  });

  await warmupSearchIndex(peopleService);

  return peopleService;
}
