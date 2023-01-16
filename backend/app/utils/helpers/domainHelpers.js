const dns = require('dns');

/**
 * Check the MX records of a domain and adds the result to the redis sets
 * @param {Object} redisClient - The Redis client used for storing the results
 * @param {String} domain - The domain to check MX records for.
 * @return {Promise<[boolean,string,string]>} A promise that resolves to an array that contains [validity:boolean, type: string, name: string ]
 */
function checkMXStatus(redisClient, domain) {
  return new Promise((resolve) => {
    dns.resolveMx(domain, async (err, addresses) => {
      if (addresses && !err) {
        if (addresses.length > 0) {
          // set domain in redis valid domains list
          await redisClient.sadd('domainListValid', domain);
          resolve([true, 'custom', domain]);
        }
      } else {
        // set domain in redis valid domains list
        await redisClient.sadd('domainListInvalid', domain);
        resolve([false, '', domain]);
      }
    });
  });
}

/**
 * Asynchronously checks the status of a domain associated with an email address.
 * @param {Object} redisClient - A Redis client instance.
 * @param {string} domain - Domain to check it's status.
 * @returns {Promise<Array>} A promise that resolves to an array of three elements:
 * - The first element is a boolean that indicates whether the domain is valid or not.
 * - The second element is a string that indicates the type of domain: "provider", "disposable", "custom" or "".
 * - The third element is the domain string.
 */
async function checkDomainStatus(redisClient, domain) {
  /**
   * As most of domains are free providers,
   * we can reduce the execution time when check for freeproviders first.
   * The order here matters.
   */
  const providers = [
    { redisKey: 'freeProviders', type: 'provider', isValid: true },
    { redisKey: 'disposable', type: 'disposable', isValid: false },
    { redisKey: 'domainListValid', type: 'custom', isValid: true },
    { redisKey: 'domainListInvalid', type: '', isValid: false }
  ];

  for (const provider of providers) {
    const exists = await redisClient.sismember(
      provider.redisKey,
      domain
    );

    if (exists) {
      return [provider.isValid, provider.type, domain];
    }
  }

  // if not already scanned we check the MX
  const MXStatus = await checkMXStatus(redisClient, domain);
  return MXStatus;
}

module.exports = {
  checkDomainStatus,
  checkMXStatus
};
