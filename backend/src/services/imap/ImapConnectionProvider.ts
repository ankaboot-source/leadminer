import { Factory, Pool, createPool } from 'generic-pool';
import Connection, { Config } from 'imap';
import ENV from '../../config';
import generateXOauthToken from '../../utils/helpers/tokenHelpers';
import logger from '../../utils/logger';
import { getOAuthImapConfigByEmail } from '../auth/Provider';

class ImapConnectionProvider {
  private imapConfig: Config;

  private poolIsInitialized;

  private connectionsPool: Pool<Connection> | undefined;

  /**
   * ImapConnectionProvider constructor.
   * @constructor
   * @param email - User email address
   */
  constructor(email: string) {
    this.imapConfig = {
      user: email,
      connTimeout: ENV.IMAP_CONNECTION_TIMEOUT,
      authTimeout: ENV.IMAP_AUTH_TIMEOUT,
      tls: true,
      keepalive: false,
      password: ''
    };

    this.poolIsInitialized = false;
  }

  /**
   * Builds the configuration for connecting to Google using OAuth.
   * @param accessToken - OAuth access token
   */
  async withOauth(token: string) {
    try {
      const email = this.imapConfig.user;
      const xoauth2Token = generateXOauthToken(token, email);

      const { host, port, tls } = await getOAuthImapConfigByEmail(email);
      const tlsOptions = { host, port, servername: host };

      this.imapConfig = {
        host,
        port,
        tls,
        tlsOptions,
        xoauth2: xoauth2Token,
        ...this.imapConfig
      };
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

    this.imapConfig = {
      ...this.imapConfig,
      password,
      host,
      port,
      tls,
      tlsOptions: {
        port,
        host,
        servername: host
      }
    };
    return this;
  }

  /**
   * Establishes a connection to an IMAP server and returns the connection object.
   * @returns - A Promise that resolves to the Imap object upon successful connection.
   * @throws {Error} - If the connection fails for any reason.
   */
  async connect() {
    try {
      const imapConnection: Connection = await new Promise(
        (resolve, reject) => {
          const connection = new Connection(this.imapConfig);
          connection.on('error', (err: Error) => reject(err));
          connection.once('ready', () => resolve(connection));
          connection.connect();
        }
      );

      imapConnection.once('close', (hadError: boolean) => {
        logger.debug('Imap connection closed.', { metadata: { hadError } });
      });
      imapConnection.once('end', () => {
        logger.debug('Imap connection ended.');
      });

      return imapConnection;
    } catch (error) {
      logger.error('Imap connection error', error);
      throw error;
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
      connection.destroy();
      this.initializePool();
      this.poolIsInitialized = true;
    }

    return this.connectionsPool!.acquire();
  }

  /**
   * Shuts down and drains the allocated IMAP connections pool.
   */
  async cleanPool() {
    if (!this.poolIsInitialized) {
      return;
    }
    logger.debug('Cleaning IMAP Pool');
    await this.connectionsPool?.clear();
    this.poolIsInitialized = false;
  }

  /**
   * Releases an IMAP connection and returns it to the pool.
   * @param imapConnection - An IMAP connection.
   */
  releaseConnection(imapConnection: Connection) {
    if (!this.poolIsInitialized) {
      Promise.resolve();
    }
    return this.connectionsPool!.release(imapConnection);
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
      destroy: (connection) => {
        connection.destroy();
        return Promise.resolve();
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
