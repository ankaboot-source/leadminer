const LOGO_URL = Deno.env.get("LOGO_URL");
const FRONTEND_HOST = Deno.env.get("FRONTEND_HOST");

export default function buildHtmlEmail(
  total_contacts_mined: number,
  total_reachable: number,
  total_with_phone: number,
  total_with_company: number,
  source: string | null,
  mining_id: string,
): string {
  const hasNoNewContacts = source === null;

  const headerSubtitle = hasNoNewContacts
    ? "No new contacts were detected during this mining session."
    : `You successfully mined ${total_contacts_mined} emails from ${source}.`;

  const bodyContent = hasNoNewContacts
    ? `
        <p style="font-size: 17px; margin: 0 0 16px; text-align: center;">
          It looks like there were no new contacts added this time.
        </p>

        <table role="presentation" align="center" style="margin-top: 30px;">
          <tr>
            <td align="center" style="padding-right: 10px;">
              <a
                href="${FRONTEND_HOST}/contacts?enrich"
                style="
                  display: inline-block;
                  background: #ffd23f;
                  color: #111827;
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-weight: 600;
                  text-decoration: none;
                "
              >
                Enrich your contacts
              </a>
            </td>
            <td align="center">
              <a
                href="${FRONTEND_HOST}/contacts"
                style="
                  display: inline-block;
                  background: #2563eb;
                  color: #ffffff;
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-weight: 600;
                  text-decoration: none;
                "
              >
                View your contacts
              </a>
            </td>
          </tr>
        </table>
      `
    : `
        <p style="font-size: 17px; margin: 0 0 16px">
          Here's a quick recap of your mining results:
        </p>

        <ul
          style="
            list-style: none;
            padding: 0;
            margin: 24px 0;
            font-size: 15px;
            line-height: 1.8;
          "
        >
          <li>⛏️ <strong>Total contacts mined:</strong> ${total_contacts_mined}</li>
          <li>📬 <strong>Total reachable contacts:</strong> ${total_reachable}</li>
          <li>📞 <strong>With phone number:</strong> ${total_with_phone}</li>
          <li>💼 <strong>With company or profession:</strong> ${total_with_company}</li>
        </ul>

        <table role="presentation" align="center" style="margin-top: 30px;">
          <tr>
            <td align="center" style="padding-right: 10px;">
              <a
                href="${FRONTEND_HOST}/contacts?enrich"
                style="
                  display: inline-block;
                  background: #ffd23f;
                  color: #111827;
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-weight: 600;
                  text-decoration: none;
                "
              >
                Enrich your contacts
              </a>
            </td>
            <td align="center">
              <a
                href="${FRONTEND_HOST}/contacts?mining_id=${mining_id}"
                style="
                  display: inline-block;
                  background: #2563eb;
                  color: #ffffff;
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-weight: 600;
                  text-decoration: none;
                "
              >
                View your ${total_contacts_mined} contacts
              </a>
            </td>
          </tr>
        </table>
      `;

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mining Complete - Leadminer</title>
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
                  🎉 Mining Complete!
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
                  You received this email as a notification about your recent
                  activity on
                  <strong>
                    <a
                      style="color: #6b7280; text-decoration: none"
                      href="${FRONTEND_HOST}"
                    >
                      leadminer
                    </a>
                  </strong>
                  .
                </p>
                <p style="margin: 6px 0 0; color: #9ca3af">
                  Extract, clean, and enrich your contacts — effortlessly.
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
