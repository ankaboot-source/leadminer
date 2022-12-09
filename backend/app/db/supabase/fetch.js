const originalFetch = require('cross-fetch');
const http = require('http');
const https = require('https');

const agentOptions = {
  keepAlive: true,
  maxSockets: 40
};
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

/**
 * fetch - Uses custom http, https agents, for supabase client.
 * @returns Promise<Response>
 */
const fetch = (url, options) => {
  return originalFetch(url, {
    agent: (parsedURL) => {
      if (parsedURL.protocol === 'http:') {
        return httpAgent;
      }
      return httpsAgent;
    },
    ...options
  });
};

module.exports = {
  fetch
};