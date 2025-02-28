import Redis from 'ioredis';
import CatchAllDomainsCache from '../cache/CatchAllDomainsCache';
import EmailStatusCache from '../cache/EmailStatusCache';
import { TaggingEngine } from '../tagging/types';
import EmailMessage, {
  DomainStatusVerificationFunction,
  EmailFormat
} from './engines/EmailMessage';
import { CsvXlsxContactEngine, FileFormat } from './engines/FileImport';

export type ContactExtractorType = 'file' | 'email';

export interface ExtractorEnablers {
  taggingEngine: TaggingEngine;
  redisClientForNormalMode: Redis;
  emailStatusCache: EmailStatusCache;
  catchAllDomainsCache: CatchAllDomainsCache;
  domainStatusVerification: DomainStatusVerificationFunction;
}

export class ContactExtractorFactory {
  public static createExtractor(
    type: ContactExtractorType,
    userId: string,
    userEmail: string,
    data: EmailFormat | FileFormat,
    enablers: ExtractorEnablers
  ) {
    if (['file'].includes(type)) {
      return this.createCsvXlsxExtractor(enablers, data as FileFormat);
    }
    if (type === 'email') {
      return this.createEmailExtractor(
        userId,
        userEmail,
        data as EmailFormat,
        enablers
      );
    }

    throw new Error(`Unsupported extractor type: ${type}`);
  }

  private static createCsvXlsxExtractor(
    enablers: ExtractorEnablers,
    data: FileFormat
  ) {
    return new CsvXlsxContactEngine(
      enablers.taggingEngine,
      enablers.redisClientForNormalMode,
      enablers.domainStatusVerification,
      data
    );
  }

  private static createEmailExtractor(
    userId: string,
    userEmail: string,
    data: EmailFormat,
    enablers: ExtractorEnablers
  ) {
    if (!this.isEmailFormat(data)) {
      throw new Error(
        'Email-specific parameters are required for the email extractor.'
      );
    }
    return new EmailMessage(
      enablers.taggingEngine,
      enablers.redisClientForNormalMode,
      enablers.emailStatusCache,
      enablers.catchAllDomainsCache,
      enablers.domainStatusVerification,
      userEmail,
      userId,
      data.header,
      data.body,
      data.folderPath
    );
  }

  /**
   * Type guard to check if the data is valid for the email extractor.
   */
  private static isEmailFormat(
    data: EmailFormat | FileFormat[]
  ): data is EmailFormat {
    return (
      typeof data === 'object' &&
      'folderPath' in data &&
      ('header' in data || 'body' in data)
    );
  }
}
