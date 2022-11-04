const dns = require('dns');

const { redis } = require('../redis');
const redisClientForNormalMode = redis.getClient();

/**
 * CheckMXStatus checks if a domain has a valid MX record. If it does, it adds it to a redis set called
 * "domainListValid". If it doesn't, it adds it to a redis set called "domainListInValid"
 * @param domain - The domain name to check.
 * @returns A promise that resolves to an array of three elements. The first element is a boolean that
 * indicates whether the domain is valid or not. The second element is a string that indicates the type
 * of domain, and finally the domain itself.
 */
function checkMXStatus(domain) {
  return new Promise((resolve) => {
    dns.resolveMx(domain, async (_, addresses) => {
      if (addresses) {
        if (addresses.length > 0) {
          // set domain in redis valid domains list
          await redisClientForNormalMode.sadd('domainListValid', domain);
          resolve([true, 'custom', domain]);
        }
      } else {
        // set domain in redis valid domains list
        await redisClientForNormalMode.sadd('domainListInvalid', domain);
        resolve([false, '', domain]);
      }
    });
  });
}

/**
 * Checks the domain status.
 * @param emailAddress - The email address to check its domain.
 * @returns An array of three elements.
 * The first element is a boolean that indicates whether the domain is valid or not.
 * The second element is a string that indicates the type of domain.
 * The third element is the domain itself.
 */
async function checkDomainStatus(emailAddress) {
  const domain = emailAddress.split('@')[1];

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
    const exists = await redisClientForNormalMode.sismember(
      provider.redisKey,
      domain
    );

    if (exists) {
      return [provider.isValid, provider.type, domain];
    }
  }

  // if not already scanned we check the MX
  const MXStatus = await checkMXStatus(domain);
  return MXStatus;
}

module.exports = {
  checkDomainStatus,
  checkMXStatus
};
