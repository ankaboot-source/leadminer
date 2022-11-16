const { createClient, SupabaseClient } = require('@supabase/supabase-js');
const { supabaseToken, supabaseUrl } = require('../../config/supabase.config');

class SupabaseService {
  #supabaseClient;

  /**
   * SupabaseHandlers constructor
   * @param {SupabaseClient} supabaseClient - The supabase client.
   */
  constructor(supabaseClient) {
    this.#supabaseClient = supabaseClient;
  }
}

module.exports = {
  SupabaseService
};
