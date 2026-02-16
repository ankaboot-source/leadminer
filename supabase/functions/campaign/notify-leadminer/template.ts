import { fillTemplate } from "../../_shared/mailing/template.ts";

export default function buildEmail(
  email: string,
  total_contacts: number,
): { html: string; subject: string } {
  const subject = "Send an Email Campaign";
  const bodyContent =
    `The user ${email} wants to send an email campaign to ${total_contacts} contacts`;
  const headerTitle = subject;

  const html = fillTemplate(headerTitle, bodyContent);

  return { html, subject };
}
