import assert from 'assert';
import { createPool, Factory, Pool } from 'generic-pool';
import { ImapFlow as Connection, ImapFlowOptions } from 'imapflow';
import { Token } from 'simple-oauth2';
import util from 'util';
import ENV from '../../config';
import { refreshAccessToken } from '../../controllers/mining.helpers';
import {
  MiningSource,
  MiningSources,
  MiningSourceType,
  OAuthMiningSourceCredentials
} from '../../db/interfaces/MiningSources';
import logger from '../../utils/logger';
import { getOAuthImapConfigByEmail } from '../auth/Provider';

type CurrentOAuthSource = {
  email: string;
  userId?: string;
  credentials: OAuthMiningSourceCredentials;
  type: MiningSourceType;
};
class ImapConnectionProvider {
  private imapConfig: Partial<ImapFlowOptions>;

  private currentOAuthSourceDetails?: {
    sources?: MiningSources;
    source: CurrentOAuthSource;
  };

  private poolIsInitialized;

  private connectionsPool: Pool<Connection> | undefined;

  /**
   * ImapConnectionProvider constructor.
   * @constructor
   * @param email - User email address
   */
  constructor(email: string) {
    this.imapConfig = {
      auth: {
        user: email,
        pass: ''
      },
      logger: false,
      socketTimeout: 3600000, // Timeout after one hour
      connectionTimeout: ENV.IMAP_CONNECTION_TIMEOUT,
      greetingTimeout: ENV.IMAP_AUTH_TIMEOUT,
      secure: true
    };

    this.poolIsInitialized = false;
  }

  /**
   * Creates a single IMAP connection to test credentials.
   * @param email - Email to connect with
   * @param options - Optional: host, password, port, tls, or OAuth token
   * @returns Promise<Connection> - A connected ImapFlow instance
   */
  static async getSingleConnection(
    email: string,
    options?: {
      host?: string;
      password?: string;
      tls?: boolean;
      port?: number;
      oauthToken?: string;
    }
  ): Promise<Connection> {
    assert(
      options?.password || options?.oauthToken,
      'Either password or OAuth token and host must be provided'
    );
    const imapConfig: Partial<ImapFlowOptions> = {
      auth: options?.oauthToken
        ? { user: email, accessToken: options.oauthToken }
        : { user: email },
      logger: false,
      socketTimeout: 3600000, // Timeout after one hour
      connectionTimeout: ENV.IMAP_CONNECTION_TIMEOUT,
      greetingTimeout: ENV.IMAP_AUTH_TIMEOUT,
      secure: true
    };

    if (!options?.host || !options?.port) {
      const { host, port, tls } = await getOAuthImapConfigByEmail(email);
      imapConfig.host = host;
      imapConfig.port = port;
      imapConfig.secure = tls;
    }

    const connection = new Connection(imapConfig as ImapFlowOptions);

    // Optional logging
    connection.on('error', (err) => {
      logger.error('ImapFlow connection error:', err);
    });

    try {
      await connection.connect();
      return connection;
    } catch (err) {
      await connection.logout();
      throw err;
    }
  }

  /**
   * Builds the configuration for connecting to Google using OAuth.
   * @param accessToken - OAuth access token
   */
  async withOAuth(
    credentials: OAuthMiningSourceCredentials,
    complementarySourceDetails?: {
      miningSources: MiningSources;
      userId: string;
    }
  ) {
    try {
      const email = this.imapConfig.auth?.user as string;

      this.currentOAuthSourceDetails = {
        sources: complementarySourceDetails?.miningSources,
        source: {
          email,
          userId: complementarySourceDetails?.userId,
          credentials: credentials,
          type: credentials.provider
        }
      };

      const { host, port, tls } = await getOAuthImapConfigByEmail(email);

      Object.assign(this.imapConfig, {
        host,
        port,
        secure: tls,
        auth: {
          user: email,
          accessToken: credentials.accessToken
        }
      });

      return this;
    } catch (error) {
      throw new Error(`Failed generating XOAuthToken: ${error}`);
    }
  }

  async updateOAuthToken(token: Token) {
    if (!this.currentOAuthSourceDetails?.source.credentials)
      throw Error('currentOAuthSourceDetails.source.credentials is undefined');

    this.currentOAuthSourceDetails.source.credentials.accessToken = String(
      token.access_token
    );

    if (token.refresh_token) {
      this.currentOAuthSourceDetails.source.credentials.refreshToken = String(
        token.refresh_token
      );
    }

    if (token.expires_at) {
      this.currentOAuthSourceDetails.source.credentials.expiresAt = Number(
        token.expires_at
      );
    }

    if (this.imapConfig.auth) {
      this.imapConfig.auth.accessToken =
        this.currentOAuthSourceDetails.source.credentials.accessToken;
    }

    if (
      this.currentOAuthSourceDetails.sources &&
      this.currentOAuthSourceDetails.source.userId
    ) {
      await this.currentOAuthSourceDetails.sources.upsert(
        this.currentOAuthSourceDetails.source as MiningSource
      );
    }
  }

  isOAuth() {
    return !!this.imapConfig.auth?.accessToken;
  }

