import { Router } from 'express';
import { oauthCallbackHandler, oauthHandler } from '../controllers/oauth.controller';

const router = Router();

router.get('/oauth/authorize', oauthHandler);
router.get('/oauth/callback', oauthCallbackHandler);

export default router;