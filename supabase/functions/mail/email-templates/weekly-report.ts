import i18nData from "../i18n/messages.json" with { type: "json" };
import { emailContainer, FRONTEND_HOST, LEADMINER_DATA_PRIVACY_URL } from "./base.ts";

export default function weeklyMiningReportEmail(
  total_contacts_mined: number,
  total_reachable: number,
  total_with_phone: number,
  total_with_company: number,
  total_with_location: number,
  language: "en" | "fr" = "en",
): { html: string; subject: string } {
  // deno-lint-ignore no-explicit-any
  const i18n = (i18nData as any)[language];
  const subject = i18n.weeklyReport.subject;

  const bodyContent = `
    <p style="font-size: 17px; margin: 0 0 15px">
      ${i18n.weeklyReport.greeting}
    </p>

    <p style="font-size: 16px; margin: 0 0 15px">
      ${i18n.weeklyReport.intro}
    </p>

    <ul style="list-style: none; padding: 0; margin: 15px 0; font-size: 15px; line-height: 1.8;">
      <li>${i18n.weeklyReport.stats.totalMined}: <strong>${total_contacts_mined}</strong></li>
      ${total_reachable > 0 ? `<li>${i18n.weeklyReport.stats.totalReachable}: <strong>${total_reachable}</strong></li>` : ""}
      ${total_with_phone > 0 ? `<li>${i18n.weeklyReport.stats.withPhone}: <strong>${total_with_phone}</strong></li>` : ""}
      ${total_with_company > 0 ? `<li>${i18n.weeklyReport.stats.withCompany}: <strong>${total_with_company}</strong></li>` : ""}
      ${total_with_location > 0 ? `<li>${i18n.weeklyReport.stats.withLocation}: <strong>${total_with_location}</strong></li>` : ""}
    </ul>

    <table role="presentation" align="center" style="margin-top: 15px;">
      <tr>
        <td align="center">
          <a
            href="${FRONTEND_HOST}/contacts"
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
            ${i18n.weeklyReport.buttons.viewContacts}
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
    headerTitle: i18n.weeklyReport.headerTitle,
    headerSubtitle: i18n.weeklyReport.headerSubtitle,
    body: bodyContent,
    footer: i18n.weeklyReport.footer,
  });

  return { html, subject };
}