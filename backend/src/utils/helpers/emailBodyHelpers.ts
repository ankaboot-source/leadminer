import isHtml from 'is-html';

/**
 * Checks if the body of the email is in HTML format.
 * @param body - The email body to check.
 * @returns true if the body contains HTML, false if it doesn't.
 */
export default function isHTMLBody(body: string): boolean {
  return isHtml(body);
}
