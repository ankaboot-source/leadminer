const { createClient } = require('@supabase/supabase-js');
const { supabaseToken, supabaseUrl } = require('../../config/supabase.config');

class SupabaseHandlers {
  supabaseClient;

  /**
   * SupabaseHandlers constructor
   * @param {string} url - The supabase URL.
   * @param {string} token - The supabase token.
   */
  constructor(url, token) {
    this.supabaseClient = createClient(url, token);
  }

  /**
   * `upsertMessage` takes a message ID, user ID, channel, folder, and date, and inserts a new row into
   * the `messages` table if the message ID doesn't already exist
   * @param messageID - The unique ID of the message
   * @param userID - The user running the mining
   * @param channel - The channel name
   * @param folder - inbox, sent, trash
   * @param date - The date the message was sent
   * @returns {promise}
   */
  upsertMessage(messageID, userID, channel, folderPath, date) {
    return this.supabaseClient.from('messages').insert(
      {
        message_id: messageID,
        userid: userID,
        channel,
        folderpath: folderPath,
        date,
        listid: '',
        reference: ''
      },
      { ignoreDuplicates: false }
    );
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
  upsertPointOfContact(messageID, userID, personid, key) {
    return this.supabaseClient.from('pointsofcontact').insert({
      messageid: messageID,
      userid: userID,
      _to: key === 'to',
      cc: key === 'cc',
      bcc: key === 'bcc',
      _from: key === 'from',
      reply_to: key === 'reply-to',
      personid
    });
  }

  /**
   * Upsert a person record into the persons table, using the email address as the unique identifier
   * @param name - The name of the person
   * @param emailsAddress - The email address of the person you want to add to the database.
   * @returns {promise}
   */
  upsertPersons(name, emailsAddress, userID) {
    return this.supabaseClient.from('persons').upsert(
      {
        name,
        email: emailsAddress,
        _userid: userID,
        url: '',
        image: '',
        address: '',
        alternatenames: [],
        sameas: [],
        givenname: name,
        familyname: '',
        jobtitle: '',
        worksfor: 'flyweight'
      },
      { onConflict: 'email', ignoreDuplicates: false }
    );
  }

  /**
   * `createTags` takes a `supabaseClient` and an array of `tags` and inserts them into the `tags` table
   * @param tags - an array of objects with the following properties:
   * @returns {promise}
   */
  createTags(tags) {
    return this.supabaseClient
      .from('tags')
      .upsert([...tags], { onConflict: 'personid, name' });
  }
}

const supabaseHandlers = new SupabaseHandlers(supabaseUrl, supabaseToken);

module.exports = {
  supabaseHandlers
};
