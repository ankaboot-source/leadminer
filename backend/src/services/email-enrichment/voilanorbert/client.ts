import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import qs from 'qs';
import throttledQueue from 'throttled-queue';
import { logError } from '../../../utils/axios';

interface Config {
  url: string;
  username: string;
  apiToken: string;
  rateLimiter: {
    requests: number;
    interval: number;
    spaced: boolean;
  };
}

export interface VoilanorbertEnrichmentResult {
  email: string;
  fullName: string;
  title: string;
  organization: string;
  location: string;
  twitter: string;
  linkedin: string;
  facebook: string;
  error_msg?: string;
}

export interface EnrichAsyncResponse {
  status: string;
  success: boolean;
  token: string;
}

export interface VoilanorbertWebhookResult {
  id: string;
  token: string;
  results: VoilanorbertEnrichmentResult[];
}

export default class Voilanorbert {
  private static readonly baseURL = 'https://api.voilanorbert.com/2018-01-08/';

  private readonly api: AxiosInstance;

  private readonly rateLimiter;

  constructor(
    {
      url,
      username,
      apiToken,
      rateLimiter: { requests, interval, spaced }
    }: Config,
    private readonly logger: Logger
  ) {
    this.api = axios.create({
      baseURL: url ?? Voilanorbert.baseURL,
      headers: {},
      auth: {
        username,
        password: apiToken
      }
    });
    this.rateLimiter = throttledQueue(requests, interval, spaced);
  }

  async enrich(
    emails: string[],
    webhook: string
  ): Promise<EnrichAsyncResponse> {
    try {
      const { data } = await this.rateLimiter(() =>
        this.api.post<EnrichAsyncResponse>(
          '/enrich/upload',
          qs.stringify({
            data: emails.join('\n'),
            webhook
          })
        )
      );
      return data;
    } catch (error) {
      logError(error, `[${this.constructor.name}:enrich]`, this.logger);
      throw error;
    }
  }
}
