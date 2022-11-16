const { OAuth2Client } = require('google-auth-library');

class GoogleService {
  #oAuth2Client;

  /**
   *
   * @param {OAuth2Client} oAuth2Client
   */
  constructor(oAuth2Client) {
    this.#oAuth2Client = oAuth2Client;
  }

  /**
   * Fetches tokens from Google.
   * @param {String} authCode
   * @returns {Promise<{access_token: string, refresh_token: string}>} tokens
   */
  async getTokens(authCode) {
    try {
      const { tokens } = await this.#oAuth2Client.getToken(authCode);
      return tokens;
    } catch (error) {
      throw new Error('Failed to fetch tokens from Google.');
    }
  }

  /**
   * Fetches token info from Google.
   * @param {String} accessToken
   * @returns {Promise<{exp: string, email: string}>} tokenInfo
   */
  async getTokenInfo(accessToken) {
    try {
      this.#oAuth2Client.setCredentials({ accessToken });
      const tokenInfo = await this.#oAuth2Client.getTokenInfo(accessToken);
      return tokenInfo;
    } catch (error) {
      throw new Error('Failed to fetch token info from Google.');
    }
  }

  async refreshAccessToken(refreshToken) {
    this.#oAuth2Client.setCredentials({
      refresh_token: refreshToken
    });

    try {
      const { token } = await this.#oAuth2Client.getAccessToken();
      const tokenInfo = await this.#oAuth2Client.getTokenInfo(token);
      const access_token = {
        access_token: token,
        expiration: Math.floor(tokenInfo.expiry_date / 1000)
      };
      return access_token;
    } catch (error) {
      throw new Error('Failed to refresh access token.');
    }
  }
}

module.exports = {
  GoogleService
};
