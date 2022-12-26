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
   * inserts a message or list of messages
   * @param {object} message - Message Object
   * @returns {promise} The inserted rows
   */
  async insertMessage(message) {

    const result = await this.supabaseClient
      .from('messages')
      .insert(message)
      .select();

    return result;
  }

  /**
   * inserts a pointofcontact or list of pointofcontacts
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
   * inserts a person or list of persons
   * @param {object} person - Person object
   * @returns {promise} The inserted rows
   */
  async upsertPerson(person) {

    const result = await this.supabaseClient
      .from('persons')
      .upsert(person, { onConflict: 'email' })
      .select();
    return result;
  }

  /**
   * inserts a list of tags
   * @param {object[]} tags - Array of tags
   * @returns {promise}
   */
  createTags(tags) {
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
  refinePersons(userid) {
    return this.supabaseClient.rpc('refined_persons', { userid });
  }
}

module.exports = {
  SupabaseHandlers
};
