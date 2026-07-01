import { createLogger } from "../../../_shared/logger.ts";
import { ExportType, ExportResult } from "../../types.ts";
import type { ContactFrontend } from "../../types.ts";
import GoogleContactsSession from "./contacts-api.ts";

const logger = createLogger("export-contacts:google");
const APP_NAME = Deno.env.get("APP_NAME") || "Leadminer";

export const GoogleContactsExport = {
  type: ExportType.GOOGLE_CONTACTS,
  export: (
    contacts: ContactFrontend[],
    options?: {
      googleContactsOptions?: {
        userId: string;
        accessToken?: string;
        refreshToken?: string;
        updateEmptyFieldsOnly?: boolean;
      };
    },
  ): Promise<ExportResult> => {
    if (!options?.googleContactsOptions) {
      throw new Error("Missing required Google Contacts options");
    }

    const opts = options.googleContactsOptions;

    if (!opts.accessToken) {
      throw new Error("Invalid credentials.");
    }

    return runGoogleExport(contacts, opts.accessToken, opts.userId, opts.updateEmptyFieldsOnly ?? false).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Export error: ${msg}`, { error: msg });
      throw err;
    });
  },
};

export default GoogleContactsExport;

async function runGoogleExport(
  contacts: ContactFrontend[],
  accessToken: string,
  userId: string,
  updateEmptyFieldsOnly: boolean,
): Promise<ExportResult> {
  const session = new GoogleContactsSession(
    accessToken,
    APP_NAME,
    userId,
  );
  const { labelId } = await session.run(
    contacts as ContactFrontend[],
    updateEmptyFieldsOnly,
  );

  return {
    content: JSON.stringify({ labelId }),
    contentType: "application/json",
    charset: "",
    extension: "",
  };
}
