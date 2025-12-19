import CsvExport from './exports/csv';
import VCardExport from './exports/vcard';
import GoogleContactsExport from './exports/googleContacts';
import { ExportType, ExportStrategy } from './types';

export default class ExportFactory {
  private static exporters = new Map<ExportType, ExportStrategy<any>>([
    [ExportType.CSV, new CsvExport()],
    [ExportType.VCARD, new VCardExport()],
    [ExportType.GOOGLE_CONTACTS, new GoogleContactsExport()]
  ]);

  static get<T>(type: ExportType): ExportStrategy<T> {
    const exporter = this.exporters.get(type);

    if (!exporter) {
      throw new Error(`Unsupported export type: ${type}`);
    }

    return exporter;
  }
}
