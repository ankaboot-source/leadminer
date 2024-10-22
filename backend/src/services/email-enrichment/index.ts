import ENV from "../../config";
import logger from "../../utils/logger";
import { EmailEnricher, Person } from "./EmailEnricher";
import EmailEnricherFactory, { Enricher } from "./EmailEnricherFactory";
import Voilanorbert from "./voilanorbert/client";
import VoilanorbertEmailEnricher from "./voilanorbert";

import TheDig from "./thedig/client";
import TheDigEmailEnricher from "./thedig";
import ProxyCurlEmailEnricher from "./proxy-curl";
import ProxyCurl from "./proxy-curl/client";

let ENRICH_THEDIG: EmailEnricher | null = null;
let ENRICH_VOILANORBERT: EmailEnricher | null = null;
let ENRICH_PROXY_CURL: EmailEnricher | null = null;

if (
  ENV.VOILANORBERT_API_KEY &&
  ENV.VOILANORBERT_URL &&
  ENV.VOILANORBERT_USERNAME
) {
  ENRICH_VOILANORBERT = new VoilanorbertEmailEnricher(
    new Voilanorbert(
      {
        url: ENV.VOILANORBERT_URL,
        username: ENV.VOILANORBERT_USERNAME,
        apiToken: ENV.VOILANORBERT_API_KEY,
      },
      logger,
    ),
    logger,
  );
}

if (ENV.THEDIG_API_KEY && ENV.THEDIG_URL) {
  ENRICH_THEDIG = new TheDigEmailEnricher(
    new TheDig(
      {
        url: ENV.THEDIG_URL,
        apiToken: ENV.THEDIG_API_KEY,
      },
      logger,
    ),
    logger,
  );
}

if (ENV.PROXYCURL_API_KEY && ENV.PROXYCURL_URL) {
  ENRICH_PROXY_CURL = new ProxyCurlEmailEnricher(
    new ProxyCurl(
      {
        url: ENV.PROXYCURL_URL,
        apiKey: ENV.PROXYCURL_API_KEY,
      },
      logger,
    ),
    logger,
  );
}

const ENRICHERS: Enricher[] = [
  ENRICH_VOILANORBERT && {
    type: "voilanorbert",
    default: true,
    instance: ENRICH_VOILANORBERT,
    rule: (contact: Partial<Person>) => Boolean(contact.email),
  },

  ENRICH_PROXY_CURL && {
    type: "proxycurl",
    default: false,
    instance: ENRICH_PROXY_CURL,
    rule: (contact: Partial<Person>) => Boolean(contact.email),
  },

  ENRICH_THEDIG && {
    type: "thedig",
    default: false,
    instance: ENRICH_THEDIG,
    rule: (contact: Partial<Person>) => Boolean(contact.email && contact.name),
  },
].filter((enricher): enricher is Enricher => enricher !== null);

const emailEnrichmentService = new EmailEnricherFactory(ENRICHERS, {
  LOAD_BALANCE_ENRICHERS: ENV.LOAD_BALANCE_ENRICHERS,
});

export default emailEnrichmentService;
