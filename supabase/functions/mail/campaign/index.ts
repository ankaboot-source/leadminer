import { sendEmail } from "../utils/email.ts";
import buildEmail from "./template.ts";

export async function notifyLeadminer(email: string, contactsCount: number) {
  const to = "contact@leadminer.io"; // use env?
  const { html, subject } = buildEmail(
    email,
    contactsCount,
  );

  await sendEmail(
    to,
    subject,
    html,
    email
  );
}
