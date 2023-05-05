import dns from 'dns/promises';
import { Redis } from 'ioredis';

/**
 * Check the MX records of a domain and adds the result to the redis sets
 * @param redisClient - The Redis client used for storing the results
 * @param domain - The domain to check MX records for.
 */
export async function checkMXStatus(
  redisClient: Redis,
  domain: string
): Promise<[boolean, 'custom' | '', string]> {
  try {
    const addresses = await dns.resolveMx(domain);
    if (addresses.length === 0) {
      redisClient.sadd('domainListInvalid', domain);
      return [false, '', domain];
    }
    redisClient.sadd('domainListValid', domain);
    return [true, 'custom', domain];
  } catch (error) {
    redisClient.sadd('domainListInvalid', domain);
    return [false, '', domain];
  }
}

/**
 * Asynchronously checks the status of a domain associated with an email address.
 * @param redisClient - A Redis client instance.
 * @param domain - Domain to check it's status.
 * @returns A promise that resolves to an array of three elements:
 * - The first element is a boolean that indicates whether the domain is valid or not.
 * - The second element is a string that indicates the type of domain: "provider", "disposable", "custom" or "".
 * - The third element is the domain string.
 */
export async function checkDomainStatus(
  redisClient: Redis,
  domain: string
): Promise<[boolean, 'provider' | 'disposable' | 'custom' | '', string]> {
  /**
   * As most of domains are free providers,
   * we can reduce the execution time when check for freeproviders first.
   * The order here matters.
   */
  const providers = [
    { redisKey: 'freeProviders', type: 'provider' as const, isValid: true },
    { redisKey: 'disposable', type: 'disposable' as const, isValid: false },
    { redisKey: 'domainListValid', type: 'custom' as const, isValid: true },
    { redisKey: 'domainListInvalid', type: '' as const, isValid: false }
  ];

  for (const provider of providers) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await redisClient.sismember(provider.redisKey, domain);

    if (exists) {
      return [provider.isValid, provider.type, domain];
    }
  }

  // if not already scanned we check the MX
  const MXStatus = await checkMXStatus(redisClient, domain);
  return MXStatus;
}
