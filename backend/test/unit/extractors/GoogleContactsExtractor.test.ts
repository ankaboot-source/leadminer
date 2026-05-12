import { ContactFrontend } from '../../../src/db/types';
import { REACHABILITY } from '../../../src/utils/constants';
import {
  GoogleContactsExtractor,
  GoogleContactsFormat
} from '../../../src/services/extractors/engines/GoogleContactsExtractor';

describe('GoogleContactsExtractor', () => {
  it('returns correctly mapped contacts for a single contact', async () => {
    const data: GoogleContactsFormat = {
      source: 'google-contacts:joe@gmail.com',
      contacts: [
        {
          person: {
            id: '1',
            user_id: 'user1',
            email: 'test@example.com',
            name: 'Test User',
            given_name: 'Test',
            family_name: 'User',
            job_title: 'Engineer',
            same_as: ['https://example.com/test'],
            alternate_name: ['Tester'],
            alternate_email: ['alternate@example.com'],
            works_for: 'Example Corp',
            telephone: ['123456789'],
            image: 'http://example.com/image.png'
          } as ContactFrontend,
          tags: ['contact']
        }
      ]
    };
    const extractor = new GoogleContactsExtractor(data);
    const result = await extractor.getContacts();

    expect(result.type).toBe('google-contacts');

    if (result.type !== 'google-contacts') {
      throw new Error('Wrong type');
    }

    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].person).toEqual({
      email: 'test@example.com',
      name: 'Test User',
      givenName: 'Test',
      familyName: 'User',
      jobTitle: 'Engineer',
      sameAs: ['https://example.com/test'],
      alternateName: ['Tester'],
      alternateEmail: ['alternate@example.com'],
      worksFor: 'Example Corp',
      telephone: ['123456789'],
      image: 'http://example.com/image.png',
      source: 'google-contacts:joe@gmail.com',
      status: undefined,
      location: undefined
    });

    expect(result.persons[0].tags).toEqual([
      {
        name: 'contact',
        reachable: REACHABILITY.UNSURE,
        source: 'google-contacts:joe@gmail.com'
      }
    ]);
    expect(result.organizations).toEqual([]);
  });

  it('handles empty state (no contacts)', async () => {
    const data: GoogleContactsFormat = {
      source: 'google-contacts:empty@gmail.com',
      contacts: []
    };
    const extractor = new GoogleContactsExtractor(data);
    const result = await extractor.getContacts();

    expect(result.type).toBe('google-contacts');

    if (result.type !== 'google-contacts') {
      throw new Error('Wrong type');
    }

    expect(result.persons).toEqual([]);
    expect(result.organizations).toEqual([]);
  });

  it('handles multiple contacts correctly', async () => {
    const data: GoogleContactsFormat = {
      source: 'google-contacts:multiple@gmail.com',
      contacts: [
        {
          person: {
            id: '1',
            user_id: 'user1',
            email: 'one@example.com',
            name: 'User One'
          } as ContactFrontend,
          tags: ['contact']
        },
        {
          person: {
            id: '2',
            user_id: 'user1',
            email: 'two@example.com',
            name: 'User Two'
          } as ContactFrontend,
          tags: ['contact', 'vip']
        }
      ]
    };
    const extractor = new GoogleContactsExtractor(data);
    const result = await extractor.getContacts();

    expect(result.type).toBe('google-contacts');

    if (result.type !== 'google-contacts') {
      throw new Error('Wrong type');
    }

    expect(result.persons).toHaveLength(2);
    expect(result.persons[0].person.email).toBe('one@example.com');
    expect(result.persons[0].person.name).toBe('User One');
    expect(result.persons[0].tags).toHaveLength(1);
    expect(result.persons[0].tags[0].name).toBe('contact');

    expect(result.persons[1].person.email).toBe('two@example.com');
    expect(result.persons[1].person.name).toBe('User Two');
    expect(result.persons[1].tags).toHaveLength(2);
    expect(result.persons[1].tags[0].name).toBe('contact');
    expect(result.persons[1].tags[1].name).toBe('vip');

    expect(result.organizations).toEqual([]);
  });
});
