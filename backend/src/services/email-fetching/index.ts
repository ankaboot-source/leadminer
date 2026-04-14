// src/clients/EmailFetcherClient.ts
import { Logger } from 'winston';
import axios, { AxiosInstance } from 'axios';
import type { FetcherClient } from '../tasks-manager-v2/tasks/FetchTask';

export interface FetchStartPayload {
  userId: string;
  miningId: string;
  email: string;
  boxes: string[];
  extractSignatures: boolean;
  contactStream: string;
  signatureStream: string;
  since?: string;
}

export interface FetchStopPayload {
  miningId: string;
  canceled: boolean;
}

class EmailFetcherClient implements FetcherClient {
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
  async startFetch(opts: {
    miningId: string;
    contactStream: string;
    signatureStream?: string;
    extractSignatures?: boolean;
    userId: string;
    fetchParams?: Record<string, unknown>;
  }) {
    try {
      const payload: FetchStartPayload = {
        userId: opts.userId,
        miningId: opts.miningId,
        contactStream: opts.contactStream,
        signatureStream: opts.signatureStream ?? '',
        extractSignatures: opts.extractSignatures ?? false,
        email: opts.fetchParams?.email as string,
        boxes: opts.fetchParams?.folders as string[],
        since: opts.fetchParams?.since as string | undefined
      };
      const { data } = await this.client.post('api/imap/fetch/start', payload);
      return data;
    } catch (error) {
      this.logger.error('Start fetching request failed', { error, opts });
      throw error;
    }
  }

  /**
   * Stop IMAP fetch job
   */
  async stopFetch(opts: { miningId: string; canceled: boolean }) {
    try {
      const payload: FetchStopPayload = {
        miningId: opts.miningId,
        canceled: opts.canceled
      };
      const { data } = await this.client.delete('api/imap/fetch/stop', {
        data: payload
      });
      return data;
    } catch (error) {
      this.logger.error('Stop fetching request failed', {
        error,
        opts
      });
      throw error;
    }
  }
}

export default EmailFetcherClient;
