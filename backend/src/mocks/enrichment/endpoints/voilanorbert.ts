import { faker } from '@faker-js/faker';
import axios from 'axios';
import { Request, Response, Router } from 'express';
import logger from '../../../utils/logger';
import { SERVER_PORT } from '../config';

const router = Router();

router.post(
  '/2018-01-08/enrich/upload',
  async (req: Request, res: Response) => {
    const { data, webhook } = req.body;

    const emails = data.split('\n');
    const token = faker.string.nanoid();

    try {
      if (!webhook) {
        return res.status(402).json({
          code: '402',
          error:
            'Please provide a webhook to which we will post the enrich results'
        });
      }

      res.status(200).json({
        token,
        success: true,
        status: 'Processing ...',
        channel: 'channel_token'
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
      await axios.create().post(webhook, {
        token,
        id: faker.number.int({ min: 4, max: 8 }),
        results: [
          ...emails.map((email: string) =>
            email.length
              ? {
                  email,
                  fullName: faker.person.fullName(),
                  title: faker.person.jobTitle(),
                  organization: faker.company.name(),
                  location: faker.location.city(),
                  twitter: faker.image.avatar(),
                  linkedin: faker.image.avatar(),
                  facebook: faker.image.avatar(),
                  error_msg: faker.lorem.sentence()
                }
              : {
                  email: 'Email',
                  title: ' Full Name',
                  organization: ' Job Title',
                  location: ' Organization',
                  twitter: ' Location',
                  linkedin: ' Twitter',
                  facebook: ' Linkedin',
                  error_msg: ' Facebook'
                }
          )
        ],
        file_url: `http://localhost:${SERVER_PORT}/2018-01-08/enrich/${token}/download`
      });
      return res;
    } catch (err) {
      logger.error(
        'Error when enriching using voilanorbert',
        (err as Error).message
      );
      return err;
    }
  }
);

export default router;
