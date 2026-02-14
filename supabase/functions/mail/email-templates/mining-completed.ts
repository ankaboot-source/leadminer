import i18nData from "../i18n/messages.json" with { type: "json" };
import { emailContainer, FRONTEND_HOST, LEADMINER_DATA_PRIVACY_URL, t } from "./base.ts";

export default function miningCompletedEmail(
  total_contacts_mined: number,
  total_reachable: number,
  total_with_phone: number,
  total_with_company: number,
  total_with_location: number,
  source: string | null,
  mining_id: string,
  language: "en" | "fr" = "en",
): { html: string; subject: string } {
  const hasNoNewContacts = source === null;
  // deno-lint-ignore no-explicit-any
  const i18n = (i18nData as any)[language];

  const subject = i18n.subject;

  const headerSubtitle = hasNoNewContacts
    ? i18n.noNewContactsSubtitle
    : t(i18n.hasNewContactsSubtitle, {
        total_contacts_mined,
        source,
      });

  const bodyContent = hasNoNewContacts
    ? `
      <p style="font-size: 17px; margin: 0 0 15px; text-align: center;">
        ${i18n.noNewContactsBody}
      </p>

      <table role="presentation" align="center" style="margin-top: 15px;">
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
              ${i18n.buttons.enrich}
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
              ${i18n.buttons.viewContacts}
            </a>
          </td>
        </tr>
      </table>
    `
    : `
      <p style="font-size: 17px; margin: 0 0 15px">
        ${i18n.recapIntro}
      </p>

      <ul style="list-style: none; padding: 0; margin: 15px 0; font-size: 15px; line-height: 1.8;">
        <li>${i18n.stats.totalMined}: <strong>${total_contacts_mined}</strong></li>
        ${total_reachable > 0 ? `<li>${i18n.stats.totalReachable}: <strong>${total_reachable}</strong></li>` : ""}
        ${total_with_phone > 0 ? `<li>${i18n.stats.withPhone}: <strong>${total_with_phone}</strong></li>` : ""}
        ${total_with_company > 0 ? `<li>${i18n.stats.withCompany}: <strong>${total_with_company}</strong></li>` : ""}
        ${total_with_location > 0 ? `<li>${i18n.stats.withLocation}: <strong>${total_with_location}</strong></li>` : ""}
      </ul>

      <table role="presentation" align="center" style="margin-top: 15px;">
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
              ${i18n.buttons.enrich}
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
              ${t(i18n.buttons.viewContactsCount, { total_contacts_mined })}
            </a>
          </td>
        </tr>
      </table>

      <div style="margin-top: 15px; font-size: 13px; color: #6b7280; text-align: center;">
        <div>${i18n.start_mining_toast.summary}</div>
        <div>${i18n.start_mining_toast.detail_1}</div>
        <a href="${LEADMINER_DATA_PRIVACY_URL}" style="color: #6b7280;">
          ${i18n.start_mining_toast.detail_2}
        </a>
      </div>
    `;

  const html = emailContainer({
    language,
    subject,
    headerTitle: i18n.headerTitle,
    headerSubtitle,
    body: bodyContent,
    footer: i18n.footer,
  });

  return { html, subject };
}
