import { jest, describe, expect, it } from '@jest/globals';
import RedisMock from 'ioredis-mock';
import { REACHABILITY } from '../../../src/utils/constants';
import {
  GoogleContactsExtractor,
  GoogleContactsFormat
} from '../../../src/services/extractors/engines/GoogleContactsExtractor';
import { BasicTag, TaggingEngine } from '../../../src/services/tagging/types';
import { DomainStatusVerificationFunction } from '../../../src/services/extractors/engines/EmailMessage';

const redis = new RedisMock();

const taggingEngine: TaggingEngine = {
  tags: [],
  getTags: jest.fn(({ email }: { email: { address: string } }) => {
    const tags: BasicTag[] = [];
    if (email.address.startsWith('invalid')) {
      tags.push({
        name: 'transactional',
        source: 'refined#email_address',
        reachable: REACHABILITY.UNSURE
      });
    } else {
      tags.push({
        name: 'professional',
        source: 'refined#email_address',
        reachable: REACHABILITY.DIRECT_PERSON
      });
    }
    return tags;
  })
};

const domainStatusVerification = jest.fn(() => [
  true,
  'custom'
]) as unknown as DomainStatusVerificationFunction;

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
    const extractor = new GoogleContactsExtractor(
      data,
      'joe@gmail.com',
      taggingEngine,
      redis,
      domainStatusVerification
    );
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
      location: '',
      alternateName: undefined,
      image: undefined
    });

    expect(result.persons[0].tags).toEqual([
      {
        name: 'professional',
        reachable: REACHABILITY.DIRECT_PERSON,
        source: 'google-contacts:joe@gmail.com'
      }
    ]);
    expect(result.organizations).toEqual([{ name: 'Example Corp' }]);
  });

  it('handles empty state (no resourceName)', async () => {
    const data: GoogleContactsFormat = {};
    const extractor = new GoogleContactsExtractor(
      data,
      'joe@gmail.com',
      taggingEngine,
      redis,
      domainStatusVerification
    );
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
    const extractor = new GoogleContactsExtractor(
      data,
      'joe@gmail.com',
      taggingEngine,
      redis,
      domainStatusVerification
    );
    const result = await extractor.getContacts();

    expect(result.type).toBe('google-contacts');
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].person.email).toBe('one@example.com');
    expect(result.persons[0].person.name).toBe('');
    expect(result.persons[0].person.givenName).toBeUndefined();
    expect(result.persons[0].person.familyName).toBeUndefined();
    expect(result.persons[0].tags).toHaveLength(1);
    expect(result.persons[0].tags[0].name).toBe('professional');
    expect(result.persons[0].tags[0].source).toBe(
      'google-contacts:joe@gmail.com'
    );
    expect(result.organizations).toEqual([]);
  });

  it('populates alternateEmail from additional email addresses', async () => {
    const data: GoogleContactsFormat = {
      resourceName: 'people/789',
      displayName: 'Multi Email',
      emailAddresses: [
        { value: 'primary@example.com' },
        { value: 'secondary@example.com' },
        { value: 'third@example.com' }
      ]
    };
    const extractor = new GoogleContactsExtractor(
      data,
      'joe@gmail.com',
      taggingEngine,
      redis,
      domainStatusVerification
    );
    const result = await extractor.getContacts();

    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].person.email).toBe('primary@example.com');
    expect(result.persons[0].person.alternateEmail).toEqual([
      'secondary@example.com',
      'third@example.com'
    ]);
  });

  it('handles contact with no email addresses', async () => {
    const data: GoogleContactsFormat = {
      resourceName: 'people/101',
      displayName: 'No Email'
    };
    const extractor = new GoogleContactsExtractor(
      data,
      'joe@gmail.com',
      taggingEngine,
      redis,
      domainStatusVerification
    );
    const result = await extractor.getContacts();

    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].person.email).toBe('');
    expect(result.persons[0].person.alternateEmail).toBeUndefined();
  });

  it('handles contact with empty arrays for optional fields', async () => {
    const data: GoogleContactsFormat = {
      resourceName: 'people/202',
      displayName: 'Empty Fields',
      emailAddresses: [],
      phoneNumbers: [],
      organizations: [],
      urls: [],
      addresses: []
    };
    const extractor = new GoogleContactsExtractor(
      data,
      'joe@gmail.com',
      taggingEngine,
      redis,
      domainStatusVerification
    );
    const result = await extractor.getContacts();

    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].person.email).toBe('');
    expect(result.persons[0].person.telephone).toEqual([]);
    expect(result.persons[0].person.sameAs).toEqual([]);
    expect(result.persons[0].person.location).toBe('');
    expect(result.persons[0].person.alternateEmail).toBeUndefined();
    expect(result.organizations).toEqual([]);
  });

  it('falls back to contact tag when domain verification fails', async () => {
    const googleContactsData: GoogleContactsFormat = {
      resourceName: 'people/123',
      displayName: 'Test User',
      emailAddresses: [{ value: 'test@example.com' }]
    };
    const mockTaggingEngine: TaggingEngine = {
      tags: [],
      getTags: jest.fn().mockReturnValue([])
    };
    const mockRedis = new RedisMock();
    const mockDomainVerification = jest
      .fn()
      .mockRejectedValue(new Error('Redis error'));
    const extractor = new GoogleContactsExtractor(
      googleContactsData,
      'user@example.com',
      mockTaggingEngine,
      mockRedis,
      mockDomainVerification as unknown as DomainStatusVerificationFunction
    );

    const result = await extractor.getContacts();
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].tags).toEqual([
      {
        name: 'contact',
        reachable: REACHABILITY.DIRECT_PERSON,
        source: 'google-contacts:user@example.com'
      }
    ]);
  });

  it('falls back to contact tag when tagging engine returns empty tags', async () => {
    const googleContactsData: GoogleContactsFormat = {
      resourceName: 'people/123',
      displayName: 'Test User',
      emailAddresses: [{ value: 'test@example.com' }]
    };
    const mockTaggingEngineEmpty: TaggingEngine = {
      tags: [],
      getTags: jest.fn().mockReturnValue([])
    };
    const mockRedis = new RedisMock();
    const mockDomainVerification = jest.fn(() => [
      true,
      'custom'
    ]) as unknown as DomainStatusVerificationFunction;
    const extractor = new GoogleContactsExtractor(
      googleContactsData,
      'user@example.com',
      mockTaggingEngineEmpty,
      mockRedis,
      mockDomainVerification
    );

    const result = await extractor.getContacts();
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].tags).toEqual([
      {
        name: 'contact',
        reachable: REACHABILITY.DIRECT_PERSON,
        source: 'google-contacts:user@example.com'
      }
    ]);
  });
});
