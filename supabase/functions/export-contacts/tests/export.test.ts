Deno.env.set("APP_NAME", "Leadminer");

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test({
  name: "CSV export: should produce CSV with headers and rows",
  async fn() {
    const { default: CsvExport } = await import("../formats/csv.ts");
    const { ExportType } = await import("../types.ts");

    const contacts = [
      {
        id: "1",
        user_id: "user1",
        email: "test@example.com",
        name: "Test User",
        given_name: "Test",
        family_name: "User",
      },
    ];

    const result = await new CsvExport().export(contacts, { locale: "en" });

    assertEquals(result.contentType, "text/csv");
    assertEquals(result.extension, "csv");
    assertEquals(typeof result.content, "string");

    const content = result.content as string;
    assertEquals(content.includes("Name"), true);
    assertEquals(content.includes("Email"), true);
    assertEquals(content.includes("test@example.com"), true);
    assertEquals(content.includes("Test User"), true);
  },
});

Deno.test({
  name: "CSV export: should use semicolon delimiter for French locale",
  async fn() {
    const { default: CsvExport } = await import("../formats/csv.ts");

    const contacts = [
      {
        id: "1",
        user_id: "user1",
        email: "test@example.com",
        name: "Test User",
      },
    ];

    const result = await new CsvExport().export(contacts, { locale: "fr" });

    const content = result.content as string;
    const lines = content.split("\n");
    assertEquals(lines[0].includes(";"), true);
  },
});

Deno.test({
  name: "CSV export: should handle empty contacts array",
  async fn() {
    const { default: CsvExport } = await import("../formats/csv.ts");

    const result = await new CsvExport().export([], { locale: "en" });

    const content = result.content as string;
    const lines = content.split("\n").filter((l) => l.trim());
    assertEquals(lines.length, 1);
  },
});

Deno.test({
  name: "VCard export: should produce VCF with contact fields",
  async fn() {
    const { default: VCardExport } = await import("../formats/vcard.ts");
    const { ExportType } = await import("../types.ts");

    const contacts = [
      {
        id: "1",
        user_id: "user1",
        email: "test@example.com",
        name: "Test User",
        given_name: "Test",
        family_name: "User",
        telephone: ["+1234567890"],
        works_for: "Test Corp",
        job_title: "Engineer",
      },
    ];

    const result = await new VCardExport().export(contacts);

    assertEquals(result.contentType, "text/vcard");
    assertEquals(result.extension, "vcf");
    assertEquals(typeof result.content, "string");

    const content = result.content as string;
    assertEquals(content.startsWith("BEGIN:VCARD"), true);
    assertEquals(content.includes("END:VCARD"), true);
    assertEquals(content.includes("EMAIL:test@example.com"), true);
    assertEquals(content.includes("TEL:+1234567890"), true);
    assertEquals(content.includes("ORG:Test Corp"), true);
  },
});

Deno.test({
  name: "VCard export: should use APP_NAME as category",
  async fn() {
    const { default: VCardExport } = await import("../formats/vcard.ts");

    const contacts = [
      {
        id: "1",
        user_id: "user1",
        email: "test@example.com",
        name: "Test User",
      },
    ];

    const result = await new VCardExport().export(contacts);
    const content = result.content as string;
    assertEquals(content.includes("CATEGORIES:Leadminer"), true);
  },
});

Deno.test({
  name: "Factory: should throw for unsupported export type",
  async fn() {
    const { default: ExportFactory } = await import("../formats/factory.ts");
    const { ExportType } = await import("../types.ts");

    assertRejects(
      async () => {
        await ExportFactory.get("unknown" as unknown as ExportType);
      },
      Error,
      "Unsupported export type",
    );
  },
});

Deno.test({
  name: "Factory: should return CSV exporter for csv type",
  async fn() {
    const { default: ExportFactory } = await import("../formats/factory.ts");
    const { ExportType } = await import("../types.ts");

    const exporter = ExportFactory.get(ExportType.CSV);
    assertEquals(exporter.type, ExportType.CSV);
  },
});
