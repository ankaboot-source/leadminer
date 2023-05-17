import { createPool } from 'generic-pool';
import Imap from 'imap';
import {
  IMAP_AUTH_TIMEOUT,
  IMAP_CONNECTION_TIMEOUT,
  IMAP_MAX_CONNECTIONS,
  IMAP_PROVIDERS,
  OAUTH_PROVIDERS
} from '../config';
import logger from '../utils/logger';

import generateXOauthToken from '../utils/helpers/tokenHelpers';
import { createOAuthClient } from '../utils/helpers/oauthHelpers';

class ImapConnectionProvider {
  /**
   * @typedef {Object} ImapConnectionProviderConfig
   * @property {string} [id] - A unique identifier for the connection
   * @property {string} [password] - User's password for non-OAuth connections
   * @property {string} [host] - The host name or IP address of the mail server
   * @property {number} [port] - The port number of the mail server (default: 993)
   * @property {string} [access_token] - OAuth access token for connecting to Google
   * @property {string} [refresh_token] - OAuth refresh token for connecting to Google
   * @property {Object} [sse] - A server sent event (SSE) instance.
   */

  #imapConfig;

  #poolIsInitialized;

  #connectionsPool;

  /**
   * ImapConnectionProvider constructor.
   * @constructor
   * @param {string} email - User email address
   */
  constructor(email) {
    this.#imapConfig = {
      user: email,
      connTimeout: IMAP_CONNECTION_TIMEOUT,
      authTimeout: IMAP_AUTH_TIMEOUT,
      tls: true,
      keepalive: false
    };

    this.#poolIsInitialized = false;
  }

  /**
   * Builds the configuration for connecting to Google using OAuth.
   * @param {string} email - User's email address
   * @param {string} accessToken - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} userId - A unique identifier for the connection
   * @param {Object} redisPubSubClient - The Redis pub/sub client instance
   * @returns {Object} - The object for the connection
   */
  async withOauth(token, refreshToken, userId, redisPubInstance) {
    try {
      const emailDomain = this.#imapConfig.user.split('@')[1]?.split('.')[0];
      const imapProvider = IMAP_PROVIDERS.find(({ domains }) =>
        domains.includes(emailDomain)
      );

      if (imapProvider === undefined) {
        throw new Error(
          `Imap provider for domain "${emailDomain}" is not supported.`
        );
      }

      const { host, port } = imapProvider;
      const config = {
        host,
        port,
        tlsOptions: {
          host,
          port,
          servername: host
        }
      };

      const provider = OAUTH_PROVIDERS.find(
        ({ name }) => name === imapProvider.name
      );

      if (provider === undefined) {
        throw new Error(`Provider "${imapProvider.name}" not supported.`);
      }

      // Create Oauth stratetgy based on the used oauth provider.
      const oauthClient = createOAuthClient(provider, '');

      const { newToken, xoauth2Token } = await generateXOauthToken(
        oauthClient,
        token,
        refreshToken,
        this.#imapConfig.user
      );

      config.xoauth2 = xoauth2Token;
      await redisPubInstance.publish(`auth-${userId}`, newToken); // TODO: to be removed
      this.#imapConfig = {
        ...this.#imapConfig,
        ...config
      };
      return this;
    } catch (error) {
      throw new Error(`Failed generating XOAuthToken: ${error}`);
    }
  }

  /**
   * Builds the configuration for connecting to a mail server using a username and password.
   * @param {string} host - The host name or IP address of the mail server
   * @param {string} password - User's password
   * @param {number} [port=993] - The port number to connect to the server on (optional, defaults to 993)
   * @returns {Object} - The object for the connection
   * @throws {TypeError} - If any parameter is invalid
   */
  withPassword(host, password, port = 993) {
    if (!host || !password || typeof port !== 'number') {
      throw new TypeError(
        'Invalid parameters. Host and password must be non-empty strings and port must be a number.'
      );
    }

    this.#imapConfig = {
      ...this.#imapConfig,
      password,
      host,
      port,
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
   * @returns {Promise<Imap>} - A Promise that resolves to the Imap object upon successful connection.
   * @throws {Error} - If the connection fails for any reason.
   */
  async #connect() {
    try {
      const imapConnection = await new Promise((resolve, reject) => {
        const connection = new Imap(this.#imapConfig);

        connection.on('error', (err) => reject(err));
        connection.once('ready', () => resolve(connection));
        connection.connect();
      });

      imapConnection.once('close', (hadError) => {
        logger.debug('Imap connection closed.', { metadata: { hadError } });
      });
      imapConnection.once('end', () => {
        logger.debug('Imap connection ended.');
      });

      return imapConnection;
    } catch (error) {
      logger.error('Imap connection error', {
        metadata: { message: error.message, details: error }
      });
      throw error;
    }
  }

  /**
   * Acquires a new Imap connection from the connection pool.
   * If the connection pool is not yet initialized, it initializes the pool before acquiring a connection.
   *
   * @returns {Promise<Imap>} A Promise that resolves to an Imap connection.
   * @throws {Error} If the connection pool initialization fails due to connection error.
   */
  async acquireConnection() {
    if (!this.#poolIsInitialized) {
      // Should throw an error, if wrong creds and prevents pool from getting initialized.
      const connection = await this.#connect();
      connection.destroy();
      this.#initializePool();
      this.#poolIsInitialized = true;
    }

    return this.#connectionsPool.acquire();
  }

  /**
   * Shuts down and drains the allocated IMAP connections pool.
   * @returns {Promise<void>}
   */
  async cleanPool() {
    if (!this.#poolIsInitialized) {
      return;
    }
    logger.debug('Cleaning IMAP Pool');
    await this.#connectionsPool.clear();
    this.#poolIsInitialized = false;
  }

  /**
   * Releases an IMAP connection and returns it to the pool.
   * @param {Imap} imapConnection - An IMAP connection object.
   * @returns {Promise<void>}
   */
  releaseConnection(imapConnection) {
    if (!this.#poolIsInitialized) {
      return;
    }
    this.#connectionsPool.release(imapConnection);
  }

  /**
   * Initializes a pool of IMAP connections.
   * @returns {Promise<void>}
   */
  #initializePool() {
    const factory = {
      create: async () => {
        try {
          return await this.#connect();
        } catch (err) {
          logger.error('Failed to create pool resources', {
            metadata: {
              message: err.message,
              details: err
            }
          });
          throw err;
        }
      },
      destroy: (connection) => {
        connection.destroy();
      }
    };

    const opts = {
      max: IMAP_MAX_CONNECTIONS, // maximum size of the pool
      min: 0 // minimum size of the pool
    };

    this.#connectionsPool = createPool(factory, opts);

    // Set up an event listener for factory create errors
    this.#connectionsPool.on('factoryCreateError', (err) => {
      logger.error('Error creating IMAP connection pool resource', {
        metadata: { message: err.message, details: err }
      });
    });
  }
}

export default ImapConnectionProvider;
