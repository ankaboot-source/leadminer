import { GaxiosError } from 'gaxios';
import ENV from '../../../../config';
import { ContactFrontend } from '../../../../db/types';
import logger from '../../../../utils/logger';
import {
  getPeopleService,
  warmupSearchIndex
} from '../../../OAuth2/googlePeopleClient';
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

  async export(
    contacts: ContactFrontend[],
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!options?.googleContactsOptions)
      throw new Error('Missing required options');

    try {
      const opts = options.googleContactsOptions;
      const service = await getPeopleService({
        accessToken: opts.accessToken,
        refreshToken: opts.refreshToken
      });
      await warmupSearchIndex(service);
      const session = new GoogleContactsSession(
        service,
        ENV.APP_NAME,
        opts.userId
      );
      const { labelId } = await session.run(
        contacts,
        opts.updateEmptyFieldsOnly ?? false
      );

      return {
        content: JSON.stringify({ labelId }),
        contentType: this.contentType,
        charset: '',
        extension: ''
      };
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
  }
}
