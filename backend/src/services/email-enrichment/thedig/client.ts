import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { logError } from '../../../utils/axios';
import { Person } from '../EmailEnricher';

interface Config {
  url: string;
  apiToken: string;
}

export interface EnrichPersonResponse {
  email: string;
  name: string;
  givenName: string;
  familyName?: string;
  alternateName?: string[];
  image?: string;
  jobTitle?: string;
  organization?: string;
  homeLocation?: string[];
  workLocation?: string[];
  sameAs?: string[];
  identifier?: string[];
  description?: string[];
  error_msg?: string;
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

  async enrich(person: Person) {
    try {
      const { data } = await this.api.post<EnrichPersonResponse>(
        '/person/',
        person
      );

      return data;
    } catch (error) {
      logError(error, `[${this.constructor.name}:enrich]`, this.logger);
      throw error;
    }
  }

  async enrichBulk(persons: Person[], webhook: string) {
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
      logError(error, `[${this.constructor.name}:enrichBulk]`, this.logger);
      throw error;
    }
  }
}
