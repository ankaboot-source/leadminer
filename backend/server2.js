const { buildApp } = require('./app/app2');
const { createClient } = require('@supabase/supabase-js');
const { supabaseToken, supabaseUrl } = require('./app/config/supabase.config');
const supabaseClient = createClient(supabaseUrl, supabaseToken);
const { SupabaseService } = require('./app/services/SupabaseService');
const { GoogleService } = require('./app/services/GoogleService');
const { GoogleController } = require('./app/controllers/GoogleController');
const {
  googleClientId,
  googleClientSecret
} = require('./app/config/google.config');

const { OAuth2Client } = require('google-auth-library');

const oAuth2Client = new OAuth2Client({
  clientId: googleClientId,
  clientSecret: googleClientSecret,
  redirectUri: ''
});

const supabaseService = new SupabaseService(supabaseClient);
const googleService = new GoogleService(oAuth2Client);
const googleController = new GoogleController(googleService, supabaseService);

const app = buildApp(googleController);

app.listen(3000, () => {});
