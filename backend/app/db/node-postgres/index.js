const format = require('pg-format');

const { Client } = require('pg');
const { pgConnectionString } = require('../../config/supabase.config');

/**
 * Creates a parametrized query.
 * @param {string[]} fields - Array of field names 
 * @returns {string}
 */
function parametrizeQuery(fields) {
  return `(${fields.map((i) => {
    return `"${i}"`; 
  }).join(', ')}) VALUES (${fields.map((_, i) => {
    return `$${i + 1}`; 
  }).join(', ')})`;
}

class PostgresHandler {
  constructor() {
    this.client = new Client({
      connectionString: pgConnectionString
    });
    this.#connect();
  }

  #connect() {
    (async () => {
      await this.client.connect(); 
    })();
  }
  /**
   * Inserts a new message record.
   * @param {object} message - Message object
   * @returns {Promise<object>} The inserted row
   */
  async insertMessage(message) {

    const query =
      `INSERT INTO messages ${parametrizeQuery(Object.keys(message))} RETURNING *`;
    try {
      const { rows } = await this.client.query(
        query,
        Object.values(message),
        this.logger
      );
      return {data: rows[0], error: null}; // single object;  
    } catch (error) {
      return { data: null, error};
    }
  }

  /**
   * Inserts a point of contact record.
   * @param {object} pointOfContact - Point of contact object.
   * @returns {Promise<object>} The inserted row
   */
  async insertPointOfContact(pointOfContact) {

    const query =
      `INSERT INTO pointsofcontact ${parametrizeQuery(Object.keys(pointOfContact))} RETURNING *`;
    
    try {
      const { rows } = await this.client.query(
        query,
        Object.values(pointOfContact),
        this.logger
      );
      return {data: rows[0], error: null} // single object;
    } catch (error) {
      return { data: null, error};
    }
  }

  /**
   * Inserts or updates a person record into the persons table.
   * @param {object} person - The person object 
   * @returns {Promise<object>} The inserted/updated row
   */
  async upsertPerson(person) {

    const query =
      `INSERT INTO persons ${parametrizeQuery(Object.keys(person))} ON CONFLICT (email) DO UPDATE SET name=excluded.name RETURNING *`;

    try {
      const { rows } = await this.client.query(
        query,
        Object.values(person),
        this.logger
      );
      return {data: rows[0], error: null} // single object;
    } catch (error) {
      return { data: null, error};
    }
  }

  /**
   * Inserts a list of tags.
   * @param {object[]} tags - List of tag objects
   * @returns {Promise<void>}
   */
  async insertTags(tags) {

    if (tags.length === 0) {
      return result;
    }
    const values = tags.map((t) => Object.values(t));
    const keys = Object.keys(tags[0]).map((i) => {
      return `"${i}"`; 
    }).join(', ');
    const query = format(
      `INSERT INTO tags (${keys}) VALUES %L ON CONFLICT (personid, name) DO NOTHING`, values
    );

    try {
      const { rows } = await this.client.query(
        query,
        null,
        this.logger
      );
      return {data: rows, error: null}
    } catch (error) {
      return { data: null, error};
    }
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

    const result = await this.client.query(query, [email, refresh_token], this.logger);
    return result.rows[0];
  }

  /**
   * Retrieves a google user given his email.
   * @param {string} email - User email
   * @returns {Promise<object>} Google user
   */
  async getGoogleUserByEmail(email) {
    const query = 'SELECT * FROM google_users WHERE email = $1';

    const result = await this.client.query(query, [email], this.logger);
    return result.rows[0];
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

    const result = await this.client.query(query, [id, refresh_token], this.logger);
    return result.rows[0];
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

    const result = await this.client.query(
      query,
      [email, host, port, tls],
      this.logger
    );

    return result.rows[0];
  }

  /**
   * Retrieves an IMAP user given his email.
   * @param {string} email - User email
   * @returns {Promise<object>} IMAP user
   */
  async getImapUserByEmail(email) {
    const query = 'SELECT * FROM imap_users WHERE email = $1';

    const result = await this.client.query(query, [email], this.logger);
    return result.rowCount > 0 ? result.rows[0] : null;
  }

  /**
   * Retrieves an IMAP user given his ID.
   * @param {string} id - User ID
   * @returns {Promise<object>} IMAP user
   */
  async getImapUserById(id) {
    const query = 'SELECT * FROM imap_users WHERE id = $1';

    const result = await this.client.query(query, [id], this.logger);
    return result.rowCount > 0 ? result.rows[0] : null;
  }

  /**
   * Invokes the `refined_persons` stored function in Postgres.
   * @param {string} userid - User ID
   * @returns {Promise<object>}
   */
  async refinePersons(userid) {
    try {
      const result = await this.client.query(
        'SELECT * FROM refined_persons($1)',
        [userid],
        this.logger
      );
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

module.exports = { PostgresHandler };
