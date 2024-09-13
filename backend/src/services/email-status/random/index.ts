/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from '../EmailStatusVerifier';

export default class RandomEmailStatusVerifier implements EmailStatusVerifier {
  private readonly statusValues = Object.values(Status);

  /**
   * @param delayMs - A fake delay to simulate a real email verification process
   */
  constructor(private readonly delayMs = 500) {}

  verify(email: string): Promise<EmailStatusResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ status: this.getRandomStatus(), email });
      }, this.delayMs);
    });
  }

  verifyMany(emails: string[]): Promise<EmailStatusResult[]> {
    return Promise.resolve(
      emails.map((email) => ({ email, status: this.getRandomStatus() }))
    );
  }

  private getRandomStatus(): Status {
    const randomIndex = Math.floor(Math.random() * this.statusValues.length);
    return this.statusValues[randomIndex];
  }
}
