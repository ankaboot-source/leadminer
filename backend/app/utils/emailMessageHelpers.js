const dns = require('dns');
const redisClientForNormalMode =
  require('../../redis').redisClientForNormalMode();
const config = require('config');
const NOREPLY = config.get('email_types.noreply').split(',');

/**
 * IsNoReply takes an email address as a string and returns true if the email address is classified as "no-reply email"
 * @param address - The email address to check
 * @returns A boolean value.
 */
function isNoReply(emailAddress) {
  return NOREPLY.some((word) => {
    return emailAddress.toLowerCase().includes(word.toLowerCase());
  });
}

/**
 * CheckMXStatus checks if a domain has a valid MX record. If it does, it adds it to a redis set called
 * "domainListValid". If it doesn't, it adds it to a redis set called "domainListInValid"
 * @param domain - The domain name to check.
 * @returns A promise that resolves to an array of three elements. The first element is a boolean that
 * indicates whether the domain is valid or not. The second element is a string that indicates the type
 * of domain, and finally the domain itself.
 */
function checkMXStatus(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, async (error, addresses) => {
      if (addresses) {
        if (addresses.length > 0) {
          // set domain in redis valid domains list
          await redisClientForNormalMode.sadd('domainListValid', domain);
          resolve([true, 'custom', domain]);
        }
      } else {
        // set domain in redis valid domains list
        await redisClientForNormalMode.sadd('domainListInValid', domain);
        resolve([false, '', domain]);
      }
    });
  });
}

/**
 * If the domain is in the freeProviders array, return true. If the domain is in the disposable array,
 * return false. If the domain is not in either array, return false
 * @param emailAddress - The email address to check it domain.
 * @returns A boolean value.
 */
async function checkDomainStatus(emailAddress) {
  const domain = emailAddress.split('@')[1],
    /**
     * as most of domaisn are free providers
     * we can reduce the execution time when check for freeproviders first
     */
    exist = await redisClientForNormalMode.sismember('freeProviders', domain);

  if (exist == 1) {
    return [true, 'provider', domain];
  }
  /**
   * if not in free providers we check disposable
   */
  const existDisposable = await redisClientForNormalMode.sismember(
    'disposable',
    domain
  );
  if (existDisposable == 1) {
    return [false, '', domain];
  }
  /**
   * we check for already checked domains
   */
  const existInList = await redisClientForNormalMode.sismember(
    'domainListValid',
    domain
  );
  if (existInList == 1) {
    return [true, 'custom', domain];
  }
  const existInListInValid = await redisClientForNormalMode.sismember(
    'domainListInvalid',
    domain
  );
  if (existInListInValid == 1) {
    return [false, '', domain];
  }
  /**
   * if not already scanned we check then the MX
   */
  if (existInListInValid == 0 && existInList == 0) {
    const result = await checkMXStatus(domain);
    return result;
  }
}

module.exports = {
  isNoReply,
  checkDomainStatus,
  checkMXStatus
};
