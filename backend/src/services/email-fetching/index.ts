// src/clients/EmailFetcherClient.ts
import { Logger } from 'winston';
import axios, { AxiosInstance } from 'axios';
import ENV from '../../config';

export interface FetchStartPayload {
  userId: string;
  miningId: string;
  email: string;
  boxes: string[];
  extractSignatures: boolean;
  contactStream: string;
  signatureStream: string;
}

export interface FetchStopPayload {
  miningId: string;
  canceled: boolean;
}

class EmailFetcherClient {
  private client: AxiosInstance;

  constructor(
    private readonly logger: Logger,
    apiToken: string,
    baseUrl: string
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: { 'Content-Type': 'application/json', 'x-api-token': apiToken }
    });
  }

  /**
   * Start IMAP fetch job
   */
  async startFetch(payload: FetchStartPayload) {
    try {
      const { data } = await this.client.post('api/imap/fetch/start', payload);
      return data;
    } catch (error) {
      this.logger.error('Start fetching request failed', { error, payload });
      throw error;
    }
  }

  /**
   * Stop IMAP fetch job
   */
  async stopFetch(payload: FetchStopPayload) {
    try {
      const { data } = await this.client.delete('api/imap/fetch/stop', {
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

export default EmailFetcherClient;
