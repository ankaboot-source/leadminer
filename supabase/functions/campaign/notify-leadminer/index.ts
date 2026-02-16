import { sendEmail } from "../../_shared/mailing/email.ts";
import buildEmail from "./template.ts";

export async function notifyLeadminerOfCampaign(
  email: string,
  contactsCount: number,
) {
  const to = "contact@leadminer.io";
  const { html, subject } = buildEmail(
    email,
    contactsCount,
  );

  await sendEmail(
    to,
    subject,
    html,
    email,
  );
}
