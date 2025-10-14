import { createClient } from '@supabase/supabase-js';
import ENV from '../config';

const supabaseClient = createClient(
  ENV.SUPABASE_PROJECT_URL,
  ENV.SUPABASE_SECRET_PROJECT_TOKEN,
  {
    // Proper init https://supabase.com/docs/reference/javascript/admin-api
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default supabaseClient;
