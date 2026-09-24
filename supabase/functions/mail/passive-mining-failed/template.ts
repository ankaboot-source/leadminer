import i18nData from "../i18n/messages.json" with { type: "json" };
import { emailContainer, FRONTEND_HOST } from "../email-templates/base.ts";

type Language = "en" | "fr";
type PassiveMiningFailureCopy = {
  subject: string;
  title: string;
  greeting: string;
  intro: string;
  description: string;
  button: string;
};
type I18nData = Record<
  Language,
  {
    passiveMiningFailure: PassiveMiningFailureCopy;
    footer: {
      line1: string;
      brand: string;
      line2: string;
    };
  }
>;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export default function passiveMiningFailureEmail(
  sourceEmail: string,
  language: Language = "en",
): { html: string; subject: string } {
  const localized = (i18nData as I18nData)[language];
  const copy = localized.passiveMiningFailure;
  const escapedSourceEmail = escapeHtml(sourceEmail);
  const reconnectUrl = `${
    (FRONTEND_HOST ?? "").replace(/\/$/, "")
  }/sources?reconnect=${encodeURIComponent(sourceEmail)}`;
  const intro = copy.intro.replace("{sourceEmail}", escapedSourceEmail);
  const body = `
    <p>${copy.greeting}</p>
    <p>${intro}</p>
    <p>${copy.description}</p>
    <p style="text-align: center; margin-top: 28px;">
      <a
        href="${reconnectUrl}"
        target="_blank"
        rel="noopener"
        style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;"
      >
        ${copy.button}
      </a>
    </p>
  `;

  return {
    subject: copy.subject,
    html: emailContainer({
      language,
      subject: copy.subject,
      headerTitle: copy.title,
      headerSubtitle: "",
      body,
      footer: localized.footer,
    }),
  };
}
