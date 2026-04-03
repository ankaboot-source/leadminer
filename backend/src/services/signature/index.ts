import { Logger } from 'winston';
import { ExtractSignature, PersonLD } from './types';

export interface EngineConfig {
  engine: ExtractSignature;
  useAsFallback: boolean;
}

export class Signature implements ExtractSignature {
  constructor(
    private readonly logger: Logger,
    private readonly engines: EngineConfig[]
  ) {
    const primaryEngine = this.getEngine();
    const fallbackEngine = this.getFallback();

    this.logger.info('Signature extractor initialized', {
      primary: primaryEngine?.constructor.name || 'None',
      fallback: fallbackEngine?.constructor.name || 'None'
    });
  }

  isActive(): boolean {
    this.logger.warn(`${this.constructor.name}: Empty method is being called`);
    throw new Error('Method not implemented');
  }

  /**
   * Get the first active engine in the list
   */
  private getEngine(): ExtractSignature | null {
    const activeEngine = this.engines.find(
      (config) => config.engine.isActive() && !config.useAsFallback
    );
    return activeEngine?.engine || null;
  }

  /**
   * Get the first fallback engine in the list
   */
  private getFallback(): ExtractSignature | null {
    const fallbackEngine = this.engines.find(
      (config) => config.engine.isActive() && config.useAsFallback
    );
    return fallbackEngine?.engine || null;
  }

  /**
   * Get display name for an engine, including wrapped engine if applicable
   */
  private static getEngineDisplayName(engine: ExtractSignature): string {
    const baseName = engine.constructor.name;
    if (engine.wrappedEngineName) {
      return `${baseName} (${engine.wrappedEngineName})`;
    }
    return baseName;
  }

  async extract(email: string, signature: string): Promise<PersonLD | null> {
    const primary = this.getEngine();
    const fallback = this.getFallback();
    const engine = primary ?? fallback;

    if (engine && primary) {
      this.logger.debug(
        `Using primary engine: ${Signature.getEngineDisplayName(primary)}`
      );
    } else if (engine && fallback) {
      this.logger.debug(
        `Primary engine not available, falling back to: ${Signature.getEngineDisplayName(fallback)}`
      );
    } else {
      this.logger.error('No available engine for signature extraction');
      return null;
    }

    try {
      this.logger.debug(
        `Attempting extraction with engine: ${Signature.getEngineDisplayName(engine)}`
      );
      const result = await engine.extract(email, signature);

      this.logger.debug(
        `Engine ${Signature.getEngineDisplayName(engine)} extraction completed`,
        {
          success: result !== null
        }
      );

      return result;
    } catch (err) {
      this.logger.error(
        `Engine ${Signature.getEngineDisplayName(engine)} failed during extraction`,
        {
          error: err instanceof Error ? err.message : String(err)
        }
      );

      return null;
    }
  }
}
