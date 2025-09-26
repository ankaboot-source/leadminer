import { NextFunction, Router, Request, Response } from 'express';
import { ImapFlow as Connection } from 'imapflow';
import validateType from './utils/validation';
import PgMiningSources from './db/pg/PgMiningSources';
import pool from './db/pg';
import logger from './utils/logger';
import ENV from './config';
import ImapConnectionProvider from './services/imap/ImapConnectionProvider';
import { generateErrorObjectFromImapError } from './utils/imap';
import EmailFetcherFactory from './factory/EmailFetcherFactory';
import EmailsFetcher from './emailJobs';

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
          `Server approved connection #${clients.length + 1} with id: ${conn.id}`
        );
        clients.push(conn);
        return true;
      } catch (err) {
        logger.error(`Error getting test connection`, err);
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

      if (totalApprovedImapConnections < 0) {
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

      EmailsFetcher.start(
        miningId,
        new EmailFetcherFactory().create({
          userId,
          miningId,
          contactStream,
          signatureStream,
          boxes: sanitizedFolders,
          email: miningSourceCredentials.email,
          batchSize: ENV.FETCHING_BATCH_SIZE_TO_SEND,
          fetchEmailBody: extractSignatures && ENV.IMAP_FETCH_BODY,
          maxConcurrentConnections: totalApprovedImapConnections,
          imapConnectionProvider
        })
      );
    } catch (err) {
      console.log(err);
      logger.error('Failed to start fetching', err);
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

      const newError = generateErrorObjectFromImapError(err);

      res.status(500);
      return next(new Error(newError.message));
    }

    return res.status(201).send({ error: null });
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

export default apiRoutes;
