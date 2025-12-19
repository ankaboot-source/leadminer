import CsvExport from './exports/csv';
import VCardExport from './exports/vcard';
import GoogleContactsExport from './exports/googleContacts';
import { ExportType, ExportStrategy } from './types';

class Factory {
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

const ExportFactory = new Factory(
  new Map<ExportType, ExportStrategy<any>>([
    [ExportType.CSV, new CsvExport()],
    [ExportType.VCARD, new VCardExport()],
    [ExportType.GOOGLE_CONTACTS, new GoogleContactsExport()]
  ])
);

export default ExportFactory;
