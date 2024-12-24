import { NextFunction, Request, Response } from "express";
import ENV from "../config";
import { Users } from "../db/interfaces/Users";
import { Contact } from "../db/types";
import emailEnrichmentService from "../services/email-enrichment";
import Billing from "../utils/billing-plugin";
import supabaseClient from "../utils/supabase";
import logger from "../utils/logger";
import Enrichment from "../db/supabase/enrichement";
import Engagement from "../db/supabase/engagement";
import EnrichEngine, {
  EnricherType,
} from "../services/email-enrichment/EmailEnricherFactory";
import {
  getContactsToEnrich,
} from "./enrichment.helpers";
import SupabaseTasks from "../db/supabase/tasks";
import {
  EnricherResponse,
  EnricherResult,
} from "../services/email-enrichment/EmailEnricher";
import Enrichments from "../db/supabase/enrichement";

async function checkAndFilterEligibleContacts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { user } = res.locals;
  const { enrichAllContacts, updateEmptyFieldsOnly } = req.body;
  const contacts = [
    ...(req.body.contacts ? req.body.contacts : [req.body.contact]),
  ].filter(Boolean);

  const isMissingParam = !enrichAllContacts && !Array.isArray(contacts);

  if (isMissingParam) {
    return res.status(400).json({
      message: "Missing parameter contact or contacts",
    });
  }

  try {
    let contactsToEnrich = await getContactsToEnrich(
      user.id,
      enrichAllContacts ?? false,
      contacts,
    );

    if (Billing) {
      const { hasDeficientCredits, hasInsufficientCredits, availableUnits } =
        await Billing.validateCustomerCredits(user.id, contactsToEnrich.length);

      if (hasDeficientCredits || hasInsufficientCredits) {
        const response = {
          total: contactsToEnrich.length,
          available: Math.floor(availableUnits),
        };
        return res.status(402).json(response);
      }

      contactsToEnrich = contactsToEnrich.slice(0, availableUnits);
    }

    const enrichment: {
      contact?: Partial<Contact>;
      contacts?: Partial<Contact>[];
      updateEmptyFieldsOnly: boolean;
    } = {
      updateEmptyFieldsOnly,
    };

    if (enrichAllContacts || req.body.contacts) {
      enrichment.contacts = contactsToEnrich;
    } else if (req.body.contact) {
      const [contact] = contactsToEnrich;
      enrichment.contact = contact;
    }
    res.locals.enrichment = enrichment;
    return next();
  } catch (error) {
    return next(error);
  }
}

interface EnrichmentCacheResult {
  task_id: string;
  user_id: string;
  created_at: string;
  engine: EnricherType;
  result: EnricherResult;
}

