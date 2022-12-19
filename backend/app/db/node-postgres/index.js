const pool = require('./setup');

class Postgres {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Inserts a new message record.
   * @param {string} messageID - The unique ID of the message
   * @param {string} userID - The user running the mining
   * @param {string} messageChannel - The channel name (`imap`...)
   * @param {string} folderPath - The folder path of the message
   * @param {string} messageDate - The date the message was sent
   * @param {string} listId - The List-id header field, to identify if email message is part of a list and which one
   * @param {string[]} references - List of references if the email message is in conversation
   * @param {boolean} isConversation - Indicates if the email message is in a conversation
   * @returns {Promise<object>} The inserted message
   */
  async insertMessage(
    messageID,
    userID,
    messageChannel,
    folderPath,
    messageDate,
    listId,
    references,
    isConversation
  ) {
    const query =
      'INSERT INTO messages(channel, folder_path, date, userid, message_id, references, list_id, conversation) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';

    try {
      const result = await pool.query(
        query,
        [
          messageChannel,
          folderPath,
          new Date(messageDate),
          userID,
          messageID,
          references,
          listId,
          isConversation
        ],
        this.logger
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Inserts a point of contact record.
   * @param {string} messageID - The message ID
   * @param {string} userID - The user ID
   * @param {string} personID - The person ID
   * @param {string} fieldName - The name of the field where the email address was found
   * (`to`, `from`, `body` ...)
   * @param {string} name - The identified person name
   * @returns {Promise<object>} The inserted point of contact
   */
  async insertPointOfContact(messageID, userID, personID, fieldName, name) {
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
          fieldName === 'from',
          fieldName === 'reply-to' || fieldName === 'reply_to',
          fieldName === 'to',
          fieldName === 'cc',
          fieldName === 'bcc',
          fieldName === 'body',
          personID
        ],
        this.logger
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Inserts or updates a person record into the persons table.
   * @param {string} name - The name of the person
   * @param {string} emailsAddress - The email address of the person
   * @param {string} userID - The user ID
   * @returns {Promise<object>} The inserted/updated person
   */
  async upsertPerson(name, emailsAddress, userID) {
    const query =
      'INSERT INTO persons(name, email, _userid, url, image, address, alternate_names, same_as, given_name, family_name, job_title) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *';

    try {
      const { rows, rowCount } = await pool.query(
        'SELECT * FROM persons WHERE email = $1',
        [emailsAddress],
        this.logger
      );
      if (rowCount !== 0) {
        return { data: rows[0], error: null };
      }

      const result = await pool.query(
        query,
        [name, emailsAddress, userID, '', '', '', [], [], '', '', ''],
        this.logger
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Inserts a list of tags.
   * @param {object[]} tags - List of tag objects
   * @returns {Promise<void>}
   */
  async createTags(tags) {
    try {
      return await Promise.all(
        tags.map(async ({ userid, name, label, reachable, type, personid }) => {
          const existingTag = await pool.query(
            'SELECT * FROM tags WHERE personid = $1 AND name = $2',
            [personid, name],
            this.logger
          );

          if (existingTag.rowCount === 0) {
            const query =
              'INSERT INTO tags(personid, userid, name, label, reachable, type) ' +
              'VALUES($1, $2, $3, $4, $5, $6)';

            await pool.query(
              query,
              [personid, userid, name, label, reachable, type],
              this.logger
            );
          } else {
            await pool.query(
              'UPDATE tags SET personid = $1, userid = $2, name = $3, label = $4, reachable = $5, type = $6 WHERE id = $7',
              [
                personid,
                userid,
                name,
                label,
                reachable,
                type,
                existingTag.rows[0].id
              ],
              this.logger
            );
          }
        })
      );
    } catch (error) {
      return { error };
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

    const result = await pool.query(query, [email, refresh_token], this.logger);
    return result.rows[0];
  }

  /**
   * Retrieves a google user given his email.
   * @param {string} email - User email
   * @returns {Promise<object>} Google user
   */
  async getGoogleUserByEmail(email) {
    const query = 'SELECT * FROM google_users WHERE email = $1';

    const result = await pool.query(query, [email], this.logger);
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

    const result = await pool.query(query, [id, refresh_token], this.logger);
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

    const result = await pool.query(
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

    const result = await pool.query(query, [email], this.logger);
    return result.rowCount > 0 ? result.rows[0] : null;
  }

  /**
   * Retrieves an IMAP user given his ID.
   * @param {string} id - User ID
   * @returns {Promise<object>} IMAP user
   */
  async getImapUserById(id) {
    const query = 'SELECT * FROM imap_users WHERE id = $1';

    const result = await pool.query(query, [id], this.logger);
    return result.rowCount > 0 ? result.rows[0] : null;
  }

  /**
   * Invokes the `refined_persons` stored function in Postgres.
   * @param {string} userid - User ID
   * @returns {Promise<object>}
   */
  async refinePersons(userid) {
    try {
      const result = await pool.query(
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

module.exports = { Postgres };
