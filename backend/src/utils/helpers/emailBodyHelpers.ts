import isHtml from 'is-html';
import replyParser from 'node-email-reply-parser';

/**
 * Checks if the body of the email is in HTML format.
 * @param body - The email body to check.
 * @returns true if the body contains HTML, false if it doesn't.
 */
export function isHTMLBody(body: string): boolean {
  return isHtml(body);
}

export function getSignature(body: string): string | null {
  if (isHTMLBody(body)) {
    return null;
  }

  const parsedEmail = replyParser(body);
  const fragments = parsedEmail.getFragments();

  // Get all signature fragments and join them
  const signatures = fragments
    .filter((fragment) => fragment.isSignature())
    .map((fragment) => fragment.getContent().trim())
    .filter((content) => content.length > 0);

  return signatures.length > 0 ? signatures.join('\n') : null;
}
