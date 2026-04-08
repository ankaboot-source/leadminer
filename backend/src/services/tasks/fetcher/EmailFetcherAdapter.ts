import EmailFetcherClient from '../../email-fetching';
import {
  FetcherAdapter,
  FetchStartPayload,
  FetchStopPayload
} from './FetcherAdapter';
import { MiningSourceType } from '../task/types';

export class EmailFetcherAdapter implements FetcherAdapter {
  readonly sourceType: MiningSourceType = 'email';

  public isCompleted = false;

  constructor(private readonly fetcherClient: EmailFetcherClient) {}

  async start(payload: FetchStartPayload): Promise<{ totalMessages: number }> {
    const result = await this.fetcherClient.startFetch({
      userId: payload.userId,
      miningId: payload.miningId,
      email: payload.email,
      boxes: payload.boxes,
      extractSignatures: payload.extractSignatures,
      contactStream: payload.contactStream,
      signatureStream: payload.signatureStream,
      since: payload.since
    });
    return { totalMessages: result.data.totalMessages };
  }

  async stop(payload: FetchStopPayload): Promise<void> {
    await this.fetcherClient.stopFetch({
      miningId: payload.miningId,
      canceled: payload.canceled
    });
  }
}
