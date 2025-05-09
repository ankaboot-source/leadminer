export interface EmailSignature {
  date: string;
  signature: string;
}

export interface EmailSignatureWithMetadata {
  userId: string;
  signature: string;
  email: string;
  firstSeenDate: string;
  lastSeenDate: string;
}

export default interface EmailSignatureCache {
  /**
   * Set or update a signature for an email address
   */
  set(
    userId: string,
    email: string,
    signature: string,
    messageDate: string
  ): Promise<void>;

  /**
   * Returns true if the messageDate is newer than the lastSeenDate in Redis
   */
  isNewer(userId: string, email: string, messageDate: string): Promise<boolean>;
}
