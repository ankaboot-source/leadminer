import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import qs from 'qs';
import { logError } from '../../../utils/axios';

interface Config {
  username: string;
  apiToken: string;
}

export default class Voilanorbert {
  private static readonly baseURL =
    'https://api.voilanorbert.com/2018-01-08/enrich';

  private readonly api: AxiosInstance;

  constructor({ username, apiToken }: Config, private readonly logger: Logger) {
    this.api = axios.create({
      baseURL: Voilanorbert.baseURL,
      headers: {},
      auth: {
        username,
        password: apiToken
      }
    });
  }

  async enrich(emails: string[], webhook: string) {
    try {
      const { data } = await this.api.post<{
        status: string;
        success: boolean;
        token: string;
      }>(
        '/upload',
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
