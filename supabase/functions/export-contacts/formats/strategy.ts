import { ExportType } from "../types.ts";
import type { ExportOptions, ExportResult } from "../types.ts";

export { ExportType };
export type { ExportOptions, ExportResult };

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
