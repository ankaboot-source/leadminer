import { GaxiosError } from 'gaxios';
import { google, people_v1 } from 'googleapis';
import ENV from '../../../../config';
import { ContactFrontend } from '../../../../db/types';
import logger from '../../../../utils/logger';
import googleOAuth2Client from '../../../OAuth2/google';
import {
  ExportStrategy,
  ExportType,
  ExportOptions,
  ExportResult
} from '../../types';
import GoogleContactsSession from './contacts-api';

export default class GoogleContactsExport
  implements ExportStrategy<ContactFrontend>
{
  readonly type = ExportType.GOOGLE_CONTACTS;

  readonly contentType = 'application/json';

  private static async getPeopleService(
    options: ExportOptions['googleContactsOptions']
  ) {
    const accessToken = options?.accessToken;
    const refreshToken = options?.refreshToken;

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

    // Update cache and validate credentials
    await GoogleContactsExport.warmupSearchIndex(peopleService);

    return peopleService;
  }

  private static async warmupSearchIndex(
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

  async export(
    contacts: ContactFrontend[],
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!options?.googleContactsOptions)
      throw new Error('Missing required options');

    try {
      const opts = options.googleContactsOptions;
      const service = await GoogleContactsExport.getPeopleService(opts);
      const session = new GoogleContactsSession(
        service,
        ENV.APP_NAME,
        opts.userId
      );
      await session.run(contacts, opts.updateEmptyFieldsOnly ?? false);
    } catch (err) {
      if (err instanceof GaxiosError) {
        logger.error(`Export error: ${err.message}`, err);
        if (
          err.response?.status === 401 ||
          err.response?.data.error === 'invalid_grant'
        ) {
          throw new Error('Invalid credentials.');
        }
      } else {
        logger.error(`Export error: ${(err as Error).message}`, err);
      }
      throw err;
    }

    return {
      content: '',
      contentType: this.contentType,
      charset: '',
      extension: ''
    };
  }
}
