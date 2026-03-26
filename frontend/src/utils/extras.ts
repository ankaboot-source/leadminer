import type { NormalizedLocation } from '~/types/contact';

export const PrivacyPolicyButton = null;
export const AcceptNewsLetter = null;
export const CampaignButton = null;

type ToastLike = {
  add: (payload: {
    severity: string;
    summary: string;
    detail: string;
    life: number;
  }) => void;
};

export function startMiningNotification(
  toast: ToastLike,
  t: (key: string) => string,
) {
  toast.add({
    severity: 'info',
    summary: t('mining.contacts_got_rights_title'),
    detail: t('mining.contacts_got_rights_detail'),
    life: 8000,
  });
}

export function getLocationUrl(location: NormalizedLocation) {
  return `https://www.openstreetmap.org/${location.osm_type}/${location.osm_id}`;
}
