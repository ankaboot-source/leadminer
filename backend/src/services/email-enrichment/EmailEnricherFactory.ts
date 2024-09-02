import { Logger } from 'winston';
import { EmailEnricher, EnricherType } from './EmailEnricher';
import Voilanorbert from './voilanorbert/client';
import { VoilanorbertEmailEnricher } from './voilanorbert';

interface Config extends VoilanorbertConfig {
  LOAD_BALANCE_ENRICHERS?: boolean;
}

interface VoilanorbertConfig {
  VOILANORBERT_URL?: string;
  VOILANORBERT_USERNAME?: string;
  VOILANORBERT_API_KEY?: string;
}

export default class EmailEnricherFactory {
  private currentEnricherIndex = 0;

  private enrichers: Map<EnricherType, EmailEnricher> = new Map();

  private voilanorbertEmailEnricher?: EmailEnricher;

  constructor(private readonly config: Config, logger: Logger) {
    if (
      config.VOILANORBERT_URL &&
      config.VOILANORBERT_API_KEY &&
      config.VOILANORBERT_USERNAME
    ) {
      this.createVoilanorbertEmailEnricher(
        {
          VOILANORBERT_URL: config.VOILANORBERT_URL,
          VOILANORBERT_API_KEY: config.VOILANORBERT_API_KEY,
          VOILANORBERT_USERNAME: config.VOILANORBERT_USERNAME
        },
        logger
      );
    }

    if (this.voilanorbertEmailEnricher) {
      this.enrichers.set('voilanorbert', this.voilanorbertEmailEnricher);
    }

    if (!Array.from(this.enrichers.values()).length) {
      throw new Error('Cannot initiate class with empty enrichers.');
    }
  }

  private getNextVerifier(): EmailEnricher {
    const enrichers = Array.from(this.enrichers.values());
    const verifier = enrichers[this.currentEnricherIndex];
    this.currentEnricherIndex =
      (this.currentEnricherIndex + 1) % enrichers.length;
    return verifier;
  }

  getEmailEnricher(enricherType?: EnricherType): EmailEnricher {
    if (enricherType) {
      const enricher = this.enrichers.get(enricherType) as EmailEnricher;

      if (!enricher) {
        throw new Error(
          `Enricher with type <${enricherType}> enricher not found.`
        );
      }

      return enricher;
    }

    return this.config.LOAD_BALANCE_ENRICHERS
      ? this.getNextVerifier()
      : Array.from(this.enrichers.values())[0];
  }

  private createVoilanorbertEmailEnricher(
    {
      VOILANORBERT_URL,
      VOILANORBERT_API_KEY,
      VOILANORBERT_USERNAME
    }: {
      VOILANORBERT_URL: string;
      VOILANORBERT_API_KEY: string;
      VOILANORBERT_USERNAME: string;
    },
    logger: Logger
  ) {
    const client = new Voilanorbert(
      {
        url: VOILANORBERT_URL,
        apiToken: VOILANORBERT_API_KEY,
        username: VOILANORBERT_USERNAME
      },
      logger
    );

    this.voilanorbertEmailEnricher = new VoilanorbertEmailEnricher(
      client,
      logger
    );
  }
}
