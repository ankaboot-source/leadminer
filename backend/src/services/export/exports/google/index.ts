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

    try {
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
    } catch (err) {
      if (err instanceof GaxiosError) {
        logger.error(
          `Error creating google.people service: ${err.message}`,
          err
        );
        if (err.response?.status === 401) {
          throw new Error('Invalid credentials.');
        }
      } else {
        logger.error(
          `Error creating google.people service: ${(err as Error).message}`,
          err
        );
      }
      throw err;
    }
  }

  private static async warmupSearchIndex(
    service: people_v1.People
  ): Promise<void> {
    try {
      await service.people.searchContacts({
        query: '',
        readMask: 'names,emailAddresses'
      });

      await service.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1,
        personFields: 'metadata'
      });

      logger.info('Google search index warmup triggered.');
    } catch (err) {
      logger.warn('Search index warmup failed (non-critical)', {
        error: (err as Error).message
      });
    }
  }

  async export(
    contacts: ContactFrontend[],
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!options?.googleContactsOptions)
      throw new Error('Missing required options');

    const opts = options.googleContactsOptions;
    const service = await GoogleContactsExport.getPeopleService(opts);
    const session = new GoogleContactsSession(service, ENV.APP_NAME);
    await session.run(contacts, opts.updateEmptyFieldsOnly ?? false);

    return {
      content: '',
      contentType: this.contentType,
      charset: '',
      extension: ''
    };
  }
}
