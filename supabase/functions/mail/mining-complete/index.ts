import { getMiningStats, getUserEmail } from "../utils/db.ts";
import { sendEmail } from "../utils/email.ts";
import buildHtmlEmail from "./template.ts";

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
  const subject = "Mining Compelete";
  const html = buildHtmlEmail(
    total_contacts_mined,
    total_reachable,
    total_with_phone,
    total_with_company,
    source,
    miningId,
  );

  await sendEmail(
    to,
    subject,
    html,
  );
}
