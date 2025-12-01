import { describe, it, expect } from '@jest/globals';
import { CleanQuotedForwardedReplies } from '../../../src/utils/helpers/emailParsers';

describe('CleanQuotedForwardedReplies: Parsing email replies', () => {
  it('should correctly truncate a French header starting with "Le sam. 4 mai... a écrit :"', () => {
    const email =
      'Yes, confirmed\r\nLe sam. 4 mai 2020 à 17:47, Leo TechSupport <reply@project-alpha.com> a\r\nécrit :';
    expect(CleanQuotedForwardedReplies(email)).toBe('Yes, confirmed');
  });

  it('should correctly truncate the French "De : ... Envoyé :" forward block', () => {
    const email =
      'Please see below.\n\nDe : Alex Mason <alex.m@corp.net>\nEnvoyé : dimanche 7 janvier 2020 20:44\nObjet : URGENT ACTION REQUIRED';
    expect(CleanQuotedForwardedReplies(email)).toBe('Please see below.');
  });

  it('should truncate a reply header starting after a line break', () => {
    const email =
      "Thanks so much, Leo\r\nI'll be there, and good luck\r\nLe sam. 4 mai 2020 à 17:47, Leo TechSupport <reply@project-alpha.com> a\r\nécrit :";
    expect(CleanQuotedForwardedReplies(email)).toBe(
      "Thanks so much, Leo\r\nI'll be there, and good luck"
    );
  });

  it('should truncate the standard English "On [Date] wrote:" header (Gmail style)', () => {
    const email =
      'Just confirming.\n\nBest,\nTess\n\nOn Mon, Nov 30, 2020 at 11:30 AM J. Smith <jsmith@corp.com> wrote:\n> Sure thing.';
    expect(CleanQuotedForwardedReplies(email)).toBe(
      'Just confirming.\n\nBest,\nTess'
    );
  });

  it('should truncate the Gmail "---------- Forwarded message --------" separator', () => {
    const email =
      'See the previous thread.\n\n---------- Forwarded message --------\nFrom: Chris <chris@domain.io>';
    expect(CleanQuotedForwardedReplies(email)).toBe('See the previous thread.');
  });

  it('should truncate the legacy "-----Original Message-----" separator', () => {
    const email =
      'Here is the summary.\n\nJ. Smith\n\n-----Original Message-----\nFrom: IT Support Team';
    expect(CleanQuotedForwardedReplies(email)).toBe(
      'Here is the summary.\n\nJ. Smith'
    );
  });

  it('should truncate at the first single ">" quote line', () => {
    const email =
      'My thoughts are above.\n\n> This is the entire quoted body.\n> It should be removed.';
    expect(CleanQuotedForwardedReplies(email)).toBe('My thoughts are above.');
  });

  it('should handle nested quotes (double >>) by truncating at the first quote (>)', () => {
    const email =
      'New response here.\n\n> Quoted line 1\n>> Nested quote line 2';
    expect(CleanQuotedForwardedReplies(email)).toBe('New response here.');
  });

  it('should handle quote markers with leading whitespace', () => {
    const email = 'Text.\n  > Quoted line.';
    expect(CleanQuotedForwardedReplies(email)).toBe('Text.');
  });

  it('should return an empty string if a reply marker is the first thing found', () => {
    const email =
      'On Tue, Dec 2, 2020 at 10:00 AM J. Smith <jsmith@corp.com> wrote:';
    expect(CleanQuotedForwardedReplies(email)).toBe('');
  });

  it('should return the original text if only the standard signature delimiter "--" is present', () => {
    const email = 'Thank you,\n\n--\nJ. Smith\nCTO';
    expect(CleanQuotedForwardedReplies(email)).toBe(email);
  });

  it('should not truncate a standard plain-text signature block (no reply markers present)', () => {
    const normalSignature =
      'Hi,\n\nPlease review.\n\n-- \nKind regards,\nDana White\nSenior Analyst\n(555) 555-1234';
    expect(CleanQuotedForwardedReplies(normalSignature)).toBe(normalSignature);
  });

  it('should not truncate content that looks like a date/time but is not an official reply header', () => {
    const misleadingContent =
      'Our meeting is set for 11:30 AM, Mon, Nov 30, 2020. Please RSVP.';
    expect(CleanQuotedForwardedReplies(misleadingContent)).toBe(
      misleadingContent
    );
  });

  it('should truncate complex French header where sender email wraps lines', () => {
    const email = `Hello

    test test test test test test test test test 
    test test test test test test test test test 
    test test test test test test test test test 

    test

    test test test 
    address:45 Park Ave, 10001 New York
    http://some-project-site.org/
    https://www.facebook.com/companypage


    Le dim. 21 sept. 2020 à 12:40, Sam from Project Alpha <
    reply@project-alpha.com> a écrit :

    > Test  👋🏽
    >
    > test test test test test test test test test test  ce lundi 22/09
    > test test test test test  (environ 80 personnes) le lieu prévu
    > initialement (test ) n’est test test test test test test.
    >
    > test test test test test test  ? test test test 
    > test 
    >
    > Bien cordialement
    >
    > Sam
    > + 33 6 55 55 11 11
    >
    >
    > Sam
    > + 33 6 55 55 11 11
    `;

    const expectedContent = `Hello

    test test test test test test test test test 
    test test test test test test test test test 
    test test test test test test test test test 

    test

    test test test 
    address:45 Park Ave, 10001 New York
    http://some-project-site.org/
    https://www.facebook.com/companypage`;

    expect(CleanQuotedForwardedReplies(email)).toBe(expectedContent);
  });
});
