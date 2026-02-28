import type { NormalizedLocation } from '~/types/contact';

export const PrivacyPolicyButton = null;
export const AcceptNewsLetter = null;
export const CampaignButton = null;

export function startMiningNotification() {
  const { t } = useI18n({ useScope: 'global' });
  const $toast = useToast();

  $toast.add({
    severity: 'info',
    summary: t('mining.contacts_got_rights_title'),
    detail: {
      message: t('mining.contacts_got_rights_detail'),
      link: {
        text: t('mining.learn_more_about_rights'),
        url: 'https://leadminer.io/donnees-personnelles',
      },
    },
    life: 8000,
    group: 'has-links',
  });
}

export function getLocationUrl(location: NormalizedLocation) {
  return `https://www.openstreetmap.org/${location.osm_type}/${location.osm_id}`;
}
