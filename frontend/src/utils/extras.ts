import type { NormalizedLocation } from '~/types/contact';

export const PrivacyPolicyButton = null;
export const AcceptNewsLetter = null;
export const CampaignButton = null;

type StartMiningToastInput = {
  t: (key: string) => string;
  dataPrivacyUrl?: string;
};

function normalizeToastText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeToastText(item))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (value && typeof value === 'object') {
    if ('message' in value) {
      return normalizeToastText(value.message);
    }

    if ('text' in value) {
      return normalizeToastText(value.text);
    }
  }

  return '';
}

export function createStartMiningToastPayload({
  t,
  dataPrivacyUrl,
}: StartMiningToastInput) {
  const summary =
    normalizeToastText(t('mining.contacts_got_rights_title')) ||
    'Vos contacts ont des droits';
  const detailMessage =
    normalizeToastText(t('mining.contacts_got_rights_detail')) || summary;
  const rightsLinkText =
    normalizeToastText(t('mining.learn_more_about_rights')) ||
    'En savoir plus sur les droits de vos contacts';

  return {
    severity: 'info' as const,
    group: 'has-links' as const,
    summary,
    detail: {
      message: detailMessage,
      ...(dataPrivacyUrl
        ? {
            link: {
              text: rightsLinkText,
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
