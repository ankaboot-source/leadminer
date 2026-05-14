import { REACHABILITY } from '../../../src/utils/constants';
import {
  GoogleContactsExtractor,
  GoogleContactsFormat
} from '../../../src/services/extractors/engines/GoogleContactsExtractor';

describe('GoogleContactsExtractor', () => {
  it('returns correctly mapped contact with given_name and family_name', async () => {
    const data: GoogleContactsFormat = {
      resourceName: 'people/123',
      displayName: 'Test User',
      givenName: 'Test',
      familyName: 'User',
      emailAddresses: [{ value: 'test@example.com' }],
      phoneNumbers: [{ value: '123456789' }],
      organizations: [{ name: 'Example Corp', title: 'Engineer' }],
      urls: [{ value: 'https://example.com/test' }]
    };
    const extractor = new GoogleContactsExtractor(data, 'joe@gmail.com');
    const result = await extractor.getContacts();

    expect(result.type).toBe('google-contacts');
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].person).toEqual({
      email: 'test@example.com',
      name: 'Test User',
      givenName: 'Test',
      familyName: 'User',
      jobTitle: 'Engineer',
      sameAs: ['https://example.com/test'],
      telephone: ['123456789'],
      worksFor: 'Example Corp',
      source: 'google-contacts:joe@gmail.com',
      status: undefined,
      location: undefined,
      alternateName: undefined,
      image: undefined
    });

    expect(result.persons[0].tags).toEqual([
      {
        name: 'contact',
        reachable: REACHABILITY.DIRECT_PERSON,
        source: 'google-contacts:joe@gmail.com'
      }
    ]);
    expect(result.organizations).toEqual([]);
  });

  it('handles empty state (no resourceName)', async () => {
    const data: GoogleContactsFormat = {};
    const extractor = new GoogleContactsExtractor(data, 'joe@gmail.com');
    const result = await extractor.getContacts();

    expect(result.type).toBe('google-contacts');
    expect(result.persons).toEqual([]);
    expect(result.organizations).toEqual([]);
  });

  it('handles contact with only email', async () => {
    const data: GoogleContactsFormat = {
      resourceName: 'people/456',
      emailAddresses: [{ value: 'one@example.com' }]
    };
    const extractor = new GoogleContactsExtractor(data, 'joe@gmail.com');
    const result = await extractor.getContacts();

    expect(result.type).toBe('google-contacts');
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].person.email).toBe('one@example.com');
    expect(result.persons[0].person.name).toBe('');
    expect(result.persons[0].person.givenName).toBeUndefined();
    expect(result.persons[0].person.familyName).toBeUndefined();
    expect(result.persons[0].tags).toHaveLength(1);
    expect(result.persons[0].tags[0].name).toBe('contact');
    expect(result.persons[0].tags[0].source).toBe(
      'google-contacts:joe@gmail.com'
    );
    expect(result.organizations).toEqual([]);
  });
});
