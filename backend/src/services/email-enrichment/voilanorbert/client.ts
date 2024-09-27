import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import qs from 'qs';
import { logError } from '../../../utils/axios';

interface Config {
  url: string;
  username: string;
  apiToken: string;
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

  constructor(
    { url, username, apiToken }: Config,
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
  }

  async enrich(
    emails: string[],
    webhook: string
  ): Promise<EnrichAsyncResponse> {
    try {
      const { data } = await this.api.post<EnrichAsyncResponse>(
        '/enrich/upload',
        qs.stringify({
          data: emails.join('\n'),
          webhook
        })
      );
      return data;
    } catch (error) {
      logError(error, `[${this.constructor.name}:enrich]`, this.logger);
      throw error;
    }
  }
}
