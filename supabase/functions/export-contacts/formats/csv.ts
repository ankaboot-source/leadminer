import { stringify } from "csv-stringify";
import { ExportType, ExportResult } from "../types.ts";
import type { Contact } from "../types.ts";

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "recency", header: "Recency" },
  { key: "seniority", header: "Seniority" },
  { key: "occurrence", header: "Occurrence" },
  { key: "sender", header: "Sender" },
  { key: "recipient", header: "Recipient" },
  { key: "conversations", header: "Conversations" },
  { key: "replied_conversations", header: "Replies" },
  { key: "tags", header: "Tags" },
  { key: "status", header: "Reachable" },
  { key: "given_name", header: "Given name" },
  { key: "family_name", header: "Family name" },
  { key: "alternate_name", header: "Alternate names" },
  { key: "location", header: "Location" },
  { key: "works_for", header: "Works for" },
  { key: "job_title", header: "Job title" },
  { key: "same_as", header: "Same as" },
  { key: "telephone", header: "Telephone" },
  { key: "image", header: "Avatar URL" },
] as const;

export const CsvExport = {
  type: ExportType.CSV,
  export: (
    contacts: Contact[],
    options?: { locale?: string; delimiter?: string },
  ): Promise<ExportResult> => {
    const delimiter =
      options?.delimiter ?? getLocalizedCsvSeparator(options?.locale);

    const csvData = contacts.map((contact) => ({
      name: contact.name?.trim(),
      email: contact.email,
      recency: contact.recency
        ? new Date(contact.recency).toISOString().slice(0, 10)
        : "",
      seniority: contact.seniority
        ? new Date(contact.seniority).toISOString().slice(0, 10)
        : "",
      occurrence: contact.occurrence,
      sender: contact.sender,
      recipient: contact.recipient,
      conversations: contact.conversations,
      replied_conversations: contact.replied_conversations,
      tags: Array.isArray(contact.tags)
        ? contact.tags.map((t) =>
          typeof t === "string" ? t : t.name
        ).join(",")
        : "",
      status: contact.status,
      given_name: contact.given_name,
      family_name: contact.family_name,
      alternate_name: Array.isArray(contact.alternate_name)
        ? contact.alternate_name.join(",")
        : "",
      location: contact.location,
      works_for: contact.works_for,
      job_title: contact.job_title,
      same_as: Array.isArray(contact.same_as)
        ? contact.same_as.join(",")
        : "",
      telephone: Array.isArray(contact.telephone)
        ? contact.telephone.join(",")
        : "",
      image: contact.image,
    }));

    return getCsvStr(COLUMNS, csvData, delimiter).then((content) => ({
      content,
      contentType: "text/csv",
      charset: "utf-8",
      extension: "csv",
    }));
  },
};

export default CsvExport;

function getLocalizedCsvSeparator(locale?: string): string {
  const language = locale?.substring(0, 2);
  switch (language) {
    case "fr":
    case "de":
    case "es":
    case "pt":
    case "it":
      return ";";
    default:
      return ",";
  }
}

function getCsvStr<T extends Record<string, unknown>>(
  columns: readonly { key: string; header: string }[],
  rows: T[],
  delimiter: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    stringify(
      rows,
      {
        columns: columns.map(({ key, header }) => ({ key, header })),
        bom: true,
        delimiter,
        header: true,
        quoted_string: true,
      },
      (err: Error | undefined, data: string) => {
        if (err) return reject(err);
        return resolve(data);
      },
    );
  });
}
