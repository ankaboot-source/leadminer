import { NextFunction, Request, Response, Router } from 'express';
import { AuthenticationFailure, ImapFlow as Connection } from 'imapflow';
import ENV from './config';
import pool from './db/pg';
import PgMiningSources from './db/pg/PgMiningSources';
import EmailsFetcher, { PSTEmailFetcher } from './emailJobs';
import EmailFetcherFactory from './factory/EmailFetcherFactory';
import PSTFetcherFactory from './factory/PSTFetcherFactory';
import ImapConnectionProvider from './services/imap/ImapConnectionProvider';
import { generateErrorObjectFromImapError } from './utils/imap';
import logger from './utils/logger';
import validateType from './utils/validation';

const apiRoutes = Router();

/**
 * Sanitizes input to prevent IMAP injection and CRLF attacks.
 * - Removes special IMAP characters: `{}`, `"`, `\`, `(`, `)`, `*`.
 * - Strips dangerous CRLF sequences.
 * - Strips leading and trailing whitespace.
 * @param input - The input string to sanitize.
 * @returns The sanitized string.
 */
function sanitizeImapInput(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }
  // Remove CRLF characters to prevent injection
  const sanitized = input.replace(/[\r\n]+/g, '');
  // Escape trailing folder separator (if present)
  const cleaned = sanitized.replace(/\/$/, '');
  // Strip leading and trailing whitespace
  const trimmedInput = cleaned.trim();

  if (trimmedInput.length > 255) {
    // exceeds max length defined in RFC
    throw new Error('Max length exceeded');
  }
  return trimmedInput;
}

interface FetchPostBody {
  userId: string;
  miningId: string;
  email: string;
  boxes: string[];
  extractSignatures: boolean;
  filterBodySize: number | undefined;
  contactStream: string;
  signatureStream: string;
}

interface FetchStartPayload {
  userId: string;
  miningId: string;
  source: string;
  extractSignatures: boolean;
  contactStream: string;
  signatureStream: string;
}

const miningSources = new PgMiningSources(
  pool,
  logger,
  ENV.LEADMINER_API_HASH_SECRET
);

type Credentials =
  | {
      oauthToken: string;
      host?: undefined;
      password?: undefined;
      tls?: undefined;
      port?: undefined;
    }
  | {
      host: string;
      password: string;
      tls: boolean;
      port: number;
      oauthToken?: undefined;
    };

async function getAvailableConnections(
  email: string,
  credentials: Credentials
): Promise<number> {
  const clients: Connection[] = [];
  const attempts = Array.from(
    { length: ENV.FETCHING_MAX_CONNECTIONS_PER_FOLDER },
    (_, i) => i
  );

  // Continue getting connections until an error is thrown
  await Promise.all(
    attempts.map(async () => {
      try {
        const conn = await ImapConnectionProvider.getSingleConnection(
          email,
          credentials
        );
        logger.debug(
          `Server approved connection #${
            clients.length + 1
          } with id: ${conn.id}`
        );
        clients.push(conn);
        return true;
      } catch (err) {
        logger.error('Error getting test connection', err);
        return null;
      }
    })
  );

  // Count how many succeeded
  const count = clients.length;

  // Cleanup
  await Promise.all(
    clients.map(async (c) => {
      try {
        await c.logout();
      } catch (err) {
        logger.error(`Error closing test connection with id: ${c?.id}`, err);
      }
    })
  );

  logger.info(`Server approved ${count} connections`);
  return count;
}

