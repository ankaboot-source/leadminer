import type { OAuthMiningSource } from '@/types/mining';

export async function addOAuthAccount(provider: OAuthMiningSource) {
  const { $api } = useNuxtApp();
  const { authorizationUri } = await $api<{ authorizationUri: string }>(
    `/imap/mine/sources/${provider}`,
    {
      method: 'POST',
    },
  );

  if (authorizationUri) {
    window.location.href = authorizationUri;
  }
}

/**
 * Redirects to the OAuth consent error page.
 * @returns {Promise<string>} The URL of the OAuth consent error page with provider and referrer parameters.
 */
export async function redirectOauthConsentPage() {
  const provider = useLeadminerStore().activeMiningSource?.type;
  const referrer = (await useSupabaseClient().auth.getSession()).data.session
    ?.user.id;
  return `/oauth-consent-error?provider=${provider}&referrer=${referrer}`;
}
