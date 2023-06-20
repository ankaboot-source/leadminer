import dns from 'dns/promises';
import { Redis } from 'ioredis';
import { MX_RESOLVER_TIMEOUT_MS } from '../constants';
import rejectAfter from '../profiling/timeout';

/**
 * Check the MX records of a domain and adds the result to the redis sets
 * @param redisClient - The Redis client used for storing the results
 * @param domain - The domain to check MX records for.
 */
export async function checkMXStatus(
  redisClient: Redis,
  domain: string
): Promise<[boolean, 'custom' | 'invalid', string]> {
  try {
    const result = await Promise.race([
      dns.resolveMx(domain),
      rejectAfter(MX_RESOLVER_TIMEOUT_MS)
    ]);

    const hasNoMxRecords =
      result && result instanceof Array && result.length === 0;

    if (hasNoMxRecords) {
      await redisClient.sadd('domainListInvalid', domain);
      return [false, 'invalid', domain];
    }

    await redisClient.sadd('domainListValid', domain);
    return [true, 'custom', domain];
  } catch (error) {
    if (error instanceof Error && error.message === 'timeout') {
      await redisClient.sadd('domainListValid', domain);
      return [true, 'custom', domain];
    }
    await redisClient.sadd('domainListInvalid', domain);
    return [false, 'invalid', domain];
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
): Promise<
  [boolean, 'provider' | 'disposable' | 'custom' | 'invalid', string]
> {
  /**
   * As most of domains are free providers,
   * we can reduce the execution time when check for freeproviders first.
   * The order here matters.
   */
  const providers = [
    { redisKey: 'freeProviders', type: 'provider' as const, isValid: true },
    { redisKey: 'disposable', type: 'disposable' as const, isValid: false },
    { redisKey: 'domainListValid', type: 'custom' as const, isValid: true },
    { redisKey: 'domainListInvalid', type: 'invalid' as const, isValid: false }
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
