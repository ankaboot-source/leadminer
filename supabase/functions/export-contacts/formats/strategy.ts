export { ExportType, type ExportOptions, type ExportResult } from "../types.ts";
import {
  type Contact,
  type ContactFrontend,
} from "../types.ts";

export interface ExportStrategy<T> {
  readonly type: ExportType;
  export(data: T[], options?: ExportOptions): Promise<ExportResult>;
}

export abstract class BaseExportStrategy<T> implements ExportStrategy<T> {
  abstract readonly type: ExportType;
  abstract export(
    data: T[],
    options?: ExportOptions,
  ): Promise<ExportResult>;
}