  async refreshOAuthToken(retries = 3): Promise<void> {
    logger.debug(
      `Refreshing OAuth token in ImapConfig that expired at ${new Date(this.currentOAuthSourceDetails?.source.credentials.expiresAt || 0).toLocaleString()}`
    );

    if (!this.currentOAuthSourceDetails?.source.credentials)
      throw Error('currentOAuthSourceDetails.source.credentials is undefined');

    /* eslint-disable no-await-in-loop */
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const newToken = await refreshAccessToken(
          this.currentOAuthSourceDetails.source.credentials
        );
        await this.updateOAuthToken(newToken);
        logger.debug('OAuth token refreshed and updated in ImapConfig');
        return;
      } catch (error) {
        logger.warn(
          `Attempt ${attempt} failed to refresh token:`,
          util.inspect(error, { depth: null, colors: true })
        );
        if (attempt === retries) {
          logger.error(
            'All attempts to refresh token failed',
            util.inspect(error, { depth: null, colors: true })
          );
          throw error;
        }

        // Wait a bit before retrying
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 3000);
        });
      }
    }
  }

  /**
   * Builds the configuration for connecting to a mail server using a username and password.
   * @param host - The host name or IP address of the mail server
   * @param password - User's password
   * @param tls - Perform implicit TLS connection?
   * @param port - The port number to connect to the server on (optional, defaults to 993)
   * @returns - The object for the connection
   * @throws {TypeError} - If any parameter is invalid
   */
  withPassword(host: string, password: string, tls: boolean, port = 993) {
    if (!host || !password) {
      throw new TypeError(
        'Invalid parameters. Host and password must be non-empty strings and port must be a number.'
      );
    }

    Object.assign(this.imapConfig, {
      auth: {
        user: this.imapConfig.auth?.user,
        pass: password
      },
      host,
      port,
      secure: tls
    });

    return this;
  }

  /**
   * Establishes a connection to an IMAP server and returns the connection object.
   * @returns - A Promise that resolves to the Imap object upon successful connection.
   * @throws {Error} - If the connection fails for any reason.
   */
  async connect() {
    const connection = new Connection(this.imapConfig as ImapFlowOptions);

    connection.once('close', (hadError: boolean) => {
      logger.debug('ImapFlow connection closed.', { hadError });
    });

    connection.once('end', () => {
      logger.debug('ImapFlow connection ended.');
    });

    connection.on('error', (err) => {
      logger.error('ImapFlow connection error:', err);
    });

    try {
      await connection.connect(); // throws on auth / network issues
      return connection;
    } catch (err) {
      logger.error('ImapFlow connection error', err);
      throw err;
    }
  }

  /**
   * Acquires a new Imap connection from the connection pool.
   * If the connection pool is not yet initialized, it initializes the pool before acquiring a connection.
   *
   * @returns A Promise that resolves to an Imap connection.
   * @throws {Error} If the connection pool initialization fails due to connection error.
   */
  async acquireConnection() {
    if (!this.poolIsInitialized) {
      // Should throw an error, if wrong creds and prevents pool from getting initialized.
      const connection = await this.connect();
      await connection.logout();
      this.initializePool();
      this.poolIsInitialized = true;
    }

    assert(this.connectionsPool, 'Connection Pool should not be undefined');
    return this.connectionsPool.acquire();
  }

  /**
   * Shuts down and drains the allocated IMAP connections pool.
   */
  async cleanPool() {
    if (!this.poolIsInitialized) {
      return;
    }
    assert(this.connectionsPool, 'Connection Pool should not be undefined');
    logger.debug('Cleaning IMAP Pool');
    await this.connectionsPool.clear();
    this.poolIsInitialized = false;
  }

  /**
   * Releases an IMAP connection and returns it to the pool.
   * @param imapConnection - An IMAP connection.
   */
  async releaseConnection(imapConnection: Connection) {
    if (!this.poolIsInitialized) {
      Promise.resolve();
    }
    try {
      assert(this.connectionsPool, 'Connection Pool should not be undefined');
      await this.connectionsPool.release(imapConnection);
    } catch (err) {
      logger.error('[ImapConnectionProvider]: Error releasing connection', err);
    }
  }

  /**
   * Initializes a pool of IMAP connections.
   */
  private initializePool() {
    const factory: Factory<Connection> = {
      create: async () => {
        try {
          return await this.connect();
        } catch (err) {
          logger.error('Failed to create pool resources', err);
          throw err;
        }
      },
      destroy: async (connection) => {
        try {
          await connection.logout();
          logger.debug('[ImapConnectionProvider]: Imap connection destroyed');
        } catch (err) {
          logger.error(
            '[ImapConnectionProvider]: Error destroying connection',
            err
          );
        }
      }
    };

    const opts = {
      max: ENV.IMAP_MAX_CONNECTIONS, // maximum size of the pool
      min: 0 // minimum size of the pool
    };

    this.connectionsPool = createPool<Connection>(factory, opts);

    // Set up an event listener for factory create errors
    this.connectionsPool.on('factoryCreateError', (err) => {
      logger.error('Error creating IMAP connection pool resource', err);
    });
  }

  async refreshPool() {
    await this.cleanPool();
    await this.refreshOAuthToken();
    const connection = await this.acquireConnection();
    await this.releaseConnection(connection);
  }
}

export default ImapConnectionProvider;
