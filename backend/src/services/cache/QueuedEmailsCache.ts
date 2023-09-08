export default interface QueuedEmailsCache {
  add(email: string): Promise<boolean>;
  addMany(
    emails: string[]
  ): Promise<{ addedElements: string[]; rejectedElements: string[] }>;
  destroy(): Promise<void>;
  has(email: string): Promise<boolean>;
}
