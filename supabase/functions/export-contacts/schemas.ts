import { z } from "zod";

export const exportParamsSchema = z.object({
  type: z.enum(["csv", "vcard", "google_contacts"]),
});

export const exportBodySchema = z
  .object({
    ids: z.array(z.string().uuid()).optional(),
    exportAllContacts: z.boolean().optional(),
    miningSourceId: z.string().uuid().optional(),
    updateEmptyFieldsOnly: z.boolean().optional(),
    options: z
      .object({
        delimiter: z.string().optional(),
        locale: z.string().optional(),
        googleContactsOptions: z
          .object({
            userId: z.string(),
            accessToken: z.string().optional(),
            refreshToken: z.string().optional(),
            updateEmptyFieldsOnly: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .refine((data) => data.exportAllContacts || (data.ids && data.ids.length > 0), {
    message: 'Either "ids" must be a non-empty list or "exportAllContacts" must be true',
  });