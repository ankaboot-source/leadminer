const { createClient } = require('@supabase/supabase-js');
const { supabaseToken, supabaseUrl } = require('../../config/supabase.config');
const fetch = require('cross-fetch')
const http = require("http");
const https = require("https");

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 40
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 40
});

const customFetch = (url, options) => {
  return fetch(url, {
    agent: (parsedURL) => {
      if (parsedURL.protocol === "http:") {
        return httpAgent;
      } else {
        return httpsAgent;
      }
    },
    ...options
  });
};

class SupabaseHandlers {
  supabaseClient;

  /**
   * SupabaseHandlers constructor
   * @param {string} url - The supabase URL.
   * @param {string} token - The supabase token.
   */
  constructor(url, token) {
    this.supabaseClient = createClient(url, token, {global: {fetch: customFetch}});
  }

  /**
   * `upsertMessage` takes a message ID, user ID, channel, folder, and date, and inserts a new row into
   * the `messages` table if the message ID doesn't already exist
   * @param messageId - The unique ID of the message
   * @param userID - The user running the mining
   * @param channel - The channel name
   * @param folderPath - inbox, sent, trash
   * @param date - The date the message was sent
   * @returns {promise}
   */
  async upsertMessage(messageId, userID, channel, folderPath, date) {
    const message = {
      message_id: messageId,
      userid: userID,
      channel,
      folder_path: folderPath,
      date,
      listid: '',
      reference: ''
    };
    let result = await this.supabaseClient
      .from('messages')
      .insert(message)
      .select()
      .single();

    if (result.error?.code === '23505') {
      result = await this.supabaseClient
        .from('messages')
        .update(message)
        .eq('message_id', messageId)
        .select()
        .single();
    }

    return result;
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
  async upsertPointOfContact(messageID, userID, personid, key, name) {
    const result = await this.supabaseClient
      .from('pointsofcontact')
      .insert({
        messageid: messageID,
        userid: userID,
        name,
        _to: key === 'to',
        cc: key === 'cc',
        bcc: key === 'bcc',
        _from: key === 'from',
        reply_to: key === 'reply-to' || key === 'reply_to',
        body: key === 'body',
        personid
      })
      .select()
      .single();

    return result;
  }

  /**
   * Upsert a person record into the persons table, using the email address as the unique identifier
   * @param name - The name of the person
   * @param emailsAddress - The email address of the person you want to add to the database.
   * @returns {promise}
   */
  async upsertPersons(name, emailsAddress, userID) {
    const person = {
      name,
      email: emailsAddress,
      _userid: userID,
      url: '',
      image: '',
      address: '',
      alternate_names: [],
      same_as: [],
      given_name: name,
      family_name: '',
      job_title: ''
      // works_for: ''  Will be retrieved with transmutation
    };
    let result = await this.supabaseClient
      .from('persons')
      .insert(person)
      .select()
      .single();

    if (result.error?.code === '23505') {
      result = await this.supabaseClient
        .from('persons')
        .update(person)
        .eq('email', emailsAddress)
        .select()
        .single();
    }
    return result;
  }

  /**
   * `createTags` takes an array of `tags` and inserts them into the `tags` table
   * @param tags - an array of objects with the following properties:
   * @returns {promise}
   */
  createTags(tags) {
    return this.supabaseClient
      .from('tags')
      .upsert([...tags], { onConflict: 'personid, name' });
  }

  async createGoogleUser({ email, refresh_token }) {
    const { data, error } = await this.supabaseClient
      .from('google_users')
      .insert({ email, refresh_token })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getGoogleUserByEmail(email) {
    const { data, error } = await this.supabaseClient
      .from('google_users')
      .select()
      .eq('email', email)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data.length === 1 ? data[0] : null;
  }

  async updateGoogleUser(id, updatedFields) {
    const { data, error } = await this.supabaseClient
      .from('google_users')
      .update(updatedFields)
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data.length === 1 ? data[0] : null;
  }

  async createImapUser({ email, host, port, tls }) {
    const { data, error } = await this.supabaseClient
      .from('imap_users')
      .insert({ email, host, port, tls })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async updateImapUser(id, updatedFields) {
    const { data, error } = await this.supabaseClient
      .from('imap_users')
      .update(updatedFields)
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data.length === 1 ? data[0] : null;
  }

  async getImapUserByEmail(email) {
    const { data, error } = await this.supabaseClient
      .from('imap_users')
      .select()
      .eq('email', email)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data.length === 1 ? data[0] : null;
  }

  async getImapUserById(id) {
    const { data, error } = await this.supabaseClient
      .from('imap_users')
      .select()
      .eq('id', id)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data.length === 1 ? data[0] : null;
  }

  /**
   * `invokeRpc` calls a Postgres function as a Remote Procedure Call.
   * @param functionName - Name of the function to be invoked
   * @param data - Data to be passed to the function
   * @returns {promise}
   */
  invokeRpc(functionName, data) {
    return this.supabaseClient.rpc(functionName, data);
  }
}

const supabaseHandlers = new SupabaseHandlers(supabaseUrl, supabaseToken);

module.exports = {
  supabaseHandlers
};
