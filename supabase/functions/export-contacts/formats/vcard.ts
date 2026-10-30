import { ExportType, ExportResult } from "../types.ts";
import type { Contact } from "../types.ts";

function getAppName(): string {
  return Deno.env.get("APP_NAME") || "Leadminer";
}

/**
 * Escape a vCard 3.0 (RFC 2426) text value.
 *
 * Backslash must be escaped first, otherwise the backslashes introduced by the
 * later replacements would themselves be escaped. Newlines collapse to the
 * literal two-character sequence `\n`, which is how vCard encodes a line break
 * inside a value.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

export const VCardExport = {
  type: ExportType.VCARD,
  export: (contacts: Contact[]): Promise<ExportResult> => {
    const content = contacts
      .map((contact) => contactToVCard(contact))
      .join("\n");

    return Promise.resolve({
      content,
      contentType: "text/vcard",
      charset: "utf-8",
      extension: "vcf",
    });
  },
};

export default VCardExport;

function contactToVCard(contact: Contact): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");

  lines.push(`CATEGORIES:${getAppName()}`);

  if (contact.given_name?.length || contact.family_name?.length) {
    const family = contact.family_name ?? "";
    const given = contact.given_name ?? "";
    const full = [contact.given_name, contact.family_name]
      .filter(Boolean)
      .join(" ");
    lines.push(`N:${escapeText(family)};${escapeText(given)};;;`);
    lines.push(`FN:${escapeText(full)}`);
  } else if (contact.name) {
    lines.push(`N:${escapeText(contact.name)};;;;`);
    lines.push(`FN:${escapeText(contact.name)}`);
  }

  if (contact.email) {
    lines.push(`EMAIL:${contact.email}`);
  }

  if (contact.telephone) {
    for (const phone of contact.telephone) {
      lines.push(`TEL:${phone}`);
    }
  }

  if (contact.works_for) {
    lines.push(`ORG:${escapeText(contact.works_for)}`);
  }

  if (contact.job_title) {
    lines.push(`TITLE:${escapeText(contact.job_title)}`);
  }

  if (contact.location) {
    lines.push(`ADR:;;${escapeText(contact.location)};;;;`);
  }

  if (contact.alternate_name) {
    const nicknames = Array.isArray(contact.alternate_name)
      ? contact.alternate_name.join(",")
      : contact.alternate_name;
    lines.push(`NICKNAME:${escapeText(nicknames)}`);
  }

  if (contact.same_as) {
    for (const url of Array.isArray(contact.same_as)
      ? contact.same_as
      : [contact.same_as]
    ) {
      lines.push(`URL:${url}`);
    }
  }

  if (contact.image) {
    lines.push(`PHOTO;VALUE=URI:${contact.image}`);
  }

  lines.push("END:VCARD");
  return lines.join("\n");
}
