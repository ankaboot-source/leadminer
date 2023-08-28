/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from './EmailStatusVerifier';

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

  async verifyMany(emails: string[]): Promise<EmailStatusResult[]> {
    const results = await Promise.all(
      emails.map((email) => this.verify(email))
    );
    return Promise.resolve(results);
  }

  private getRandomStatus(): Status {
    const randomIndex = Math.floor(Math.random() * this.statusValues.length);
    return this.statusValues[randomIndex];
  }
}
