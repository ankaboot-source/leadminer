import ENV from '../../config';
import logger from '../../utils/logger';
import { EmailEnricher, Person } from './EmailEnricher';
import EnricherEngine, { Engine } from './EmailEnricherFactory';
import Voilanorbert from './voilanorbert/client';
import VoilanorbertEmailEnricher from './voilanorbert';

import TheDig from './thedig/client';
import TheDigEmailEnricher from './thedig';
import ProxyCurlEmailEnricher from './proxy-curl';
import ProxyCurl from './proxy-curl/client';
import { Contact } from '../../db/types';

let ENRICH_THEDIG: EmailEnricher | undefined = undefined;
let ENRICH_VOILANORBERT: EmailEnricher | undefined = undefined;
let ENRICH_PROXY_CURL: EmailEnricher | undefined = undefined;

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
        rateLimiter: {
          requests: 115,
          interval: 60 * 1000, // 1 minute
          spaced: false
        }
      },
      logger
    ),
    logger
  );
}

if (ENV.THEDIG_API_KEY && ENV.THEDIG_URL) {
  ENRICH_THEDIG = new TheDigEmailEnricher(
    new TheDig(
      {
        url: ENV.THEDIG_URL,
        apiToken: ENV.THEDIG_API_KEY,
        rateLimiter: {
          requests: 55,
          interval: 60 * 1000, // 1 minute
          spaced: false
        }
      },
      logger
    ),
    logger
  );
}

if (ENV.PROXYCURL_API_KEY && ENV.PROXYCURL_URL) {
  ENRICH_PROXY_CURL = new ProxyCurlEmailEnricher(
    new ProxyCurl(
      {
        url: ENV.PROXYCURL_URL,
        apiKey: ENV.PROXYCURL_API_KEY,
        rateLimiter: {
          requests: 295,
          interval: 60 * 1000, // 1 minute
          spaced: false,
          maxRetries: 5
        }
      },
      logger
    ),
    logger
  );
}

const emailEnrichmentService = new EnricherEngine(
  [
    ENRICH_THEDIG && {
      name: 'thedig',
      instance: ENRICH_THEDIG,
      isValid: (contact: Partial<Contact>) => Boolean(contact.name && contact.email),
      isSync: () => true,
      isAsync: () => false
    },
    ENRICH_PROXY_CURL && {
      name: 'proxycurl',
      instance: ENRICH_PROXY_CURL,
      isValid: (_: Partial<Contact>) => true,
      isSync: () => true,
      isAsync: () => false
    },
    ENRICH_VOILANORBERT && {
      name: 'voilanorbert',
      instance: ENRICH_VOILANORBERT,
      isValid: (_: Partial<Contact>) => true,
      isSync: () => false,
      isAsync: () => true
    }
  ].filter((engine): engine is Engine => Boolean(engine)),
  logger
);

export default emailEnrichmentService;
