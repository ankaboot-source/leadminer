import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import throttledQueue from 'throttled-queue';
import { logError } from '../../../utils/axios';
import { Person } from '../EmailEnricher';

interface Config {
  url: string;
  apiToken: string;
  rateLimiter: {
    requests: number;
    interval: number;
    spaced: boolean;
  };
}

export interface EnrichPersonRequest {
  url?: string;
  name: string;
  email: string;
  OptOut?: boolean;
  familyName?: string;
  givenName?: string;
  image?: string[];
  sameAs?: string[];
  jobTitle?: string[];
  worksFor?: string[];
  identifier?: string[];
  nationality?: string[];
  description?: string[];
  homeLocation?: string[];
  workLocation?: string[];
  alternateName?: string[];
  knowsLanguage?: string[];
}

export interface EnrichPersonResponse {
  email: string;
  name: string;
  givenName: string;
  familyName?: string;
  alternateName?: string[];
  image?: string[];
  jobTitle?: string[];
  worksFor?: string[];
  homeLocation?: string[];
  workLocation?: string[];
  sameAs?: string[];
  identifier?: string[];
  description?: string[];
  knowsLanguage?: string[];
  nationality?: string[];
  OptOut?: boolean;
  url?: string;
  error_msg?: string;
}

export default class TheDig {
  private readonly api: AxiosInstance;

  private readonly rateLimiter;

  constructor(
    { url, apiToken, rateLimiter: { requests, interval, spaced } }: Config,
    private readonly logger: Logger
  ) {
    this.api = axios.create({
      baseURL: url,
      headers: {
        'X-API-KEY': apiToken
      }
    });
    this.rateLimiter = throttledQueue(requests, interval, spaced);
  }

  async enrich(person: EnrichPersonRequest) {
    try {
      const { data } = await this.rateLimiter(() =>
        this.api.post<EnrichPersonResponse>('/person/', person)
      );
      return data;
    } catch (error) {
      logError(error, `[${this.constructor.name}:enrich]`, this.logger);
      throw error;
    }
  }

  async enrichBulk(persons: Partial<Person>[], webhook: string) {
    try {
      const { data } = await this.rateLimiter(() =>
        this.api.post(`/person/bulk?endpoint=${webhook}`, persons)
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
