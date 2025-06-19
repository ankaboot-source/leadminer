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

/**
 * Type guard to check if the data is valid for the email extractor.
 */
function isEmailFormat(data: EmailFormat | FileFormat[]): data is EmailFormat {
  return (
    typeof data === 'object' &&
    'folderPath' in data &&
    ('header' in data || 'body' in data)
  );
}

function createCsvXlsxExtractor(
  enablers: ExtractorEnablers,
  userEmail: string,
  { fileName, contacts }: FileFormat
) {
  return new CsvXlsxContactEngine(
    enablers.taggingEngine,
    enablers.redisClientForNormalMode,
    enablers.domainStatusVerification,
    { fileName, contacts: contacts.filter(({ email }) => email !== userEmail) }
  );
}

function createEmailExtractor(
  userId: string,
  userEmail: string,
  data: EmailFormat,
  enablers: ExtractorEnablers
) {
  if (!isEmailFormat(data)) {
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

export function createExtractor(
  type: ContactExtractorType,
  userId: string,
  userEmail: string,
  data: EmailFormat | FileFormat,
  enablers: ExtractorEnablers
) {
  if (['file'].includes(type)) {
    return createCsvXlsxExtractor(enablers, userEmail, data as FileFormat);
  }
  if (type === 'email') {
    return createEmailExtractor(
      userId,
      userEmail,
      data as EmailFormat,
      enablers
    );
  }

  throw new Error(`Unsupported extractor type: ${type}`);
}
