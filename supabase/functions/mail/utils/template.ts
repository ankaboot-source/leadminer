import i18nData from "../i18n/messages.json" with { type: "json" };

const LOGO_URL = Deno.env.get("LOGO_URL");
const FRONTEND_HOST = Deno.env.get("FRONTEND_HOST");

/**
 * Simple template interpolator: replaces {var} with provided values
 */
export function t(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(vars[key] ?? ""));
}

export function fillTemplate(
  headerTitle: string,
  bodyContent: string,
  headerSubtitle = "",
  language: "en" | "fr" = "en",
) {
  const i18n = (i18nData as any)[language];

  return `
  <!DOCTYPE html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${i18n.title}</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Lexend+Deca:wght@400;600;700&family=Merriweather:wght@700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body
    style="
      margin: 0;
      background-color: #f9fafb;
      color: #111827;
      font-family: 'Lexend Deca', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    "
  >
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 40px 0">
      <tr>
        <td align="center">
          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            role="presentation"
            style="
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            "
          >
            <!-- Logo -->
            <tr>
              <td align="center" style="padding: 20px 0">
                <a href="${FRONTEND_HOST}" target="_blank" style="display: inline-block; text-decoration: none">
                  <img
                    src="${LOGO_URL}"
                    alt="Leadminer"
                    title="Leadminer Logo"
                    border="0"
                    style="display: block; height: 3.125rem; width: auto"
                  />
                </a>
              </td>
            </tr>

            <!-- Header -->
            <tr>
              <td style="text-align: center">
                <h1
                  style="
                    margin: 0;
                    font-size: 26px;
                    font-family: 'Merriweather', serif;
                    font-weight: 700;
                  "
                >
                  ${headerTitle}
                </h1>
                <p style="margin: 10px 0 0; font-size: 16px; color: #374151">
                  ${headerSubtitle}
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 36px 32px">
                ${bodyContent}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="
                  background: #f3f4f6;
                  text-align: center;
                  padding: 28px;
                  font-size: 13px;
                  color: #6b7280;
                "
              >
                <p style="margin: 0 0 4px">
                  ${i18n.footer.line1}
                  <strong>
                    <a
                      style="color: #6b7280; text-decoration: none"
                      href="${FRONTEND_HOST}"
                    >
                      ${i18n.footer.brand}
                    </a>
                  </strong>
                  .
                </p>
                <p style="margin: 6px 0 0; color: #9ca3af">
                  ${i18n.footer.line2}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
