import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { logError } from '../../../utils/axios';
import { Person } from '../EmailEnricher';

interface Config {
  url: string;
  apiToken: string;
}

export default class TheDig {
  private readonly api: AxiosInstance;

  constructor({ url, apiToken }: Config, private readonly logger: Logger) {
    this.api = axios.create({
      baseURL: url,
      headers: {
        'X-API-KEY': apiToken
      }
    });
  }

  async enrich(persons: Person[], webhook: string) {
    try {
      const { data } = await this.api.post(
        `/person/bulk?endpoint=${webhook}`,
        persons
      );

      return {
        status: 'running',
        success: true,
        token: data as string
      };
    } catch (error) {
      logError(error, `[${this.constructor.name}:enrich]`, this.logger);
      throw error;
    }
  }
}
