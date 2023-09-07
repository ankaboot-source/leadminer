import QueuedEmailsCache from '../QueuedEmailsCache';

export default class InMemoryQueuedEmailsCache implements QueuedEmailsCache {
  private readonly cache = new Set<string>();

  add(email: string): Promise<boolean> {
    if (this.cache.has(email)) {
      return Promise.resolve(false);
    }
    this.cache.add(email);
    return Promise.resolve(true);
  }

  addMany(
    emails: string[]
  ): Promise<{ addedElements: string[]; rejectedElements: string[] }> {
    const rejectedElements: string[] = [];
    const addedElements: string[] = [];

    for (const element of emails) {
      if (this.cache.has(element)) {
        rejectedElements.push(element);
      } else {
        this.cache.add(element);
        addedElements.push(element);
      }
    }

    return Promise.resolve({ rejectedElements, addedElements });
  }

  async destroy(): Promise<void> {
    this.cache.clear();
  }

  has(email: string): Promise<boolean> {
    return Promise.resolve(this.cache.has(email));
  }
}
