import { Router } from 'express';
import {
  oauthCallbackHandler,
  GetOauthProviders,
  oauthHandler
} from '../controllers/oauth.controller';

const router = Router();

router.get('/authorize', oauthHandler);
router.get('/callback', oauthCallbackHandler);
router.get('/providers', GetOauthProviders);
export default router;
