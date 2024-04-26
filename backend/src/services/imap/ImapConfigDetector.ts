// @ts-ignore
import autoDetect from 'imap-autoconfig';

interface Config {
  disableCache: boolean;
  redis: {
    host: string;
    port: number;
    db: number;
  };
  cacheExpire: number;
}

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
}

export default class ImapConfigDiscover {
  private readonly caching: boolean;

  private readonly detector;

  constructor(config?: Config) {
    this.detector = autoDetect.createIMAPSettingsDetector(config);
    this.caching = !!config?.redis;
  }

  /**
   * Asynchronously retrieves IMAP configuration for an email address.
   *
   * @param email - The email address to get the configuration for.
   * @returns A promise resolving to the IMAP configuration.
   * @throws If an error occurs during retrieval.
   */

  async getImapConfig(email: string): Promise<ImapConfig> {
    const config: ImapConfig = await new Promise((resolve, reject) => {
      this.detector.detect(
        email,
        '',
        this.caching,
        (err: any, data: ImapConfig) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
    return config;
  }
}
