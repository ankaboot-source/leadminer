import { User } from "@supabase/supabase-js";
import { NextFunction, Request, Response, response } from "express";
import ENV from "../config";
import { Contacts } from "../db/interfaces/Contacts";
import { Users } from "../db/interfaces/Users";
import { Contact } from "../db/types";
import {
  exportContactsToCSV,
  getLocalizedCsvSeparator,
} from "../utils/helpers/csv";
import supabaseClient from "../utils/supabase";

async function exportToCSV(
  contactsToExport: Contact[],
  delimiterOption: string | undefined,
  localeFromHeader: string | undefined,
) {
  const csvSeparator = delimiterOption ??
    getLocalizedCsvSeparator(localeFromHeader ?? "");
  const csvData = await exportContactsToCSV(contactsToExport, csvSeparator);
  return csvData;
}
export default function initializeContactsController(
  contacts: Contacts,
  userResolver: Users,
) {
  return {
    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;
      const partialExport = req.body.partialExport ?? false;
      const {
        emails,
        exportAllContacts,
      }: { emails?: string[]; exportAllContacts: boolean } = req.body;

      if (!exportAllContacts && (!Array.isArray(emails) || !emails.length)) {
        return res.status(400).json({
          message: 'Parameter "emails" must be a non-empty list of emails',
        });
      }

      const contactsToExport = exportAllContacts ? undefined : emails;

      try {
        const newContacts = await contacts.getNonExportedContacts(
          user.id,
          contactsToExport,
        );

        const previousExportedContacts = await contacts.getExportedContacts(
          user.id,
          contactsToExport,
        );

        if (!newContacts.length && !previousExportedContacts.length) {
          return res.sendStatus(204);
        }

        if (!ENV.ENABLE_CREDIT || newContacts.length === 0) {
          const csvData = await exportToCSV(
            [
              ...previousExportedContacts,
              ...newContacts,
            ],
            req.query.delimiter ? String(req.query.delimiter) : undefined,
            req.headers["accept-language"],
          );

          return res
            .header("Content-Type", "text/csv")
            .status(200)
            .send(csvData);
        }

        const { data, error } = await supabaseClient.functions.invoke(
          "credits-manager/validate",
          {
            method: "POST",
            body: {
              partial: true,
              user_id: user.id,
              requested_units: newContacts?.length,
              registered_units: previousExportedContacts.length,
            },
          },
        );

        if (error) {
          throw new Error(error.message);
        }

        const { status_code, available } = data;
        const responseData = {
          total: newContacts.length + previousExportedContacts.length,
          available: Math.floor(available),
          availableAlready: previousExportedContacts.length,
        };

        switch (status_code) {
          case 402:
            return res.status(402).json({ ...responseData });

          case 206:
            if (partialExport) break;
            res.statusMessage = "266 Confirm Partial Content";
            return res.status(266).json({ ...responseData });
        }

        const availableContacts = newContacts.slice(0, available);
        const selectedContacts = [
          ...newContacts.slice(0, available),
          ...previousExportedContacts,
        ];
        const csvData = await exportToCSV(
          selectedContacts,
          req.query.delimiter ? String(req.query.delimiter) : undefined,
          req.headers["accept-language"],
        );

        await contacts.registerExportedContacts(
          availableContacts.map(({ email }) => email),
          user.id,
        );

        if (availableContacts.length) {
          await supabaseClient.functions.invoke(
            "credits-manager/deduct",
            {
              method: "POST",
              body: {
                user_id: user.id,
                requested_units: availableContacts.length,
              },
            },
          );
        }

        return res
          .header("Content-Type", "text/csv")
          .status(200)
          .send(csvData);
      } catch (error) {
        return next(error);
      }
    },
  };
}
