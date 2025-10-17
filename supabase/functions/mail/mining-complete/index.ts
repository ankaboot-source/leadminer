import { getMiningStats, getUserEmail } from "../utils/db.ts";
import { sendEmail } from "../utils/email.ts";
import buildHtmlEmail from "./template.ts";

export default async function mailMiningComplete(
  userId: string,
  miningId: string,
) {
  const to = await getUserEmail(userId);
  const {
    total_contacts_mined,
    total_reachable,
    total_with_phone,
    total_with_company,
  } = await getMiningStats(userId, miningId);

  const html = buildHtmlEmail(
    total_contacts_mined,
    total_reachable,
    total_with_phone,
    total_with_company,
    miningId,
  );

  const subject = "Mining Compelete";

  await sendEmail(
    to,
    subject,
    html,
  );
}
