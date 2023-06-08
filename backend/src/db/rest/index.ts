import { createClient } from '@supabase/supabase-js';
import ENV from '../../config';

const restClient = createClient(
  ENV.SUPABASE_PROJECT_URL,
  ENV.SUPABASE_SECRET_PROJECT_TOKEN,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);
const authClient = restClient.auth;

export default authClient;
