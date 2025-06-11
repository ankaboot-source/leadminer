import { Logger } from 'winston';
import { ExtractSignature, PersonLD } from './types';
import { LLMModelType, SignatureLLM } from './signature-llm';
import { SignatureRE } from './signature-regex';

export interface Config {
  useLLM: boolean;
  apiKey?: string;
  model?: LLMModelType;
}

export class Signature implements ExtractSignature {
  private readonly extractor: ExtractSignature;

  constructor(
    private readonly logger: Logger,
    { apiKey, model, useLLM }: Config
  ) {
    if (apiKey && model && useLLM) {
      this.logger.info(`Using LLM-based signature extractor (${model})`);
      this.extractor = new SignatureLLM(this.logger, model, apiKey);
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
          `signature extractor LLM failed. Using fallback.`,
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
