import axios, { AxiosInstance } from 'axios';

import { Logger } from 'winston';
import qs from 'qs';
import { logError } from '../../../utils/axios';
import { IRateLimiter } from '../../rate-limiter';

interface Config {
  url: string;
  username: string;
  apiToken: string;
  rateLimiter: IRateLimiter;
}

interface Result {
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

export interface ResponseAsync {
  status: string;
  success: boolean;
  token: string;
}

export interface ResponseWebhook {
  id: string;
  token: string;
  results: Result[];
}

export default class VoilanorbertApi {
  private static readonly baseURL = 'https://api.voilanorbert.com/2018-01-08/';

  private readonly api: AxiosInstance;

  private readonly rateLimiter;

  constructor(
    { url, username, apiToken, rateLimiter }: Config,
    private readonly logger: Logger
  ) {
    this.api = axios.create({
      baseURL: url ?? VoilanorbertApi.baseURL,
      headers: {},
      auth: {
        username,
        password: apiToken
      }
    });
    this.rateLimiter = rateLimiter;
  }

  async enrich(emails: string[], webhook: string): Promise<ResponseAsync> {
    try {
      const { data } = await this.rateLimiter.throttleRequests(() =>
        this.api.post<ResponseAsync>(
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
