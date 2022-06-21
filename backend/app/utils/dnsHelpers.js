const dns = require('dns');

const EX_REDIS = process.env.EX_REDIS;
/**
 * It checks if a domain has a DNS record, and if it does, it sets it in Redis for 10 days
 * @param domain - the domain to check
 * @param redis - the redis client
 * @returns a promise.
 */
async function checkDNS(domain, redis) {
  return new Promise((resolve, reject) => {
    if (domain) {
      dns.resolveMx(domain, async (error, addresses) => {
        if (addresses) {
          if (addresses.length > 0) {
            //set domain in redis
            redis.set(domain, 'ok', {
              EX: EX_REDIS,
            });
            resolve('ok');
          }
        } else {
          resolve('ko');
        }
      });
    } else {
      resolve('ko');
    }
  });
}
module.exports = {
  checkDNS,
};
