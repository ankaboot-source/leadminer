import { Factory, Pool, createPool } from 'generic-pool';
import { ImapFlow as Connection, ImapFlowOptions } from 'imapflow';
import assert from 'assert';
import ENV from '../../config';
import logger from '../../utils/logger';
import { getOAuthImapConfigByEmail } from '../auth/Provider';

class ImapConnectionProvider {
  private imapConfig: Partial<ImapFlowOptions>;

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
   * Builds the configuration for connecting to Google using OAuth.
   * @param accessToken - OAuth access token
   */
  async withOauth(token: string) {
    try {
      const email = this.imapConfig.auth?.user as string;
      const { host, port, tls } = await getOAuthImapConfigByEmail(email);

      Object.assign(this.imapConfig, {
        host,
        port,
        secure: tls,
        auth: { user: email, accessToken: token }
      });

      return this;
    } catch (error) {
      throw new Error(`Failed generating XOAuthToken: ${error}`);
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
}

export default ImapConnectionProvider;
