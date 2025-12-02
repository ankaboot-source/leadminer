import { Logger } from 'winston';
import { findPhoneNumbersInText } from 'libphonenumber-js';
import { ExtractSignature, PersonLD } from '../types';

export const URL_X_REGEX =
  /(?:https?:)?\/\/(?:[A-Za-z]+\.)?(twitter|x)\.com\/@?(?!home|share|privacy|tos)(?<handle>[A-Za-z0-9_]+)\/?/g;
export const URL_LINKEDIN_REGEX =
  /(?:https?:)?\/\/(?:[\w]+\.)?linkedin\.com\/in\/(?<handle>[\w\-_À-ÿ%]+)\/?/g;

export class SignatureRE implements ExtractSignature {
  private readonly active = true;

  constructor(private readonly logger: Logger) {}

  isActive(): boolean {
    return this.active;
  }

  static getTelephone(signature: string): string[] {
    const telephone = findPhoneNumbersInText(signature);
    return telephone.map((phone) => phone.number.number);
  }

  static getSameAs(signature: string): string[] {
    const matches = new Set<string>();
    for (const match of signature.matchAll(URL_LINKEDIN_REGEX)) {
      const [linkedinUrl] = match;
      if (linkedinUrl) matches.add(linkedinUrl.trim());
    }

    for (const match of signature.matchAll(URL_X_REGEX)) {
      const [xUrl] = match;
      if (xUrl) matches.add(xUrl.trim());
    }

    return [...matches];
  }

  public async extract(
    _email: string,
    signature: string
  ): Promise<PersonLD | null> {
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
