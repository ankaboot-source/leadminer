import type { NormalizedLocation } from '~/types/contact';

export const PrivacyPolicyButton = null;
export const AcceptNewsLetter = null;
export const CampaignButton = null;
// skipcq: JS-0321
export function startMiningNotification() {}
export function getLocationUrl(location: NormalizedLocation) {
  return `https://www.openstreetmap.org/${location.osm_type}/${location.osm_id}`;
}
