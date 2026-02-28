import type { CampaignOverview, CampaignStatus } from '@/types/campaign';

export type CampaignStatusesById = Record<string, CampaignStatus>;

function isTerminalStatus(status: CampaignStatus) {
  return status === 'completed' || status === 'failed';
}

export function computeTerminalCampaignNotifications(
  previousStatusesByCampaignId: CampaignStatusesById,
  campaigns: CampaignOverview[],
) {
  const notifications: CampaignOverview[] = [];
  const statusesByCampaignId: CampaignStatusesById = {};

  campaigns.forEach((campaign) => {
    const previousStatus = previousStatusesByCampaignId[campaign.id];
    const currentStatus = campaign.status;

    statusesByCampaignId[campaign.id] = currentStatus;

    if (!previousStatus) {
      return;
    }

    if (previousStatus === currentStatus) {
      return;
    }

    if (!isTerminalStatus(currentStatus)) {
      return;
    }

    notifications.push(campaign);
  });

  return {
    notifications,
    statusesByCampaignId,
  };
}
