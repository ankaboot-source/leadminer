import { createLogger } from "../../../_shared/logger.ts";
import { createSupabaseAdmin } from "../../../_shared/supabase.ts";
import { ExportStrategy, ExportType, ExportResult } from "../../types.ts";
import type { ContactFrontend } from "../../types.ts";
import GoogleContactsSession from "./contacts-api.ts";

const logger = createLogger("export-contacts:google");
const APP_NAME = Deno.env.get("APP_NAME") || "Leadminer";

export default class GoogleContactsExport
  implements ExportStrategy<ContactFrontend>
{
  readonly type = ExportType.GOOGLE_CONTACTS;

  async export(
    contacts: ContactFrontend[],
    options?: {
      googleContactsOptions?: {
        userId: string;
        accessToken?: string;
        refreshToken?: string;
        updateEmptyFieldsOnly?: boolean;
      };
    },
  ): Promise<ExportResult> {
    if (!options?.googleContactsOptions) {
      throw new Error("Missing required Google Contacts options");
    }

    const opts = options.googleContactsOptions;

    if (!opts.accessToken) {
      throw new Error("Invalid credentials.");
    }

    try {
      const session = new GoogleContactsSession(
        opts.accessToken,
        APP_NAME,
        opts.userId,
      );
      const { labelId } = await session.run(
        contacts as ContactFrontend[],
        opts.updateEmptyFieldsOnly ?? false,
      );

      return {
        content: JSON.stringify({ labelId }),
        contentType: "application/json",
        charset: "",
        extension: "",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Export error: ${msg}`, { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }
}
