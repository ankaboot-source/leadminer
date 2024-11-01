import { Request, Response, Router } from 'express';
import { faker } from '@faker-js/faker';
import axios from 'axios';

const router = Router();

// Helper function to introduce optional data based on probability
function maybe<T>(value: T, probability: number): T | undefined {
  return Math.random() < probability ? value : undefined;
}

// Helper function to randomly select languages
function getRandomLanguages(): string[] {
  const languages = [
    'English',
    'Spanish',
    'French',
    'German',
    'Chinese',
    'Japanese',
    'Arabic',
    'Russian'
  ];
  return faker.helpers.arrayElements(
    languages,
    faker.number.int({ min: 1, max: 4 })
  );
}

router.post('/person/', (req: Request, res: Response) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({
      error_msg: 'Name and email are required fields'
    });
  }

  return res.json({
    email,
    name,
    givenName: maybe(name.split(' ')[0], 0.85),
    familyName: maybe(name.split(' ')[1], 0.85),
    alternateName: maybe([faker.person.fullName()], 0.9),
    image: maybe([faker.image.avatar()], 0.8),
    jobTitle: maybe([faker.person.jobTitle()], 0.75),
    worksFor: maybe([faker.company.name()], 0.9),
    homeLocation: maybe([faker.location.city()], 0.8),
    workLocation: maybe([faker.location.city()], 0.7),
    sameAs: maybe([faker.internet.url()], 0.6),
    identifier: maybe([faker.string.uuid()], 0.5),
    description: maybe([faker.lorem.sentence()], 0.7),
    knowsLanguage: maybe([getRandomLanguages], 0.6),
    nationality: maybe([faker.location.country()], 0.7),
    OptOut: false,
    url: maybe(faker.internet.url(), 0.5)
  });
});

router.post('/person/bulk', async (req: Request, res: Response) => {
  const { webhook } = req.query;
  const persons = req.body;

  if (!webhook) {
    return res.status(400).json({
      error_msg: 'Webhook URL is required for bulk enrichment'
    });
  }

  if (!Array.isArray(persons) || persons.length === 0) {
    return res.status(400).json({
      error_msg: 'A non-empty array of persons is required for bulk enrichment'
    });
  }

  res.json({
    status: 'running',
    success: true,
    token: faker.string.nanoid()
  });

  // Simulate a delay before posting results to the webhook
  await new Promise((resolve) => {
    setTimeout(resolve, 5000);
  });

  const enrichedData = persons.map((person: any) => ({
    email: person.email,
    name: person.name,
    givenName: maybe(person.name?.split(' ')[0], 0.85),
    familyName: maybe(person.name?.split(' ')[1], 0.85),
    alternateName: maybe([faker.person.fullName()], 0.9),
    image: maybe([faker.image.avatar()], 0.8),
    jobTitle: maybe([faker.person.jobTitle()], 0.75),
    worksFor: maybe([faker.company.name()], 0.9),
    homeLocation: maybe([faker.location.city()], 0.8),
    workLocation: maybe([faker.location.city()], 0.7),
    sameAs: maybe([faker.internet.url()], 0.6),
    identifier: maybe([faker.string.uuid()], 0.5),
    description: maybe([faker.lorem.sentence()], 0.7),
    knowsLanguage: maybe([getRandomLanguages()], 0.6),
    nationality: maybe([faker.location.country()], 0.7),
    OptOut: false,
    url: maybe(faker.internet.url(), 0.5)
  }));

  return axios.post(webhook as string, {
    token: faker.string.nanoid(),
    results: enrichedData
  });
  
});

export default router;
