import Redis from 'ioredis';
import { Logger } from 'winston';
import CatchAllDomainsCache from '../cache/CatchAllDomainsCache';
import EmailStatusCache from '../cache/EmailStatusCache';
import { TaggingEngine } from '../tagging/types';
import EmailMessage, {
  DomainStatusVerificationFunction,
  EmailFormat
} from './engines/EmailMessage';
import { CsvXlsxContactEngine, FileFormat } from './engines/FileImport';
import {
  PostgreSQLContactEngine,
  PostgreSQLFormat
} from './engines/PostgreSQLImport';

export type ContactExtractorType = 'file' | 'email' | 'postgresql';

export interface ExtractorEnablers {
  taggingEngine: TaggingEngine;
  redisClientForNormalMode: Redis;
  emailStatusCache: EmailStatusCache;
  catchAllDomainsCache: CatchAllDomainsCache;
  domainStatusVerification: DomainStatusVerificationFunction;
  logger?: Logger;
  onBatchProcessed?: (batchSize: number) => void | Promise<void>;
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

function createPostgreSQLExtractor(
  enablers: ExtractorEnablers,
  data: PostgreSQLFormat
) {
  if (!enablers.logger) {
    throw new Error('Logger is required for PostgreSQL extractor');
  }
  return new PostgreSQLContactEngine(
    enablers.taggingEngine,
    enablers.redisClientForNormalMode,
    enablers.domainStatusVerification,
    enablers.logger,
    data,
    enablers.onBatchProcessed
  );
}

export function createExtractor(
  type: ContactExtractorType,
  userId: string,
  userEmail: string,
  data: EmailFormat | FileFormat | PostgreSQLFormat,
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
  if (type === 'postgresql') {
    return createPostgreSQLExtractor(enablers, data as PostgreSQLFormat);
  }

  throw new Error(`Unsupported extractor type: ${type}`);
}
