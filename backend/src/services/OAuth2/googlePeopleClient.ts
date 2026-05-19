import { google, people_v1 } from 'googleapis';
import ENV from '../../config';
import googleOAuth2Client from './google';

export async function warmupSearchIndex(
  service: people_v1.People
): Promise<void> {
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
  const { accessToken, refreshToken } = options;

  if (!accessToken && !refreshToken) {
    throw new Error('Invalid credentials.');
  }

  const oauth2Client = new google.auth.OAuth2(
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

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  const peopleService = google.people({
    version: 'v1',
    auth: oauth2Client
  });

  return peopleService;
}
