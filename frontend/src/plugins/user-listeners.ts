import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';
import { useSupabaseUserProfile } from '~/composables/useSupabaseUserProfile';
import type { Profile } from '~/types/profile';
import type { $Fetch } from 'nitropack';

/**
 * Retrieves the current user's profile from the Supabase database.
 *
 * @param client - The Supabase client instance used to query the database.
 * @returns A promise that resolves to the user's profile data.
 * @throws An error if fetching the profile fails.
 */
async function getCurrentUserProfile(client: SupabaseClient): Promise<Profile> {
  const { data, error } = await client
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
  api: $Fetch,
  provider: string,
  providerToken: string,
): Promise<void> {
  try {
    await api('add-mining-source', {
      method: 'POST',
      body: { provider, provider_token: providerToken },
    });
  } catch (err) {
    console.error('Failed to add mining source:', err);
  }
}

/**
 * Updates the user's email templates localization based on their language preference.
 *
 * @param api - The API client instance used for updating email templates.
 * @param client - The Supabase client instance for updating user data.
 * @param language - The language code (e.g., 'en', 'fr') for the email templates.
 * @returns A promise that resolves once the email templates are updated.
 */
async function updateUserEmailTemplatesI18n(
  api: $Fetch,
  client: SupabaseClient,
  language: string,
): Promise<void> {
  try {
    await api('email-templates', {
      method: 'POST',
      body: { language },
    });
    /**
     * Trigger a session sync to ensure templates don't get updated again on refresh.
     */
    await client.auth.updateUser({});
  } catch (err) {
    console.error('Failed to update email templates:', err);
  }
}

export default defineNuxtPlugin({
  name: 'supabase-profile-listener',
  async setup() {
    const $user = useSupabaseUser();
    const $session = useSupabaseSession();
    const $supabaseClient = useSupabaseClient();
    const $currentProfile = useSupabaseUserProfile();
    const $saasEdgeFunctions = useNuxtApp().$saasEdgeFunctions as $Fetch;

    let channel: RealtimeChannel | null;
    const authenticated = ref(false);

    /**
     * Starts watching for authentication changes.
     */
    const startAuthenticationWatcher = () => {
      watch(authenticated, async (auth) => {
        if (!auth) {
          if (channel) await $supabaseClient.removeChannel(channel);
          return;
        }

        const { provider, providerToken, hasEmailTemplate } = {
          provider: $user.value.app_metadata.provider,
          providerToken: $session.value.provider_token,
          hasEmailTemplate: $user.value.user_metadata.EmailTemplate,
        };

        if (provider && providerToken) {
          await addMiningSourceFromProviderToken(
            $saasEdgeFunctions,
            provider,
            providerToken,
          );
        }

        if (!hasEmailTemplate) {
          await updateUserEmailTemplatesI18n(
            $saasEdgeFunctions,
            $supabaseClient,
            navigator.language.split('-')[0],
          );
        }

        channel = $supabaseClient.channel('user-profile-realtime').on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${$user.value.id}`,
          },
          (payload: RealtimePostgresChangesPayload<Profile>) => {
            $currentProfile.value = payload.new as Profile;
          },
        );
        channel.subscribe();
      });
    };

    /**
     * Fetches and assigns the user profile on the server
     * to avoid empty fields in "settings" during hard refresh.
     */
    if ($session.value) {
      $currentProfile.value = await getCurrentUserProfile($supabaseClient);
    }

    if (import.meta.client) {
      startAuthenticationWatcher();
    }

    $supabaseClient.auth.onAuthStateChange((_, session) => {
      if (session) {
        authenticated.value = true;
      } else {
        authenticated.value = false;
      }
    });
  },
});
