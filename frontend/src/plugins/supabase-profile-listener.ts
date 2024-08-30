import { defineNuxtPlugin, useSupabaseUser } from '#imports';
import { useSupabaseUserProfile } from '~/composables/useSupabaseUserProfile';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Profile } from '~/types/profile';

export default defineNuxtPlugin({
  name: 'supabase-profile-listener',
  setup() {
    const $supabaseClient = useSupabaseClient();

    $supabaseClient.auth.onAuthStateChange(async (_, session) => {
      if (!session) {
        return;
      }

      const $supabaseUser = useSupabaseUser();
      const $currentProfile = useSupabaseUserProfile();

      const { data } = await $supabaseClient
        .from('profiles')
        .select('*')
        .single<Profile>();
      $currentProfile.value = data;

      $supabaseClient
        .channel('user-profile-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${$supabaseUser?.value.id}`,
          },
          (payload: RealtimePostgresChangesPayload<Profile>) => {
            $currentProfile.value = payload.new as Profile;
          },
        )
        .subscribe();
    });
  },
});
