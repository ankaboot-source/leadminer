import { ExportType, ExportResult } from "../types.ts";
import type { Contact } from "../types.ts";

function getAppName(): string {
  return Deno.env.get("APP_NAME") || "Leadminer";
}

export default class VCardExport {
  static readonly type = ExportType.VCARD;

  static export(contacts: Contact[]): Promise<ExportResult> {
    const content = contacts
      .map((contact) => contactToVCard(contact))
      .join("\n");

    return Promise.resolve({
      content,
      contentType: "text/vcard",
      charset: "utf-8",
      extension: "vcf",
    });
  }
}

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
    lines.push(`N:${family};${given};;;`);
    lines.push(`FN:${full}`);
  } else if (contact.name) {
    lines.push(`N:${contact.name};;;;`);
    lines.push(`FN:${contact.name}`);
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
    lines.push(`ORG:${contact.works_for}`);
  }

  if (contact.job_title) {
    lines.push(`TITLE:${contact.job_title}`);
  }

  if (contact.location) {
    lines.push(`ADR:;;${contact.location};;;;`);
  }

  if (contact.alternate_name) {
    const nicknames = Array.isArray(contact.alternate_name)
      ? contact.alternate_name.join(",")
      : contact.alternate_name;
    lines.push(`NICKNAME:${nicknames}`);
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
