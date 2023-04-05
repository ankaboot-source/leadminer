const Imap = require('imap');
const {
  IMAP_CONNECTION_TIMEOUT,
  IMAP_AUTH_TIMEOUT,
  IMAP_MAX_CONNECTIONS
} = require('../config');
const genericPool = require('generic-pool');
const { logger } = require('../utils/logger');

const tokenHelpers = require('../utils/helpers/tokenHelpers');

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
  async withGoogle(token, refreshToken, userId, redisPubInstance) {
    const googleConfig = {
      host: 'imap.gmail.com',
      port: 993,
      tlsOptions: {
        host: 'imap.gmail.com',
        port: 993,
        servername: 'imap.gmail.com'
      }
    };
    try {
      const { newToken, xoauth2Token } = await tokenHelpers.generateXOauthToken(
        {
          token,
          refreshToken,
          email: this.#imapConfig.user
        }
      );
      googleConfig.xoauth2 = xoauth2Token;
      await redisPubInstance.publish(`auth-${userId}`, newToken);
      this.#imapConfig = {
        ...this.#imapConfig,
        ...googleConfig
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
   * @returns {Object} - The object for the connection
   */
  withPassword(host, password, port = 993) {
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
  async connect() {
    try {
      const imapConnection = await new Promise((resolve, reject) => {
        const connection = new Imap(this.#imapConfig);

        connection.on('error', (err) => reject(err));
        connection.once('ready', () => resolve(connection));
        connection.connect();
      });

      // Set up event listeners to log when the connection is closed or ended
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
   * Acquires a new Imap connection.
   * @returns {Promise<Imap>} - A promise that resolves to an Imap connection.
   */
  acquireConnection() {
    if (!this.#poolIsInitialized) {
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
    return this.#connectionsPool.release(imapConnection);
  }

  /**
   * Initializes a pool of IMAP connections.
   * @returns {Promise<void>}
   */
  #initializePool() {
    const factory = {
      create: () => {
        return new Promise((resolve, reject) => {
          this.connect()
            .then((connection) => resolve(connection))
            .catch((error) => reject(error));
        });
      },
      destroy: (connection) => {
        connection.destroy();
      }
    };

    const opts = {
      max: IMAP_MAX_CONNECTIONS, // maximum size of the pool
      min: 0 // minimum size of the pool
    };

    this.#connectionsPool = genericPool.createPool(factory, opts);

    // Set up an event listener for factory create errors
    this.#connectionsPool.on('factoryCreateError', (err) => {
      logger.error('Error creating IMAP connection pool resource', {
        metadata: { message: err.message, details: err }
      });
    });
  }
}

module.exports = {
  ImapConnectionProvider
};
