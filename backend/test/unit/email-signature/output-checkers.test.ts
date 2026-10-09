import { describe, it, expect, jest } from '@jest/globals';
import { removeFalsePositives } from '../../../src/services/signature/llm/output-checkers';
import { PersonLD } from '../../../src/services/signature/types';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
} as unknown as jest.Mocked<import('winston').Logger>;

describe('removeFalsePositives', () => {
  it('should return null when every field is undefined', () => {
    // Regression guard. `cleanOutput` sets every field, and an absent one is
    // `undefined` rather than missing, so counting keys returned an object of
    // undefined values instead of "no signature". Once the model can answer
    // null for every field, this is the path a declined signature takes.
    const empty: PersonLD = {
      name: undefined,
      jobTitle: undefined,
      worksFor: undefined,
      address: undefined,
      telephone: undefined,
      sameAs: undefined
    };

    expect(
      removeFalsePositives(empty, 'Sent from Mail for Windows 10', logger)
    ).toBeNull();
  });

  it('should return null when every field is null', () => {
    const allNull = {
      name: null,
      jobTitle: null,
      worksFor: null,
      address: null,
      telephone: null,
      sameAs: null
    } as unknown as PersonLD;

    expect(
      removeFalsePositives(allNull, 'unsubscribe footer', logger)
    ).toBeNull();
  });

  it('should keep a field that survives the verbatim check', () => {
    const result = removeFalsePositives(
      { name: 'Gary Waxman' },
      'Gary Waxman\nEnron Broadband Services',
      logger
    );

    expect(result).toEqual({ name: 'Gary Waxman' });
  });

  it('should drop a field absent from the signature but keep the rest', () => {
    const result = removeFalsePositives(
      { name: 'Gary Waxman', worksFor: 'Microsoft' },
      'Gary Waxman\nEnron Broadband Services',
      logger
    );

    expect(result).toEqual({ name: 'Gary Waxman' });
  });

  it('should return null when the only field is hallucinated', () => {
    expect(
      removeFalsePositives({ worksFor: 'Microsoft' }, 'Gary Waxman', logger)
    ).toBeNull();
  });
});
