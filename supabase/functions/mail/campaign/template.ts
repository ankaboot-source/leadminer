export default function buildEmail(
  email: string,
  total_contacts: number,
): { html: string; subject: string } {
  const subject = "Send an Email Campaign";
  const html = `
	The user ${email} wants to send an email campaign to ${total_contacts} contacts`;

  return { html, subject };
}
