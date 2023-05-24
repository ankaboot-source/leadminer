/* istanbul ignore file */
import { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID, GOOGLE_SECRET } from '../config';
import { OAuthUsers } from '../db/OAuthUsers';

export default function initializeGoogleController(oAuthUsers: OAuthUsers) {
  return {
    signUpWithGoogle: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      const { authCode } = req.body;

      if (!authCode) {
        res.status(400);
        return next(
          new Error('An authorization code is required to signup with Google.')
        );
      }

      const oAuth2Client = new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_SECRET,
        'postmessage'
      );

      try {
        const { tokens } = await oAuth2Client.getToken(authCode);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { access_token, refresh_token } = tokens;

        if (!access_token || !refresh_token) {
          throw new Error('Failed retrieving tokens');
        }

        oAuth2Client.setCredentials({
          access_token
        });

        const { email } = await oAuth2Client.getTokenInfo(access_token);

        if (!email) {
          throw new Error('Failed retrieving user email');
        }

        const dbGoogleUser =
          (await oAuthUsers.getByEmail(email as string)) ??
          (await oAuthUsers.create({ email, refreshToken: refresh_token }));

        if (!dbGoogleUser) {
          throw Error('Failed to create or query googleUser');
        }

        if (refresh_token && dbGoogleUser.refresh_token !== refresh_token) {
          await oAuthUsers.updateRefreshToken(dbGoogleUser.id, refresh_token);
        }

        return res.status(200).send({
          googleUser: {
            email: dbGoogleUser.email,
            id: dbGoogleUser.id,
            access_token,
            token: {
              access_token
            }
          }
        });
      } catch (error: any) {
        return next({
          message: 'Error when sign up with google',
          details: error.message
        });
      }
    }
  };
}
