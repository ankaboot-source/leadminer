import { describe, expect, it } from 'vitest';
import { computeTerminalCampaignNotifications } from '@/utils/campaignTerminalToasts';
import type { CampaignOverview } from '@/types/campaign';

function makeCampaign(
  id: string,
  status: CampaignOverview['status'],
): CampaignOverview {
  return {
    id,
    sender_name: 'sender',
    sender_email: 'sender@example.com',
    subject: 'subject',
    status,
    total_recipients: 1,
    attempted: 1,
    delivered: 1,
    hard_bounced: 0,
    soft_bounced: 0,
    failed_other: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
    delivery_rate: 100,
    opening_rate: 0,
    clicking_rate: 0,
    unsubscribe_rate: 0,
    track_open: true,
    track_click: true,
    link_clicks: [],
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  };
}

describe('computeTerminalCampaignNotifications', () => {
  it('does not emit toasts for the first observed snapshot', () => {
    const firstSnapshot = [makeCampaign('c1', 'completed')];

    const result = computeTerminalCampaignNotifications({}, firstSnapshot);

    expect(result.notifications).toHaveLength(0);
    expect(result.statusesByCampaignId.c1).toBe('completed');
  });

  it('emits once when campaign transitions to completed', () => {
    const previousStatuses = { c1: 'processing' as const };
    const nextSnapshot = [makeCampaign('c1', 'completed')];

    const result = computeTerminalCampaignNotifications(
      previousStatuses,
      nextSnapshot,
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].id).toBe('c1');
  });

  it('does not emit repeatedly for unchanged terminal status', () => {
    const previousStatuses = { c1: 'completed' as const };
    const nextSnapshot = [makeCampaign('c1', 'completed')];

    const result = computeTerminalCampaignNotifications(
      previousStatuses,
      nextSnapshot,
    );

    expect(result.notifications).toHaveLength(0);
  });
});
