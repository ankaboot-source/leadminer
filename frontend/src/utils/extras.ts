import type { NormalizedLocation } from '~/types/contact';

export const PrivacyPolicyButton = null;
export const AcceptNewsLetter = null;
export const CampaignButton = null;

type ToastLike = {
  add: (payload: {
    severity: string;
    summary: string;
    detail: string | { message: string; link?: { text: string; url: string } };
    group?: string;
    life: number;
  }) => void;
};

type StartMiningToastInput = {
  t: (key: string) => string;
  dataPrivacyUrl?: string;
};

export function createStartMiningToastPayload({
  t,
  dataPrivacyUrl,
}: StartMiningToastInput) {
  return {
    severity: 'info' as const,
    group: 'has-links' as const,
    summary: t('mining.contacts_got_rights_title'),
    detail: {
      message: t('mining.contacts_got_rights_detail'),
      ...(dataPrivacyUrl
        ? {
            link: {
              text: t('mining.learn_more_about_rights'),
              url: dataPrivacyUrl,
            },
          }
        : {}),
    },
    life: 8000,
  };
}

export function startMiningNotification(
  toast: ToastLike,
  t: (key: string) => string,
  dataPrivacyUrl?: string,
) {
  toast.add(
    createStartMiningToastPayload({
      t,
      dataPrivacyUrl,
    }),
  );
}

export function getLocationUrl(location: NormalizedLocation) {
  return `https://www.openstreetmap.org/${location.osm_type}/${location.osm_id}`;
}
