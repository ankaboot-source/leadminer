import { Request, Response } from 'express';
import { getState } from '../store/messageStore';

export default function healthRoute(_req: Request, res: Response) {
  const state = getState();

  return res.json({
    status: 'ok',
    service: 'sms-gateway-mock',
    config: { ...state.config },
    stats: {
      totalMessages: state.messageStore.size,
      campaignsTracked: state.campaignIndex.size
    }
  });
}
