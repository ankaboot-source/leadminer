import { Router } from 'express';
import initializeGoogleController from '../controllers/google.controller';
import initializeImapController from '../controllers/imap.controller';
import { ImapUsers } from '../db/ImapUsers';
import { OAuthUsers } from '../db/OAuthUsers';

export default function initializeImapRoutes(
  imapUsers: ImapUsers,
  oAuthUsers: OAuthUsers
) {
  const router = Router();

  const { signUpWithGoogle } = initializeGoogleController(oAuthUsers);
  const { getImapBoxes, loginToAccount } = initializeImapController(
    oAuthUsers,
    imapUsers
  );

  router.post('/signUpGoogle', signUpWithGoogle);
  router.post('/login', loginToAccount);
  router.get('/:id/boxes', getImapBoxes);

  return router;
}
