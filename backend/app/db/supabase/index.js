const { createClient } = require('@supabase/supabase-js');
const { supabaseToken, supabaseUrl } = require('../../config/supabase.config');
const { fetch } = require('./fetch');

class SupabaseHandler {
  supabaseClient;

  constructor() {
    this.supabaseClient = createClient(supabaseUrl, supabaseToken, {
      global: { fetch: fetch.bind(globalThis) }
    });
  }

  /**
   * Inserts a message or list of messages
   * @param {object} message - Message Object
   * @returns {promise} The inserted rows
   */
  async insertMessage(message) {

    const result = await this.supabaseClient
      .from('messages')
      .insert(message)
      .select()
      .single();

    return result;
  }

  /**
   * Inserts a point of contact record. or list of pointofcontacts
   * @param {object} pointOfContact - PointofContact Object
   * @returns {promise}
   */
  async insertPointOfContact(pointOfContact) {
    const result = await this.supabaseClient
      .from('pointsofcontact')
      .insert(pointOfContact);
    return result;
  }

  /**
   * Inserts a person record
   * @param {object} person - Person object
   * @returns {promise} The inserted rows
   */
  async upsertPerson(person) {

    const result = await this.supabaseClient
      .from('persons')
      .upsert(person, { onConflict: 'email' })
      .select()
      .single();
    return result;
  }

  /**
   * Inserts a list of tag records.
   * @param {object[]} tags - Array of tags
   * @returns {promise}
   */
  insertTags(tags) {
    return this.supabaseClient
      .from('tags')
      .upsert(tags, { onConflict: 'personid, name', ignoreDuplicates: true });
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
  callRpcFunction(userid, functionName) {
    return this.supabaseClient.rpc(functionName, { userid });
  }
}

module.exports = {
  SupabaseHandler
};
