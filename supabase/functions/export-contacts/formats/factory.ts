import { ExportType } from "./strategy.ts";
import type { ExportStrategy } from "./strategy.ts";
import CsvExport from "./csv.ts";
import VCardExport from "./vcard.ts";
import GoogleContactsExport from "./google/index.ts";

class ExportFactory {
  private exporters: Map<ExportType, ExportStrategy<unknown>>;

  constructor(exporters: Map<ExportType, ExportStrategy<unknown>>) {
    this.exporters = exporters;
  }

  get<T>(type: ExportType): ExportStrategy<T> {
    const exporter = this.exporters.get(type);
    if (!exporter) {
      throw new Error(`Unsupported export type: ${type}`);
    }
    return exporter as ExportStrategy<T>;
  }
}

const factory = new ExportFactory(
  new Map<ExportType, ExportStrategy<unknown>>([
    [ExportType.CSV, new CsvExport()],
    [ExportType.VCARD, new VCardExport()],
    [ExportType.GOOGLE_CONTACTS, new GoogleContactsExport()],
  ]),
);

export default factory;
