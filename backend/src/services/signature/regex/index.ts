import { Logger } from 'winston';
import { findPhoneNumbersInText } from 'libphonenumber-js';
import { ExtractSignature, PersonLD } from '../types';

export const URL_X_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(\w{1,15})\b/g;
export const URL_LINKEDIN_REGEX =
  /(?:https?:\/\/)?(?:[a-z]{2,3}\.)? {2}linkedin\.com\/in\/[a-zA-Z0-9\-_%]{3,100}(?:\/)?/;

export class SignatureRE implements ExtractSignature {
  LLM_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private readonly logger: Logger) {}

  private static getTelephone(signature: string): string[] {
    const telephone = findPhoneNumbersInText(signature);
    return telephone.map((phone) => phone.number.number);
  }

  private static getSameAs(signature: string): string[] {
    const matches = new Set<string>();

    for (const match of signature.matchAll(URL_LINKEDIN_REGEX)) {
      matches.add(`https://www.${match[1]}`);
    }

    for (const match of signature.matchAll(URL_X_REGEX)) {
      matches.add(`https://x.com/${match[1]}`);
    }

    return [...matches];
  }

  public async extract(signature: string): Promise<PersonLD | null> {
    try {
      return {
        name: '',
        telephone: SignatureRE.getTelephone(signature),
        sameAs: SignatureRE.getSameAs(signature),
        image: undefined,
        jobTitle: undefined,
        worksFor: undefined,
        address: undefined
      };
    } catch (err) {
      this.logger.error('SignatureExtractionLLM error:', err);
      return null;
    }
  }
}