apiRoutes.post(
  '/imap/fetch/start',
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      userId,
      miningId,
      contactStream,
      signatureStream,
      extractSignatures,
      email,
      boxes: folders
    }: FetchPostBody = req.body;

    const errors = [
      validateType('userId', userId, 'string'),
      validateType('miningId', miningId, 'string'),
      validateType('contactStream', contactStream, 'string'),
      validateType('signatureStream', signatureStream, 'string'),
      validateType('email', email, 'string'),
      validateType('boxes', folders, 'string[]'),
      validateType('extractSignatures', extractSignatures, 'boolean')
    ].filter(Boolean);

    if (errors.length) {
      return res
        .status(400)
        .json({ message: `Invalid input: ${errors.join(', ')}` });
    }

    const sanitizedEmail = sanitizeImapInput(email);
    const sanitizedFolders = folders.map((folder) => sanitizeImapInput(folder));

    try {
      const miningSourceCredentials =
        await miningSources.getCredentialsBySourceEmail(userId, sanitizedEmail);

      if (!miningSourceCredentials) {
        return res.status(401).json({
          message: "This mining source isn't registered for this user"
        });
      }

      const credentials =
        'accessToken' in miningSourceCredentials
          ? {
              oauthToken: miningSourceCredentials.accessToken
            }
          : {
              host: miningSourceCredentials.host,
              password: miningSourceCredentials.password,
              tls: miningSourceCredentials.tls,
              port: miningSourceCredentials.port
            };

      const connection = await ImapConnectionProvider.getSingleConnection(
        email,
        credentials
      );
      await connection.logout();

      const totalApprovedImapConnections = await getAvailableConnections(
        email,
        credentials
      );

      if (totalApprovedImapConnections <= 0) {
        throw new Error(
          'Inconsistent connection state: available IMAP connections below zero'
        );
      }

      const provider = new ImapConnectionProvider(
        email,
        totalApprovedImapConnections
      );
      const imapConnectionProvider =
        'accessToken' in miningSourceCredentials
          ? await provider.withOAuth(miningSourceCredentials)
          : provider.withPassword(
              miningSourceCredentials.host,
              miningSourceCredentials.password,
              miningSourceCredentials.tls,
              miningSourceCredentials.port
            );

      const emailFetcher = new EmailFetcherFactory().create({
        userId,
        miningId,
        contactStream,
        signatureStream,
        boxes: sanitizedFolders,
        email: miningSourceCredentials.email,
        batchSize: ENV.FETCHING_BATCH_SIZE_TO_SEND,
        fetchEmailBody: extractSignatures && ENV.IMAP_FETCH_BODY,
        maxConcurrentConnections: totalApprovedImapConnections,
        filterBodySize: ENV.FETCHING_MAX_BODY_TEXT_PLAIN_SIZE,
        imapConnectionProvider
      });

      const totalMessages = await emailFetcher.getTotalMessages();

      EmailsFetcher.start(miningId, emailFetcher);

      return res.status(201).send({
        data: { miningId, totalMessages },
        error: null
      });
    } catch (err) {
      logger.error('Failed to start fetching', err);

      if (
        typeof err === 'object' &&
        err !== null &&
        'authenticationFailed' in err &&
        (err as AuthenticationFailure).response
          ?.toLowerCase()
          .includes('invalid credentials')
      ) {
        return res.status(401).json({ message: (err as any)?.responseText });
      }

      if (
        err instanceof Error &&
        err.stack?.includes('Connection not available')
      ) {
        return res.status(503).json({
          message: 'Connection not available, Please try again later'
        });
      }

      if (
        err instanceof Error &&
        'textCode' in err &&
        err.textCode === 'CANNOT'
      ) {
        return res.sendStatus(409);
      }

      const newError = generateErrorObjectFromImapError(err);

      res.status(500);
      return next(new Error(newError.message));
    }
  }
);

apiRoutes.delete(
  '/imap/fetch/stop',
  async (req: Request, res: Response, next: NextFunction) => {
    const { miningId, canceled }: { miningId: string; canceled: boolean } =
      req.body;
    const errors = [
      validateType('miningId', miningId, 'string'),
      validateType('canceled', canceled, 'boolean')
    ].filter(Boolean);

    if (errors.length) {
      return res
        .status(400)
        .json({ message: `Invalid input: ${errors.join(', ')}` });
    }

    if (!EmailsFetcher.exists(miningId)) {
      return res.status(404).json({
        message: `No current active fetching found with id: ${miningId}`
      });
    }

    try {
      await EmailsFetcher.stop(miningId, canceled);
      return res.status(200).json({ error: null });
    } catch (err) {
      res.status(500);
      return next(err);
    }
  }
);

apiRoutes.post(
  '/pst/fetch/start',
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      userId,
      miningId,
      source,
      contactStream,
      signatureStream,
      extractSignatures
    }: FetchStartPayload = req.body;

    const errors = [
      validateType('userId', userId, 'string'),
      validateType('miningId', miningId, 'string'),
      validateType('contactStream', contactStream, 'string'),
      validateType('signatureStream', signatureStream, 'string'),
      validateType('extractSignatures', extractSignatures, 'boolean')
    ].filter(Boolean);

    if (errors.length) {
      return res
        .status(400)
        .json({ message: `Invalid input: ${errors.join(', ')}` });
    }

    try {
      const emailFetcher = await new PSTFetcherFactory().create({
        userId,
        miningId,
        contactStream,
        signatureStream,
        fetchEmailBody: extractSignatures && ENV.IMAP_FETCH_BODY,
        source
      });

      const totalMessages = await emailFetcher.getTotalMessages();
      PSTEmailFetcher.start(miningId, emailFetcher);
      return res.status(201).send({
        data: { miningId, totalMessages },
        error: null
      });
    } catch (err) {
      logger.error('Failed to start fetching', err);
      if (
        err instanceof Error &&
        err.stack?.includes('Failed to parse PST file')
      ) {
        return res.status(422).json({ message: 'Failed to parse PST file' });
      }
      if (
        err instanceof Error &&
        err.message.toLowerCase().startsWith('invalid credentials')
      ) {
        return res.status(401).json({ message: err.message });
      }
      if (
        err instanceof Error &&
        'textCode' in err &&
        err.textCode === 'CANNOT'
      ) {
        return res.sendStatus(409);
      }

      res.status(500);
      return next(err);
    }
  }
);

apiRoutes.delete(
  '/pst/fetch/stop',
  async (req: Request, res: Response, next: NextFunction) => {
    const { miningId, canceled }: { miningId: string; canceled: boolean } =
      req.body;
    const errors = [
      validateType('miningId', miningId, 'string'),
      validateType('canceled', canceled, 'boolean')
    ].filter(Boolean);

    if (errors.length) {
      return res
        .status(400)
        .json({ message: `Invalid input: ${errors.join(', ')}` });
    }

    if (!PSTEmailFetcher.exists(miningId)) {
      return res.status(404).json({
        message: `No current active fetching found with id: ${miningId}`
      });
    }

    try {
      await PSTEmailFetcher.stop(miningId, canceled);
      return res.status(200).json({ error: null });
    } catch (err) {
      res.status(500);
      return next(err);
    }
  }
);

export default apiRoutes;
