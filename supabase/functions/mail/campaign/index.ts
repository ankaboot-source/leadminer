import { sendEmail } from "../utils/email.ts";
import buildEmail from "./template.ts";

export async function notifyLeadminer(email: string, emails: string[]) {
  const to = "contact@leadminer.io"; // use env?
  const { html, subject } = buildEmail(
    email,
    emails.length,
  );

  await sendEmail(
    to,
    subject,
    html,
    // CC / reply to "email"
  );
}
