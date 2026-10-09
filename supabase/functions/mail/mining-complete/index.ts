import miningCompletedEmail from "../email-templates/mining-completed.ts";
import { getMiningStats, getUserEmail, getUserLanguage } from "../utils/db.ts";
import { sendEmail } from "../../_shared/mailing/email.ts";
import { createLogger } from "../../_shared/logger.ts";

const logger = createLogger("mail-mining-complete");

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
    total_with_location,
  } = await getMiningStats(miningId);

  // A run that mined nothing has no result worth reporting. Sending the
  // "no new contacts" variant burns an email on every empty pass (a resumed
  // or already-mined source always yields zero), so skip it entirely.
  // bigint columns arrive as strings via PostgREST, hence Number().
  if (Number(total_contacts_mined) === 0) {
    logger.info("Skipped mining-complete email: no new contacts", {
      miningId,
    });
    return;
  }

  const to = await getUserEmail(user_id);
  const language = await getUserLanguage(user_id);

  const { html, subject } = miningCompletedEmail(
    total_contacts_mined,
    total_reachable,
    total_with_phone,
    total_with_company,
    total_with_location,
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
