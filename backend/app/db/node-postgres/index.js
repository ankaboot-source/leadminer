const pool = require('./setup');

class Postgres {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * `insertMessage` takes a message ID, user ID, channel, folder, and date, and inserts a new row into
   * the `messages` table if the message ID doesn't already exist
   * @param messageId - The unique ID of the message
   * @param userID - The user running the mining
   * @param channel - The channel name
   * @param folderPath - inbox, sent, trash
   * @param date - The date the message was sent
   * @returns {promise}
   */
  async insertMessage(messageId, userID, channel, folderPath, date) {
    const query =
      'INSERT INTO messages(channel, folder_path, date, userid, listid, message_id, reference) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *';

    try {
      const result = await pool.query(
        query,
        [channel, folderPath, date, userID, '', messageId, ''],
        this.logger
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * It takes a message ID, a user ID, a person ID, and a key (which is either 'to', 'cc', 'bcc', 'from',
   * or 'reply-to') and then inserts a new row into the pointsofcontact table
   * @param messageID - the ID of the message we're inserting
   * @param userID - the current user
   * @param personid - The personid of the person we're adding to the point of contact table.
   * @param key - the key of the email address in the email object
   * @returns {promise} .
   */
  async insertPointOfContact(messageID, userID, personid, key, name) {
    const query =
      'INSERT INTO pointsofcontact(userid, messageid, name, _from, reply_to, _to, cc, bcc, body, personid) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *';

    try {
      const result = await pool.query(
        query,
        [
          userID,
          messageID,
          name,
          key === 'from',
          key === 'reply-to' || key === 'reply_to',
          key === 'to',
          key === 'cc',
          key === 'bcc',
          key === 'body',
          personid
        ],
        this.logger
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Upsert a person record into the persons table, using the email address as the unique identifier
   * @param name - The name of the person
   * @param emailsAddress - The email address of the person you want to add to the database.
   * @returns {promise}
   */
  async insertPerson(name, emailsAddress, userID) {
    const query =
      'INSERT INTO persons(name, email, _userid, url, image, address, alternate_names, same_as, given_name, family_name, job_title) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *';

    try {
      const result = await pool.query(
        query,
        [name, emailsAddress, userID, '', '', '', [], [], name, '', ''],
        this.logger
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * `createTags` takes an array of `tags` and inserts them into the `tags` table
   * @param tags - an array of objects with the following properties:
   * @returns {promise}
   */
  async createTags(tags) {
    try {
      const query =
        'INSERT INTO tags(personid, userid, name, label, reachable, type) ' +
        'VALUES($1, $2, $3, $4, $5, $6)';

      return await Promise.all(
        tags.map(({ userid, name, label, reachable, type, personid }) => {
          pool.query(
            query,
            [personid, userid, name, label, reachable, type],
            this.logger
          );
        })
      );
    } catch (error) {
      return { error };
    }
  }

  async createGoogleUser({ email, refresh_token }) {
    const query =
      'INSERT INTO google_users(email, refresh_token) ' +
      'VALUES($1, $2) RETURNING *';

    const result = await pool.query(query, [email, refresh_token], this.logger);
    return result.rows[0];
  }

  async getGoogleUserByEmail(email) {
    const query = 'SELECT * FROM google_users WHERE email = $1';

    const result = await pool.query(query, [email], this.logger);
    return result.rows[0];
  }

  async updateGoogleUser(id, { refresh_token }) {
    const query =
      'UPDATE google_users SET refresh_token = $1 WHERE id = $2 RETURNING *';

    const result = await pool.query(query, [id, refresh_token], this.logger);
    return result.rows[0];
  }

  async createImapUser({ email, host, port, tls }) {
    const query =
      'INSERT INTO imap_users(email, host, port, tls) ' +
      'VALUES($1, $2, $3, $4) RETURNING *';

    const result = await pool.query(
      query,
      [email, host, port, tls],
      this.logger
    );

    return result.rows[0];
  }

  async getImapUserByEmail(email) {
    const query = 'SELECT * FROM imap_users WHERE email = $1';

    const result = await pool.query(query, [email], this.logger);
    return result.rowCount > 0 ? result.rows[0] : null;
  }

  async getImapUserById(id) {
    const query = 'SELECT * FROM imap_users WHERE id = $1';

    const result = await pool.query(query, [id], this.logger);
    return result.rowCount > 0 ? result.rows[0] : null;
  }

  /**
   * Invokes the `refined_persons` function in Postgres.
   * @param  {string} userid  - User ID
   * @returns {promise}
   */
  refinePersons({ userid }) {
    return pool.query(
      'SELECT * FROM refined_persons($1)',
      [userid],
      this.logger
    );
  }
}

module.exports = { Postgres };
