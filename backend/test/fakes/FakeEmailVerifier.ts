import {
  EmailStatusResult,
  EmailStatusVerifier
} from '../../src/services/email-status/EmailStatusVerifier';

export default class FakeEmailStatusVerifier implements EmailStatusVerifier {
  constructor(
    private readonly emailsWithFakeStatus: Record<string, EmailStatusResult>
  ) {}

  verify(email: string): Promise<EmailStatusResult> {
    return Promise.resolve(
      this.emailsWithFakeStatus[email] ?? { email, status: 'UNKNOWN' }
    );
  }

  verifyMany(emails: string[]): Promise<EmailStatusResult[]> {
    return Promise.all(emails.map(this.verify));
  }
}
