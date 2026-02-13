import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';
import { useSupabaseUserProfile } from '~/composables/useSupabaseUserProfile';
import type { Profile } from '~/types/profile';

/**
 * Retrieves the current user's profile from the Supabase database.
 *
 * @param client - The Supabase client instance used to query the database.
 * @returns A promise that resolves to the user's profile data.
 * @throws An error if fetching the profile fails.
 */
async function getCurrentUserProfile(client: SupabaseClient) {
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
  await useNuxtApp().$saasEdgeFunctions('add-mining-source', {
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
 * Handles first-time sign-in logic.
 */
async function handleFirstTimeSignIn() {
  const {
    data: { user },
    error,
  } = await useSupabaseClient().auth.getUser();

  if (!user || error) throw new Error('Failed to fetch user data.');

  const $session = useSupabaseSession();

  const provider = user.app_metadata?.provider;
  const providerToken = $session.value?.provider_token;
  const providerRefreshToken = $session.value?.provider_refresh_token;
  const firstTimeSignin = user.user_metadata.first_time_signin;
  const emailTemplate = user.user_metadata.EmailTemplate;
  const language = navigator.language.split('-')[0];

  if (!firstTimeSignin) {
    await updateFirstTimeSignIn();
  }

  if (provider && providerToken && providerRefreshToken) {
    await addMiningSourceFromProviderToken(
      provider,
      providerToken,
      providerRefreshToken,
    );
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
        await handleFirstTimeSignIn();
        channel = createUserProfileRealtimeChannel($user.value?.sub as string);
        channel.subscribe();
      });
    }

    $supabaseClient.auth.onAuthStateChange((_, session) => {
      authenticated.value = session !== null;
    });
  },
});
