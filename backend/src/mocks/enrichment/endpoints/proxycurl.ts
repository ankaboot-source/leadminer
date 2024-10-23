import { faker } from '@faker-js/faker';
import { Request, Response, Router } from 'express';

const router = Router();

// Helper to randomly return valid or empty data
const maybe = <T>(value: T, probability = 0.7) =>
  Math.random() < probability ? value : null;

router.get(
  '/api/linkedin/profile/resolve/email',
  async (req: Request, res: Response) => {
    const { email } = req.query;
    // Validation: Ensure email is provided
    if (!email) {
      return res.status(400).json({
        code: '400',
        error: 'Email parameter is required for reverse lookup'
      });
    }

    try {
      const fakeProfile = {
        city: maybe(faker.location.city(), 0.8),
        full_name: maybe(faker.person.fullName(), 0.9),
        first_name: maybe(faker.person.firstName(), 0.85),
        last_name: maybe(faker.person.lastName(), 0.85),
        state: maybe(faker.location.state(), 0.6),
        country: maybe(faker.location.countryCode('alpha-2'), 0.7),
        country_full_name: maybe(faker.location.country(), 0.7),
        languages: maybe([faker.lorem.word(), faker.lorem.word()], 0.6),
        occupation: maybe(faker.person.jobTitle(), 0.75),
        profile_pic_url: maybe(faker.image.avatar(), 0.8),
        public_identifier: faker.string.alphanumeric(10),
        extra: {
          github_profile_id: maybe(faker.internet.userName(), 0.5),
          facebook_profile_id: maybe(faker.internet.userName(), 0.5),
          twitter_profile_id: maybe(faker.internet.userName(), 0.5),
          website: maybe(faker.internet.url(), 0.5)
        },
        experiences: Array.from({ length: 2 }).map(() => ({
          starts_at: {
            day: faker.number.int({ min: 1, max: 28 }),
            month: faker.number.int({ min: 1, max: 12 }),
            year: faker.number.int({ min: 2000, max: 2023 })
          },
          ends_at: {
            day: maybe(faker.number.int({ min: 1, max: 28 }), 0.7),
            month: maybe(faker.number.int({ min: 1, max: 12 }), 0.7),
            year: maybe(faker.number.int({ min: 2000, max: 2024 }), 0.7)
          },
          company: maybe(faker.company.name(), 0.9),
          company_linkedin_profile_url: maybe(faker.internet.url(), 0.4),
          company_facebook_profile_url: maybe(faker.internet.url(), 0.4),
          title: maybe(faker.person.jobTitle(), 0.85),
          description: maybe(faker.lorem.paragraph(), 0.6),
          location: maybe(faker.location.city(), 0.6),
          logo_url: maybe(faker.image.avatar(), 0.7)
        }))
      };

      // Respond with the fake data
      return res.status(200).json({
        email,
        profile: fakeProfile,
        last_updated: faker.date.recent().toISOString(),
        similarity_score: parseFloat(
          faker.number.float({ min: 0.5, max: 1 }).toFixed(2)
        ),
        linkedin_profile_url: maybe(faker.internet.url(), 0.7),
        facebook_profile_url: maybe(faker.internet.url(), 0.7),
        twitter_profile_url: maybe(faker.internet.url(), 0.7)
      });
    } catch (error) {
      console.error(`[ProxyCurl Mock] Error: ${(error as Error).message}`);
      return res.status(500).json({
        code: '500',
        error: 'Internal Server Error'
      });
    }
  }
);

export default router;
