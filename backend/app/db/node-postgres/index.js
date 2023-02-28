const format = require('pg-format');
const { Pool } = require('pg');
const { logger } = require('../../utils/logger');
const { parametrizedInsertInto } = require('./helpers');
const { PG_CONNECTION_STRING } = require('../../config');

class PostgresHandler {
  constructor() {
    this.client = new Pool({
      connectionString: PG_CONNECTION_STRING,
      max: 10
    });
  }

  /**
   * Executes a query on the Postgres database and returns the result
   * @param {string} text - The SQL query to be executed
   * @param {array} params - An array of values to be passed as parameters to the query
   * @returns {object} - Returns an object containing the query result or error
   */
  async query(text, params) {
    try {
      const start = performance.now();
      const { rows } = await this.client.query(text, params);
      const duration = performance.now() - start;
      logger.debug('Executed query', {
        text,
        executionTime: duration
      });
      return { data: rows.length === 0 ? null : rows, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Inserts a new message record.
   * @param {object} message - Message object
   * @returns {Promise<object>} The inserted row
   */
  async insertMessage(message) {
    const query = `${parametrizedInsertInto(
      'messages',
      Object.keys(message)
    )} RETURNING id`;
    const { data, error } = await this.query(query, Object.values(message));
    return { data: data && data[0], error };
  }

  /**
   * Inserts a point of contact record.
   * @param {object} pointOfContact - Point of contact object.
   * @returns {Promise<object>} The inserted row
   */
  async insertPointOfContact(pointOfContact) {
    const query = `${parametrizedInsertInto(
      'pointsofcontact',
      Object.keys(pointOfContact)
    )} RETURNING id`;
    const { data, error } = await this.query(
      query,
      Object.values(pointOfContact)
    );
    return { data: data && data[0], error };
  }

  /**
   * Inserts or updates a person record into the persons table.
   * @param {object} person - The person object
   * @returns {Promise<object>} The inserted/updated row
   */
  async upsertPerson(person) {
    const query = `
    ${parametrizedInsertInto('persons', Object.keys(person))}
    ON CONFLICT (email) DO UPDATE SET name=excluded.name RETURNING id`;
    const { data, error } = await this.query(query, Object.values(person));
    return { data: data && data[0], error };
  }

  /**
   * Inserts a list of tags.
   * @param {object[]} tags - List of tag objects
   * @returns {Promise<void>}
   */
  async insertTags(tags) {
    if (tags.length === 0) {
      return { data: null, error: null };
    }
    const query = format(
      'INSERT INTO tags (%s) VALUES %L ON CONFLICT (personid, name) DO NOTHING',
      Object.keys(tags[0])
        .map((i) => `"${i}"`)
        .join(', '),
      tags.map((t) => Object.values(t))
    );
    const { data, error } = await this.query(query, null);
    return { data: data && data[0], error };
  }

  /**
   * Creates a google user.
   * @param {object} input - Google user
   * @param {string} input.email - User email
   * @param {string} input.refresh_token - Google refresh token
   * @returns {Promise<object>} Created google user
   */
  async createGoogleUser({ email, refresh_token }) {
    const query =
      'INSERT INTO google_users(email, refresh_token) ' +
      'VALUES($1, $2) RETURNING *';

    const { data, error } = await this.query(query, [email, refresh_token]);
    if (error) {
      logger.error(error.message, { error });
    }
    return data && data[0];
  }

  /**
   * Retrieves a google user given his email.
   * @param {string} email - User email
   * @returns {Promise<object>} Google user
   */
  async getGoogleUserByEmail(email) {
    const query = 'SELECT * FROM google_users WHERE email = $1';
    const { data, error } = await this.query(query, [email]);
    if (error) {
      logger.error(error.message, { error });
    }
    return data && data[0];
  }

  /**
   * Updates the refresh token of a google user.
   * @param {string} id - User id
   * @param {string} refresh_token - User refresh token
   * @returns {Promise<object>} Updated google user
   */
  async updateGoogleUser(id, refresh_token) {
    const query =
      'UPDATE google_users SET refresh_token = $1 WHERE id = $2 RETURNING *';

    const { data, error } = await this.query(query, [refresh_token, id]);
    if (error) {
      logger.error(error.message, { error });
    }
    return data && data[0];
  }

  /**
   * Creates an IMAP user.
   * @param {object} input - IMAP User
   * @param {string} input.email - User email
   * @param {string} input.host - IMAP host
   * @param {number} input.port - IMAP port
   * @param {boolean} input.tls - Enable or disable tls
   * @returns {Promise<object>} Created IMAP user
   */
  async createImapUser({ email, host, port, tls }) {
    const query =
      'INSERT INTO imap_users(email, host, port, tls) ' +
      'VALUES($1, $2, $3, $4) RETURNING *';

    const { data, error } = await this.query(query, [email, host, port, tls]);
    if (error) {
      logger.error(error.message, { error });
    }
    return data && data[0];
  }

  /**
   * Retrieves an IMAP user given his email.
   * @param {string} email - User email
   * @returns {Promise<object>} IMAP user
   */
  async getImapUserByEmail(email) {
    const query = 'SELECT * FROM imap_users WHERE email = $1';
    const { data, error } = await this.query(query, [email]);
    if (error) {
      logger.error(error.message, { error });
    }
    return data && data[0];
  }

  /**
   * Retrieves an IMAP user given his ID.
   * @param {string} id - User ID
   * @returns {Promise<object>} IMAP user
   */
  async getImapUserById(id) {
    const query = 'SELECT * FROM imap_users WHERE id = $1';
    const { data, error } = await this.query(query, [id]);
    if (error) {
      logger.error(error.message, { error });
    }
    return data && data[0];
  }

  /**
   * Invokes the `refined_persons` stored function in Postgres.
   * @param {string} userid - User ID
   * @param {string} functionName - Name of the rpc function to invoke.
   * @returns {Promise<object>}
   */
  async callRpcFunction(userid, functionName) {
    const { data, error } = await this.query(
      `SELECT * FROM ${functionName}($1)`,
      [userid]
    );
    return { data: data && data[0], error };
  }
}

module.exports = { PostgresHandler };
