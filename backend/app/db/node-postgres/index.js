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
  async insertMessage(
    messageId,
    userID,
    messageChannel,
    folderPath,
    messageDate,
    listId,
    references,
    isConversation
  ) {
    const query =
      'INSERT INTO messages(channel, folder_path, date, userid, message_id, reference, list_id, conversation) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';

    try {
      const result = await pool.query(
        query,
        [
          messageChannel,
          folderPath,
          new Date(messageDate),
          userID,
          messageId,
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
                existingTag.rows[0]
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
  async refinePersons({ userid }) {
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
