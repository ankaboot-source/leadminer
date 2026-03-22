import type { NormalizedLocation } from '~/types/contact';

export const PrivacyPolicyButton = null;
export const AcceptNewsLetter = null;
export const CampaignButton = null;

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

export function startMiningNotification() {
  const { t } = useI18n({ useScope: 'global' });
  const {
    public: { DATA_PRIVACY_URL },
  } = useRuntimeConfig();
  const $toast = useToast();

  $toast.add(
    createStartMiningToastPayload({
      t,
      dataPrivacyUrl: DATA_PRIVACY_URL,
    }),
  );
}

export function getLocationUrl(location: NormalizedLocation) {
  return `https://www.openstreetmap.org/${location.osm_type}/${location.osm_id}`;
}
