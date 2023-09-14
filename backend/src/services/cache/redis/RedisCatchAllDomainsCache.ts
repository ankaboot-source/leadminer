import { Redis } from 'ioredis';
import CatchAllDomainsCache from '../CatchAllDomainsCache';

export default class RedisCatchAllDomainsCache implements CatchAllDomainsCache {
  private readonly key = 'catch-all-domains';

  constructor(private readonly redisClient: Redis) {}

  async exists(domain: string): Promise<boolean> {
    const result = await this.redisClient.sismember(this.key, domain);
    return result === 1;
  }

  async add(domain: string): Promise<void> {
    await this.redisClient.sadd(this.key, domain);
  }
}
