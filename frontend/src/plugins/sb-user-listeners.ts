import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';
import { useSupabaseUserProfile } from '~/composables/useSupabaseUserProfile';
import { useLeadminerStore } from '~/stores/leadminer';
import { deriveSourceState } from '~/utils/miningSourceConfig';
import { SourceHealthState } from '~/types/enums';
import type { Profile } from '~/types/profile';

/**
 * Retrieves the current user's profile from the Supabase database.
 *
 * @param client - The Supabase client instance used to query the database.
 * @returns A promise that resolves to the user's profile data.
 * @throws An error if fetching the profile fails.
 */
async function getCurrentUserProfile(client: SupabaseClient) {
  // Keep this select('*'). leadminer-commercial is merged into this repo at
  // deploy time and reads profile columns this file cannot know about (e.g.
  // `credits` for the enrich billing gate). Narrowing here silently returns
  // undefined for those columns, which breaks commercial credit checks.
  const { data, error } = await client
    .schema('private')
    .from('profiles')
    .select('*')
    .single<Profile>();

  if (error) throw error;
  return data;
}

/**
 * Adds a mining source using a provider token.
 *
 * @param api - The API client instance to interact with the edge function.
 * @param provider - The name of the provider (e.g., GitHub, Google).
 * @param providerToken - The token provided by the authentication provider.
 * @returns A promise that resolves once the mining source has been added.
 */
async function addMiningSourceFromProviderToken(
  provider: string,
  providerToken: string,
  providerRefreshToken: string,
): Promise<void> {
  await useNuxtApp().$saasEdgeFunctions('mining-sources', {
    method: 'POST',
    body: {
      provider,
      provider_token: providerToken,
      provider_refresh_token: providerRefreshToken,
    },
  });
}

/**
 * Updates the user's email templates localization based on their language preference.
 *
 * @param api - The API client instance used for updating email templates.
 * @param client - The Supabase client instance for updating user data.
 * @param language - The language code (e.g., 'en', 'fr') for the email templates.
 * @returns A promise that resolves once the email templates are updated.
 */
async function updateUserEmailTemplatesI18n(language: string): Promise<void> {
  await useNuxtApp().$saasEdgeFunctions('email-templates', {
    method: 'POST',
    body: { language },
  });
  /**
   * Trigger a session sync to ensure templates don't get updated again on refresh.
   */
  const { error } = await useSupabaseClient().auth.updateUser({});

  if (error) throw error;
}

/**
 * Updates the user's metadata to mark first-time sign-in as true.
 *
 * @param supabase - The Supabase client instance.
 * @returns Resolves when the update is complete.
 */
async function updateFirstTimeSignIn() {
  const { error } = await useSupabaseClient().auth.updateUser({
    data: { first_time_signin: true },
  });

  if (error) throw error;
}

/**
 * Handles first-time sign-in logic. Idempotent: it also runs on
 * INITIAL_SESSION (every reload), so each operation only writes when it would
 * actually change something.
 */
async function handleFirstTimeSignIn(session: Session) {
  const {
    data: { user },
    error,
  } = await useSupabaseClient().auth.getUser();

  if (!user || error) throw new Error('Failed to fetch user data.');

  const provider = user.app_metadata?.provider;
  // Read the provider tokens from the session passed to onAuthStateChange.
  // useSupabaseSession() can lag a tick, so it could still read null right
  // after SIGNED_IN and skip the OAuth source with no later retry.
  const providerToken = session.provider_token;
  const providerRefreshToken = session.provider_refresh_token;
  const firstTimeSignin = user.user_metadata.first_time_signin;
  const emailTemplate = user.user_metadata.EmailTemplate;
  const language = navigator.language.split('-')[0];

  if (!firstTimeSignin) {
    await updateFirstTimeSignIn();
  }

  // Supabase reports password accounts as provider "email", which is not an
  // OAuth mining provider. Only auto-create a source for real OAuth
  // providers; anything else is rejected by mining-sources validation.
  if (
    (provider === 'google' || provider === 'azure') &&
    providerToken &&
    providerRefreshToken
  ) {
    const $leadminerStore = useLeadminerStore();

    // Load the list first so the existence check below is not skipped on a
    // fresh reload (INITIAL_SESSION), which would re-POST on every page load.
    await $leadminerStore.ensureMiningSourcesLoaded();

    const userEmail = user.email?.toLowerCase();
    const existingSource = $leadminerStore.miningSources.find(
      (source) =>
        source.email?.toLowerCase() === userEmail && source.type === provider,
    );

    // Signing in again re-authorises the account, so it is the natural place to
    // repair a broken source: without this the card keeps showing "credentials
    // expired" until the user finds the Reconnect button. Healthy sources are
    // left untouched so a normal sign-in does not rewrite their credentials.
    const needsReauth = existingSource
      ? deriveSourceState(existingSource).state ===
        SourceHealthState.NeedsReauth
      : false;

    if (!existingSource || needsReauth) {
      await addMiningSourceFromProviderToken(
        provider,
        providerToken,
        providerRefreshToken,
      );

      // The row was just created. Some views (e.g. /mine) may have already
      // fetched an empty source list before this POST resolved, and the store
      // latches that result for the session. Refresh it so panels showing the
      // "choose a mining source" empty state switch to the existing-source
      // dropdown.
      try {
        await $leadminerStore.ensureMiningSourcesLoaded({ refresh: true });
      } catch (refreshError) {
        // eslint-disable-next-line no-console
        console.warn(
          '[auth] Failed to refresh mining sources after sign-in',
          refreshError,
        );
      }
    }
  }

  if (language && (!emailTemplate || emailTemplate.language !== language)) {
    await updateUserEmailTemplatesI18n(language);
  }
}

function createUserProfileRealtimeChannel(userId: string) {
  const $currentProfile = useSupabaseUserProfile();

  return useSupabaseClient()
    .channel('user-profile-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'private',
        table: 'profiles',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<Profile>) => {
        $currentProfile.value = payload.new as Profile;
      },
    );
}

export default defineNuxtPlugin({
  name: 'user-listeners',
  setup() {
    const $user = useSupabaseUser();
    const $supabaseClient = useSupabaseClient();
    const $currentProfile = useSupabaseUserProfile();

    const authenticated = ref(false);
    let channel: RealtimeChannel | null;

    if (import.meta.client) {
      watch(authenticated, async (auth) => {
        if (!auth && channel) await $supabaseClient.removeChannel(channel);

        if (!auth) return;

        $currentProfile.value = await getCurrentUserProfile($supabaseClient);
        const userId =
          $user.value?.id || ($user.value as { sub?: string } | null)?.sub;
        if (!userId) return;

        channel = createUserProfileRealtimeChannel(userId);
        channel.subscribe();
      });
    }

    $supabaseClient.auth.onAuthStateChange((event, session) => {
      authenticated.value = session !== null;

      // INITIAL_SESSION is the reload path (EmailAuth reloadNuxtApp after
      // password sign-in, OAuth landing): supabase-js restores from storage
      // and no SIGNED_IN fires. Run for both; handleFirstTimeSignIn is
      // idempotent so nothing is written twice.
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        handleFirstTimeSignIn(session).catch((error: unknown) => {
          // eslint-disable-next-line no-console
          console.error('[auth] First-time sign-in handling failed:', error);
        });
      }
    });
  },
});
