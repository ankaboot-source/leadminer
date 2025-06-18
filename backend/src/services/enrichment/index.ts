import ENV from '../../config';
import { Engine } from './Engine';
import Enricher from './Enricher';
import Thedig from './thedig';
import ThedigApi from './thedig/client';
import Voilanorbert from './voilanorbert';
import VoilanorbertApi from './voilanorbert/client';
import logger from '../../utils/logger';
import { TokenBucketRateLimiter } from '../rate-limiter/RateLimiter';
import EnrichLayerAPI from './enrich-layer/client';
import EnrichLayer from './enrich-layer';

let ENGINE_THEDIG: Engine | undefined;
let ENGINE_VOILANORBERT: Engine | undefined;
let ENGINE_ENRICH_LAYER: Engine | undefined;

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
        rateLimiter: new TokenBucketRateLimiter(115, 60 * 1000)
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
        rateLimiter: new TokenBucketRateLimiter(55, 60 * 1000)
      },
      logger
    ),
    logger
  );
}

if (ENV.ENRICH_LAYER_API_KEY && ENV.ENRICH_LAYER_URL) {
  ENGINE_ENRICH_LAYER = new EnrichLayer(
    new EnrichLayerAPI(
      {
        url: ENV.ENRICH_LAYER_URL,
        apiKey: ENV.ENRICH_LAYER_API_KEY,
        rateLimiter: new TokenBucketRateLimiter(295, 60 * 1000)
      },
      logger
    ),
    logger
  );
}

const EnrichmentService = new Enricher(
  [ENGINE_THEDIG, ENGINE_ENRICH_LAYER, ENGINE_VOILANORBERT].filter(
    (engine): engine is Engine => Boolean(engine)
  ),
  logger
);

export default EnrichmentService;
