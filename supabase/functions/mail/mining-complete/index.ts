import { getMiningStats, getUserEmail, getUserLanguage } from "../utils/db.ts";
import { sendEmail } from "../utils/email.ts";
import buildEmail from "./template.ts";

export default async function mailMiningComplete(
  miningId: string,
) {
  const {
    user_id,
    source,
    total_contacts_mined,
    total_reachable,
    total_with_phone,
    total_with_company,
  } = await getMiningStats(miningId);

  const to = await getUserEmail(user_id);
  const language = await getUserLanguage(user_id);

  const { html, subject } = buildEmail(
    total_contacts_mined,
    total_reachable,
    total_with_phone,
    total_with_company,
    source,
    miningId,
    language,
  );

  await sendEmail(
    to,
    subject,
    html,
  );
}
