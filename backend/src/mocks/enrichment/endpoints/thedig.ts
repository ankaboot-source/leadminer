import { faker } from '@faker-js/faker';
import { Request, Response, Router } from 'express';

/**
 * TheDig mock — the edge function engine sends
 *   POST {baseUrl}/person/       -> single person
 *   POST {baseUrl}/person/bulk   -> bulk async
 * This is a minimal mock: return a person with empty optional fields
 * so the engine's `parseResult` drops the row.  This causes the
 * enrich pipeline to mark "no_data" rather than erroring.
 */
const router = Router();

router.post('/person/', (req: Request, res: Response) => {
  res.status(200).json({
    email: req.body?.email ?? '',
    name: '',
    givenName: '',
    statusCode: 203 // Non-authoritative (empty result)
  });
});

router.post('/person/bulk', (req: Request, res: Response) => {
  res.status(200).json(faker.string.nanoid());
});

export default router;
