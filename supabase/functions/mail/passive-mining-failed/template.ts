import i18nData from "../i18n/messages.json" with { type: "json" };

type Language = "en" | "fr";
type PassiveMiningFailureCopy = {
  subject: string;
  title: string;
  greeting: string;
  intro: string;
  description: string;
  button: string;
  footer: string;
};
type I18nData = Record<
  Language,
  { passiveMiningFailure: PassiveMiningFailureCopy }
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
  const copy = (i18nData as I18nData)[language].passiveMiningFailure;
  const escapedSourceEmail = escapeHtml(sourceEmail);
  const frontendHost = (Deno.env.get("FRONTEND_HOST") ?? "").replace(/\/$/, "");
  const reconnectUrl = `${frontendHost}/sources?reconnect=${
    encodeURIComponent(sourceEmail)
  }`;
  const intro = copy.intro.replace("{sourceEmail}", escapedSourceEmail);
  const html = `<!DOCTYPE html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${copy.subject}</title>
  </head>
  <body style="margin:0;background:#f9fafb;color:#111827;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:8px;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 20px;font-size:24px;">${copy.title}</h1>
                <p>${copy.greeting}</p>
                <p>${intro}</p>
                <p>${copy.description}</p>
                <p style="text-align:center;margin-top:28px;">
                  <a href="${reconnectUrl}" target="_blank" rel="noopener" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${copy.button}</a>
                </p>
                <p style="margin-top:28px;font-size:13px;color:#6b7280;">${copy.footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, subject: copy.subject };
}
