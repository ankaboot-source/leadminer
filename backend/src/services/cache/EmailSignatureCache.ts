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
   * Set or update a signature for an email address and associate it with a mining operation
   * @param userId - The user ID
   * @param email - The email address
   * @param signature - The email signature
   * @param messageDate - The date of the message
   * @param miningId - The ID of the mining operation this signature belongs to
   */
  set(
    userId: string,
    email: string,
    signature: string,
    messageDate: string,
    miningId: string
  ): Promise<void>;

  /**
   * Returns true if the messageDate is newer than the lastSeenDate in Redis
   */
  isNewer(userId: string, email: string, messageDate: string): Promise<boolean>;

  /**
   * Retrieves all signatures associated with a mining operation
   * @param miningId - The ID of the mining operation
   * @returns Array of signature data with metadata
   */
  getAllFromMining(miningId: string): Promise<EmailSignatureWithMetadata[]>;

  /**
   * Clears all cached signatures associated with a mining operation
   * @param miningId - The ID of the mining operation to clear
   */
  clearCachedSignature(miningId: string): Promise<void>;
}
