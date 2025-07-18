import { Logger } from 'winston';
import { ExtractSignature, PersonLD } from './types';
import { LLMModelType, SignatureLLM } from './llm';
import { SignatureRE } from './regex';
import { IRateLimiter } from '../rate-limiter/RateLimiter';

export interface Config {
  useLLM: boolean;
  apiKey?: string;
  model?: LLMModelType;
}

export class Signature implements ExtractSignature {
  private readonly extractor: ExtractSignature;

  constructor(
    private readonly rateLimiter: IRateLimiter,
    private readonly logger: Logger,
    { apiKey, model, useLLM }: Config
  ) {
    if (apiKey && model && useLLM) {
      this.logger.info(`Using LLM-based signature extractor (${model})`);
      this.extractor = new SignatureLLM(
        this.rateLimiter,
        this.logger,
        model,
        apiKey
      );
    } else {
      this.logger.info('Using regex-based signature extractor');
      this.extractor = new SignatureRE(this.logger);
    }
  }

  async extract(signature: string): Promise<PersonLD | null> {
    try {
      return await this.extractor.extract(signature);
    } catch (err) {
      if (this.extractor instanceof SignatureLLM) {
        this.logger.warn(
          'signature extractor LLM failed. Using fallback.',
          err
        );
        return await new SignatureRE(this.logger).extract(signature);
      }
      this.logger.error(
        `${this.extractor.constructor.name} extractor failed`,
        err
      );
      return null;
    }
  }
}