async function searchEnrichmentCache(
  contacts: Partial<Contact>[],
): Promise<EnrichmentCacheResult[]> {
  const emails = contacts.map((contact) => contact.email);

  const { data, error } = await supabaseClient
    .schema("private")
    .rpc("enriched_most_recent", {
      emails,
    });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function enrichFromCache(
  enrichmentsDB: Enrichments,
  engagementsDB: Engagement,
  enricher: EnrichEngine,
  userId: string,
  contacts: Partial<Contact>[],
) {
  const cached = (await searchEnrichmentCache(contacts))
    .flatMap((cache) => enricher.parseResult([cache.result], cache.engine))
    .filter((cache): cache is EnricherResponse => Boolean(cache?.data.length))
    .map((cache) => ({ engine: "cache", ...cache }));

  const enrichedEmails = new Set(
    cached.flatMap(({ data }) => data).map(({ email }) => email),
  );

  await enrichmentsDB.enrich(cached);
  await engagementsDB.register(userId, Array.from(enrichedEmails.values()), "ENRICH");

  logger.debug("Contacts enriched from cache.", Array.from(enrichedEmails.values()));

  return contacts.filter(
    (contact) => contact.email && !enrichedEmails.has(contact.email),
  );
}

async function enrichContactSync(_: Request, res: Response) {
  const {
    user,
    enrichment: { contact, updateEmptyFieldsOnly },
  } = res.locals;

  const tasks = new SupabaseTasks(supabaseClient, logger);
  const enrichment = new Enrichment(tasks, supabaseClient, logger);
  const engagement = new Engagement(supabaseClient, logger);
  const enricher = emailEnrichmentService;

  try {
    await enrichment.create(user.id, 1, updateEmptyFieldsOnly);

    const [contactToEnrich] = await enrichFromCache(
      enrichment,
      engagement,
      enricher,
      user.id,
      [
        contact,
      ],
    );

    const result = contactToEnrich?.email
      ? await enricher.enrichSync(contact)
      : null;

    if (result) {
      await enrichment.enrich([result]);
      await engagement.register(user.id, [contactToEnrich.email!], "ENRICH");
      await Billing?.deductCustomerCredits(user.id, 1);
    }

    await enrichment.end();
    return res.status(200).json({ task: enrichment.redactedTask() });
  } catch (err) {
    await enrichment.cancel();
    throw err;
  }
}

async function enrichPersonBulk(_: Request, res: Response) {
  const {
    user,
    enrichment: { contacts, updateEmptyFieldsOnly },
  } = res.locals;

  const tasks = new SupabaseTasks(supabaseClient, logger);
  const enrichment = new Enrichment(tasks, supabaseClient, logger);
  const engagement = new Engagement(supabaseClient, logger);
  const enricher = emailEnrichmentService;

  const task = await enrichment.create(
    user.id,
    contacts.length,
    updateEmptyFieldsOnly,
  );

  try {
    const contactsToEnrich = await enrichFromCache(
      enrichment,
      engagement,
      enricher,
      user.id,
      contacts,
    );

    if (!contactsToEnrich.length) {
      await enrichment.end();
      return res.status(204).json({
        id: "cache",
        status: "done",
        details: {
          total_enriched: contacts.length,
          total_to_enrich: contacts.length,
        },
      });
    }

    const enriched = new Set<string>();

    for await (const result of enricher.enrich(contactsToEnrich)) {
      console.log("im here ", result);
      if (result) {
        await enrichment.enrich([result]);
        enriched.add(result.data[0].email);
      }
    }

    const emails = Array.from(enriched.values());
    const notEnriched = contactsToEnrich.filter((c) => c.email ? !enriched.has(c.email) : false);

    await engagement.register(user.id, emails, "ENRICH");
    await Billing?.deductCustomerCredits(user.id, emails.length);

    if (!notEnriched.length) {
      await enrichment.end();
      return res.status(200).json({ task: enrichment.redactedTask() });
    }

    const webhook = `${ENV.LEADMINER_API_HOST}/api/enrich/webhook/${task.id}`;
    const result = await enricher.enrichAsync(notEnriched, webhook);

    if (result) {
      await enrichment.enrich([result]);
    }

    return res.status(200).json({ task: enrichment.redactedTask() });
  } catch (err) {
    await enrichment.cancel();
    throw err;
  }
}

async function enrichPersonWebhook(req: Request, res: Response) {
  const { id: taskId } = req.params;
  const { token } = req.body;

  const tasks = new SupabaseTasks(supabaseClient, logger);
  const enrichment = new Enrichment(tasks, supabaseClient, logger);
  const engagements = new Engagement(supabaseClient, logger);
  const enricher = emailEnrichmentService;

  const task = await enrichment.createFromId(taskId);

  try {
    if (!task.id) {
      return res.status(404).send({
        message: `Enrichment with id ${taskId} not found.`,
      });
    }

    const enrichRequest = task.details.result.find(
      (enr) => enr.token === token,
    );

    if (!enrichRequest) {
      throw new Error(`No enricher found for token: ${token}`);
    }

    const result = enricher.parseResult(req.body, enrichRequest.engine);
    await enrichment.enrich([
      {
        token,
        engine: enrichRequest.engine,
        ...result,
      },
    ]);

    if (result.data.length) {
      const data = result.data.filter((contact) => Boolean(contact));
      await engagements.register(
        task.userId,
        data.map(({ email }) => email),
        "ENRICH",
      );
      await Billing?.deductCustomerCredits(task.userId, data.length);
    }

    await enrichment.end();

    return res.status(200);
  } catch (err) {
    await enrichment.cancel();
    throw err;
  }
}

export default function initializeEnrichmentController(userResolver: Users) {
  return {
    enrichPerson: async (req: Request, res: Response, next: NextFunction) => {
      try {
        await enrichContactSync(req, res);
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith("Enricher not found.")
        ) {
          res.statusCode = 503;
        }
        next(err);
      }
    },
    enrichPersonBulk: async (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await enrichPersonBulk(req, res);
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith("Enricher not found.")
        ) {
          res.statusCode = 503;
        }
        next(err);
      }
    },
    enrichWebhook: async (req: Request, res: Response, next: NextFunction) => {
      try {
        await enrichPersonWebhook(req, res);
      } catch (err) {
        next(err);
      }
    },
    preEnrichmentMiddleware: (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => checkAndFilterEligibleContacts(req, res, next),
  };
}
