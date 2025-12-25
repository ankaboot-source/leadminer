import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';

export interface FetchStartPayload {
  userId: string;
  miningId: string;
  source: string;
  extractSignatures: boolean;
  contactStream: string;
  signatureStream: string;
}

export interface FetchStopPayload {
  miningId: string;
  canceled: boolean;
}

class PSTFetcherClient {
  private client: AxiosInstance;

  constructor(
    private readonly logger: Logger,
    apiToken: string,
    baseUrl: string
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': apiToken
      }
    });
  }

  /**
   * Start fetch job
   */
  async startFetch(payload: FetchStartPayload) {
    try {
      const { data } = await this.client.post('api/pst/fetch/start', payload);
      return data;
    } catch (error) {
      this.logger.error('Start fetching request failed', {
        error,
        payload
      });
      throw error;
    }
  }

  /**
   * Stop fetch job
   */
  async stopFetch(payload: FetchStopPayload) {
    try {
      const { data } = await this.client.delete('api/pst/fetch/stop', {
        data: payload
      });
      return data;
    } catch (error) {
      this.logger.error('Stop fetching request with failed', {
        error,
        payload
      });
      throw error;
    }
  }
}

export default PSTFetcherClient;
