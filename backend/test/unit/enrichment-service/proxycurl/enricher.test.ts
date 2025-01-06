import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Logger } from 'winston';
import ProxycurlApi, {
  ProfileExtra,
  ReverseEmailLookupResponse
} from '../../../../src/services/enrichment/proxy-curl/client';
import { Person } from '../../../../src/db/types';
import Proxycurl from '../../../../src/services/enrichment/proxy-curl';

describe('Proxycurl', () => {
  let mockClient: jest.Mocked<ProxycurlApi>;
  let mockLogger: jest.Mocked<Logger>;
  let enricher: Proxycurl;

  beforeEach(() => {
    mockClient = {
      reverseEmailLookup: jest.fn()
    } as Partial<jest.Mocked<ProxycurlApi>> as jest.Mocked<ProxycurlApi>;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    enricher = new Proxycurl(mockClient, mockLogger);
  });

  describe('getProfileUrls', () => {
    it('should return correct URLs based on ProfileExtra properties', () => {
      const profile: ProfileExtra = {
        github_profile_id: 'user123',
        facebook_profile_id: 'user.fb',
        twitter_profile_id: 'user_twitter',
        website: 'https://example.com'
      };

      const urls = Proxycurl.getProfileUrls(profile);

      expect(urls).toEqual([
        'https://github.com/user123',
        'https://facebook.com/user.fb',
        'https://twitter.com/user_twitter',
        'https://example.com'
      ]);
    });

    it('should return an empty array if no ProfileExtra properties are provided', () => {
      const profile: ProfileExtra = {};
      const urls = Proxycurl.getProfileUrls(profile);

      expect(urls).toEqual([]);
    });
  });

  describe('parseResult', () => {
    const enrichResultMock: ReverseEmailLookupResponse[] = [
      {
        email: 'valid@example.com',
        profile: {
          full_name: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          occupation: 'Software Engineer',
          profile_pic_url: 'https://example.com/pic.jpg',
          public_identifier: 'john.doe',
          extra: {
            website: 'https://johndoe.com'
          },
          // Required fields for the Profile type
          city: 'New York',
          state: 'NY',
          country: 'US',
          country_full_name: 'United States',
          languages: ['English'],
          experiences: [
            {
              starts_at: { day: 1, month: 1, year: 2020 },
              ends_at: { day: 1, month: 1, year: 2022 },
              company: 'Tech Inc.',
              title: 'Developer',
              description: 'Worked on various projects'
            }
          ]
        },
        last_updated: '2024-11-01',
        similarity_score: 0.9,
        linkedin_profile_url: 'https://linkedin.com/in/johndoe',
        facebook_profile_url: 'https://facebook.com/johndoe',
        twitter_profile_url: 'https://twitter.com/johndoe'
      },
      {
        email: 'partial@example.com',
        profile: {
          full_name: 'Partial User',
          first_name: '',
          last_name: 'User',
          occupation: 'Software Engineer',
          profile_pic_url: 'https://example.com/partialuser.jpg',
          public_identifier: 'partial.user',
          extra: {
            website: 'https://partialuser.com'
          },
          // Required fields for the Profile type
          city: '',
          state: '',
          country: '',
          country_full_name: '',
          languages: [],
          experiences: []
        },
        last_updated: '2024-11-02',
        similarity_score: 0.7,
        linkedin_profile_url: 'https://linkedin.com/in/partialuser',
        facebook_profile_url: 'https://facebook.com/partialuser',
        twitter_profile_url: 'https://twitter.com/partialuser'
      },
      {
        email: 'partial2@example.com',
        profile: {
          full_name: 'Partial2 User',
          first_name: 'Partial2',
          last_name: 'User',
          occupation: '',
          profile_pic_url: '',
          public_identifier: 'partial2.user',
          extra: {},
          // Required fields for the Profile type
          city: 'city',
          state: 'state',
          country: 'country',
          country_full_name: '',
          languages: [],
          experiences: []
        },
        last_updated: '2024-11-03',
        similarity_score: 0.5,
        linkedin_profile_url: 'https://linkedin.com/in/partial2user',
        facebook_profile_url: '',
        twitter_profile_url: ''
      },
      {
        email: 'invalid@example.com',
        profile: {
          full_name: '',
          first_name: '',
          last_name: '',
          occupation: '',
          profile_pic_url: '',
          public_identifier: '',
          extra: {},
          // Required fields for the Profile type
          city: '',
          state: '',
          country: '',
          country_full_name: '',
          languages: [],
          experiences: []
        },
        last_updated: '2024-11-03',
        similarity_score: 0.5,
        linkedin_profile_url: '',
        facebook_profile_url: '',
        twitter_profile_url: ''
      }
    ];
    it('should map full ReverseEmailLookupResponse data correctly', () => {
      const result = enricher.parseResult([enrichResultMock[0]]);

      expect(result).toEqual({
        engine: 'proxycurl',
        data: [
          {
            email: 'valid@example.com',
            name: 'John Doe',
            givenName: 'John',
            familyName: 'Doe',
            jobTitle: 'Software Engineer',
            organization: 'Tech Inc.',
            image: 'https://example.com/pic.jpg',
            identifiers: ['john.doe'],
            location: ['New York, NY, United States'],
            sameAs: [
              'https://linkedin.com/in/johndoe',
              'https://facebook.com/johndoe',
              'https://twitter.com/johndoe',
              'https://johndoe.com'
            ]
          }
        ],
        raw_data: [enrichResultMock[0]]
      });
    });

    it('should map partial ReverseEmailLookupResponse data correctly', () => {
      let result = enricher.parseResult([enrichResultMock[1]]);

      expect(result).toEqual({
        engine: 'proxycurl',
        data: [
          {
            email: 'partial@example.com',
            name: 'Partial User',
            familyName: 'User',
            jobTitle: 'Software Engineer',
            identifiers: ['partial.user'],
            sameAs: [
              'https://linkedin.com/in/partialuser',
              'https://facebook.com/partialuser',
              'https://twitter.com/partialuser',
              'https://partialuser.com'
            ],
            image: 'https://example.com/partialuser.jpg',
            location: undefined,
            givenName: undefined,
            organization: undefined,
            githubProfile: undefined,
            alternateName: undefined
          }
        ],
        raw_data: [enrichResultMock[1]]
      });

      result = enricher.parseResult([enrichResultMock[2]]);

      expect(result).toEqual({
        engine: 'proxycurl',
        data: [
          {
            email: 'partial2@example.com',
            name: 'Partial2 User',
            givenName: 'Partial2',
            familyName: 'User',
            identifiers: ['partial2.user'],
            sameAs: ['https://linkedin.com/in/partial2user'],
            location: ['city, state'],
            image: undefined,
            jobTitle: undefined,
            organization: undefined,
            alternateName: undefined
          }
        ],
        raw_data: [enrichResultMock[2]]
      });
    });

    it('should map invalid/empty ReverseEmailLookupResponse data correctly', () => {
      const result = enricher.parseResult([enrichResultMock[3]]);

      expect(result).toEqual({
        engine: 'proxycurl',
        data: [],
        raw_data: [enrichResultMock[3]]
      });
    });
  });

  describe('enrichSync', () => {
    it('should call reverseEmailLookup and map the response correctly', async () => {
      const person: Partial<Person> = { email: 'test@example.com' };
      const mockResponse: ReverseEmailLookupResponse = {
        email: 'test@example.com',
        profile: {
          city: 'New York',
          full_name: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          state: 'NY',
          country: 'US',
          country_full_name: 'United States',
          languages: ['English'],
          occupation: 'Software Engineer',
          profile_pic_url: 'https://example.com/pic.jpg',
          public_identifier: 'john.doe',
          extra: {
            github_profile_id: 'johndoe',
            website: 'https://johndoe.com'
          },
          experiences: [
            {
              starts_at: { day: 1, month: 1, year: 2020 },
              ends_at: { day: 1, month: 1, year: 2022 },
              company: 'Tech Inc.',
              title: 'Developer',
              description: 'Worked on various projects'
            }
          ]
        },
        last_updated: '2024-11-01',
        similarity_score: 0.9,
        linkedin_profile_url: 'https://linkedin.com/in/johndoe',
        facebook_profile_url: 'https://facebook.com/johndoe',
        twitter_profile_url: 'https://twitter.com/johndoe'
      };

      mockClient.reverseEmailLookup.mockResolvedValue(mockResponse);

      const result = await enricher.enrichSync(person);

      expect(mockClient.reverseEmailLookup).toHaveBeenCalledWith({
        email: 'test@example.com',
        lookup_depth: 'superficial',
        enrich_profile: 'enrich'
      });
      expect(result).toEqual({
        engine: 'proxycurl',
        data: [
          {
            email: 'test@example.com',
            name: 'John Doe',
            givenName: 'John',
            familyName: 'Doe',
            jobTitle: 'Software Engineer',
            organization: 'Tech Inc.',
            image: 'https://example.com/pic.jpg',
            identifiers: ['john.doe'],
            location: ['New York, NY, United States'],
            sameAs: [
              'https://linkedin.com/in/johndoe',
              'https://facebook.com/johndoe',
              'https://twitter.com/johndoe',
              'https://github.com/johndoe',
              'https://johndoe.com'
            ]
          }
        ],
        raw_data: [mockResponse]
      });
    });

    it('should throw an error if reverseEmailLookup fails', async () => {
      const person: Partial<Person> = { email: 'test@example.com' };
      const error = new Error('Network error');
      mockClient.reverseEmailLookup.mockRejectedValue(error);

      await expect(enricher.enrichSync(person)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('enrichAsync', () => {
    it('should throw a "not implemented" error', async () => {
      try {
        await enricher.enrichAsync(
          [{ email: 'test@example.com' }],
          'webhook-url'
        );
      } catch (error) {
        expect(error instanceof Error).toBeTruthy();
        expect((error as Error).message).toEqual('Method not implemented.');
      }
    });
  });
});
