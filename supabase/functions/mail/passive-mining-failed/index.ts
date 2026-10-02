import passiveMiningFailureEmail from "./template.ts";
import { getUserEmail, getUserLanguage } from "../utils/db.ts";
import { sendEmail } from "../../_shared/mailing/email.ts";

type Language = "en" | "fr";

export default async function mailPassiveMiningFailure(
  userId: string,
  sourceEmail: string,
): Promise<void> {
  const to = await getUserEmail(userId);
  const requestedLanguage = await getUserLanguage(userId);
  const language: Language = requestedLanguage === "fr" ? "fr" : "en";
  const { html, subject } = passiveMiningFailureEmail(sourceEmail, language);

  await sendEmail(to, subject, html);
}
