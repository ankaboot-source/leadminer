// eslint-disable-next-line no-unused-vars
const { GoogleService } = require('../services/GoogleService');
// eslint-disable-next-line no-unused-vars
const { SupabaseHandlers } = require('../services/supabase');

class GoogleController {
  #googleService;
  #supabaseHandlers;

  /**
   *
   * @param {GoogleService} googleService
   * @param {SupabaseHandlers} supabaseHandlers
   */
  constructor(googleService, supabaseHandlers) {
    this.#googleService = googleService;
    this.#supabaseHandlers = supabaseHandlers;
  }

  async signUp(req, res, next) {
    const { authCode } = req.body;

    if (!authCode) {
      res.status(400);
      return next(
        new Error('An authorization code is required to signup with Google.')
      );
    }

    try {
      const { access_token, refresh_token } =
        await this.#googleService.getTokens(authCode);

      const { exp, email } = await this.#googleService.getTokenInfo(
        access_token
      );

      const dbGoogleUser = await this.#supabaseHandlers.getGoogleUserByEmail(
        email
      );

      let message = '';
      let userId = '';

      if (!dbGoogleUser) {
        const { id } = await this.#supabaseHandlers.createGoogleUser({
          email,
          refresh_token
        });
        message = 'Account successfully created.';
        userId = id;
      }

      if (dbGoogleUser.refresh_token !== refresh_token) {
        await this.#supabaseHandlers.updateGoogleUser(dbGoogleUser.id, {
          refresh_token
        });
        message = 'Your account already exists!';
        userId = dbGoogleUser.id;
      }

      return res.status(200).send({
        message,
        googleUser: {
          email,
          id: userId,
          access_token,
          token: {
            access_token,
            expiration: exp
          }
        }
      });
    } catch (error) {
      error.message = 'Failed to signup with Google.';
      return next(error);
    }
  }
}

module.exports = { GoogleController };
