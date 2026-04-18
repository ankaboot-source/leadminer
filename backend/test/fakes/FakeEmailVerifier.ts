import {
  EmailStatusResult,
  EmailStatusVerifier
} from '../../src/services/email-status/EmailStatusVerifier';

export default class FakeEmailStatusVerifier implements EmailStatusVerifier {
  emailsQuota = 1000;

  constructor(
    private readonly emailsWithFakeStatus: Record<string, EmailStatusResult>
  ) {}

  verify(email: string): Promise<EmailStatusResult> {
    return Promise.resolve(
      this.emailsWithFakeStatus[email] ?? { email, status: 'UNKNOWN' }
    );
  }

  verifyMany(emails: string[]): Promise<EmailStatusResult[]> {
    return Promise.all(emails.map((e) => this.verify(e)));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  isEligibleEmail(_email: string): boolean {
    return true;
  }
}
