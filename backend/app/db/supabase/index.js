const { createClient } = require('@supabase/supabase-js');
const { supabaseToken, supabaseUrl } = require('../../config/supabase.config');
const { fetch } = require('./fetch');

class SupabaseHandlers {
  supabaseClient;

  constructor() {
    this.supabaseClient = createClient(supabaseUrl, supabaseToken, {
      global: { fetch: fetch.bind(globalThis) }
    });
  }

  /**
   * `insertMessage` takes a message Object (ID, user ID, channel, folder, and date) and inserts a new row into
   * the `messages` table if the message ID doesn't already exist
   * @param {string} message - Message Object
   * @returns {promise}
   */
  async insertMessage(message) {

    const result = await this.supabaseClient
      .from('messages')
      .insert([...message])
      .select();

    return result;
  }

  /**
   * It takes a pointofcontact Object (message ID, a user ID, a person ID, 'to', 'cc', 'bcc', 'from',or 'reply-to')
   * and then inserts a new row into the pointsofcontact table.
   * @param messageID - PointofContact Object
   * @returns {promise} .
   */
  async insertPointOfContact(pointOfContact) {
    const result = await this.supabaseClient
      .from('pointsofcontact')
      .insert([...pointOfContact]);
    //.select() We don't need returned rows for now.

    return result;
  }

  /**
   * Insert a person Object() into the persons table, using the email address as the unique identifier
   * @param person - Person object
   * @returns {promise}
   */
  async upsertPerson(person) {

    const result = await this.supabaseClient
      .from('persons')
      .upsert([...person], { onConflict: 'email' })
      .select();

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
      .upsert([...tags], { onConflict: 'personid, name', ignoreDuplicates: true });
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

  async updateGoogleUser(id, refresh_token) {
    const { data, error } = await this.supabaseClient
      .from('google_users')
      .update({ refresh_token })
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
   * Invokes the `refined_persons` function in Postgres.
   * @param  {string} userid  - User ID
   * @returns {promise}
   */
  refinePersons(userid) {
    return this.supabaseClient.rpc('refined_persons', { userid });
  }
}

module.exports = {
  SupabaseHandlers
};
