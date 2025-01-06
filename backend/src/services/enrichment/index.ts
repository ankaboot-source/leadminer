import ENV from '../../config';
import { Engine } from './Engine';
import Enricher from './Enricher';
import Proxycurl from './proxy-curl';
import ProxycurlApi from './proxy-curl/client';
import Thedig from './thedig';
import ThedigApi from './thedig/client';
import Voilanorbert from './voilanorbert';
import VoilanorbertApi from './voilanorbert/client';
import logger from '../../utils/logger';

let ENGINE_THEDIG: Engine | undefined;
let ENGINE_VOILANORBERT: Engine | undefined;
let ENGINE_PROXY_CURL: Engine | undefined;

if (
  ENV.VOILANORBERT_API_KEY &&
  ENV.VOILANORBERT_URL &&
  ENV.VOILANORBERT_USERNAME
) {
  ENGINE_VOILANORBERT = new Voilanorbert(
    new VoilanorbertApi(
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
  ENGINE_THEDIG = new Thedig(
    new ThedigApi(
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
  ENGINE_PROXY_CURL = new Proxycurl(
    new ProxycurlApi(
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

const EnrichmentService = new Enricher(
  [ENGINE_THEDIG, ENGINE_PROXY_CURL, ENGINE_VOILANORBERT].filter(
    (engine): engine is Engine => Boolean(engine)
  ),
  logger
);

export default EnrichmentService;
