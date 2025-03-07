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
  name: 'user-listeners',
  async setup() {
    const $supabaseClient = useSupabaseClient();
    const $currentProfile = useSupabaseUserProfile();

    let channel: RealtimeChannel | null;
    const authenticated = ref(false);

    /**
     * Starts watching for authentication changes.
     */
    const startAuthenticationWatcher = () => {
      const $user = useSupabaseUser();
      const $session = useSupabaseSession();
      const $saasEdgeFunctions = useNuxtApp().$saasEdgeFunctions as $Fetch;

      watch(authenticated, async (auth) => {
        if (!auth) {
          if (channel) await $supabaseClient.removeChannel(channel);
          return;
        }
        $currentProfile.value = await getCurrentUserProfile($supabaseClient);

        const { provider, providerToken, emailTemplate, language } = {
          provider: $user.value?.app_metadata.provider,
          providerToken: $session.value?.provider_token,
          emailTemplate: $user.value?.user_metadata.EmailTemplate,
          language: navigator.language.split('-')[0],
        };

        // Use providerToken as a mining-source on first-time sign-in
        // An empty emailTemplate signifies a first-time sign-in
        if (!emailTemplate && provider && providerToken) {
          await addMiningSourceFromProviderToken(
            $saasEdgeFunctions,
            provider,
            providerToken,
          );
        }

        if (!emailTemplate || emailTemplate.language !== language) {
          await updateUserEmailTemplatesI18n(
            $saasEdgeFunctions,
            $supabaseClient,
            language,
          );
        }

        channel = $supabaseClient.channel('user-profile-realtime').on(
          'postgres_changes',
          {
            event: '*',
            schema: 'private',
            table: 'profiles',
            filter: `user_id=eq.${$user.value?.id}`,
          },
          (payload: RealtimePostgresChangesPayload<Profile>) => {
            $currentProfile.value = payload.new as Profile;
          },
        );
        channel.subscribe();
      });
    };

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
