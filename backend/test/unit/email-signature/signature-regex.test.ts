import { Logger } from 'winston';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import {
  SignatureRE,
  URL_X_REGEX,
  URL_LINKEDIN_REGEX
} from '../../../src/services/signature/regex';

describe('SignatureRE', () => {
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;
    jest.clearAllMocks();
  });

  it('should be active', () => {
    const re = new SignatureRE(mockLogger);
    expect(re.isActive()).toBe(true);
  });

  it('should extract phone numbers and social links correctly', async () => {
    const signature = `
        John Doe
        +1 (415) 555-2671
        +44 7911 123456
        +33 1 23 45 67 89
        +49 89 123 45678
        +81-3-1234-5678
        +39 333 123 4567
        https://x.com/johndoe
        https://www.linkedin.com/in/johndoe
        https://www.linkedin.com/in/john-doe
    `;

    const re = new SignatureRE(mockLogger);
    const result = await re.extract(signature);

    expect(result).toEqual({
      name: '',
      telephone: [
        '+14155552671',
        '+447911123456',
        '+33123456789',
        '+498912345678',
        '+81312345678',
        '+393331234567'
      ],
      sameAs: expect.arrayContaining([
        'https://x.com/johndoe',
        'https://www.linkedin.com/in/johndoe',
        'https://www.linkedin.com/in/john-doe'
      ]),
      image: undefined,
      jobTitle: undefined,
      worksFor: undefined,
      address: undefined
    });
  });

  it('should return empty arrays when no matches', async () => {
    const signature = 'No phone or links here';
    const re = new SignatureRE(mockLogger);
    const result = await re.extract(signature);

    expect(result?.telephone).toEqual([]);
    expect(result?.sameAs).toEqual([]);
  });

  it('should log and return null if getTelephone throws', async () => {
    jest.spyOn(SignatureRE, 'getTelephone').mockImplementation(() => {
      throw new Error('failed to parse phone number');
    });
    const re = new SignatureRE(mockLogger);
    const result = await re.extract('broken');
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SignatureExtractionLLM error:',
      expect.any(Error)
    );
  });

  it('should log and return null if getSameAs throws', async () => {
    jest.spyOn(SignatureRE, 'getSameAs').mockImplementation(() => {
      throw new Error('failed to extract social urls');
    });
    const re = new SignatureRE(mockLogger);
    const result = await re.extract('broken');
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SignatureExtractionLLM error:',
      expect.any(Error)
    );
  });

  it('should match twitter and linkedin URLs', () => {
    const twitterSamples = [
      'https://x.com/john_doe',
      'https://twitter.com/JaneDoe123'
    ];

    for (const url of twitterSamples) {
      expect([...url.matchAll(URL_X_REGEX)].length).toBeGreaterThan(0);
    }

    const linkedinSample = 'https://www.linkedin.com/in/john-doe';
    expect(
      [...linkedinSample.matchAll(URL_LINKEDIN_REGEX)].length
    ).toBeGreaterThan(0);
  });
});
