import { EmailSignature } from '../../workers/email-signature/handler';

export interface EmailSignatureWithMetadata extends EmailSignature {
  email: string; // The email address this signature belongs to
  firstSeenDate: string; // When we first saw this signature
  lastSeenDate: string; // Last time we saw this signature
}

export default interface EmailSignatureCache {
  /**
   * Get the most recent signature for an email address
   */
  getMostRecent(email: string): Promise<EmailSignatureWithMetadata | null>;

  /**
   * Get all historical signatures for an email address
   */
  getHistory(email: string): Promise<EmailSignatureWithMetadata[]>;

  /**
   * Set or update a signature for an email address
   */
  set(
    email: string,
    signature: EmailSignature,
    messageDate: string
  ): Promise<void>;

  /**
   * Get all signatures from a specific mining session
   */
  getAllForMining(miningId: string): Promise<EmailSignatureWithMetadata[]>;

  /**
   * Delete all signatures for an email address
   */
  delete(email: string): Promise<void>;

  /**
   * Check if a signature text already exists for an email
   * to avoid duplicate storage of the same signature
   */
  hasSignature(email: string, signatureText: string): Promise<boolean>;
}
