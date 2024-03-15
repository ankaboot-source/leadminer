<template>
  <q-header
    style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(7px)"
    class="q-pt-md q-px-md"
  >
    <q-toolbar class="text-primary q-pa-sm">
      <RouterLink to="/dashboard"><AppLogo /></RouterLink>
      <q-space />
      <CreditsCounter v-if="shouldShowCreditsBadge" />
      <div v-show="shouldShowSettings">
        <q-btn flat class="text-lowercase" @click="goToSettings()">
          {{ user?.email }}
        </q-btn>
      </div>
      <q-btn
        :class="`${!shouldShowSettings ? 'q-ml-sm' : ''} q-mr-sm`"
        flat
        round
        dense
        icon="logout"
        @click="logout()"
      />
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">
import { type User } from '@supabase/supabase-js';
import { logout } from '@/utils/auth';
import CreditsCounter from './Credits/CreditsCounter.vue';
import AppLogo from './AppLogo.vue';

const router = useRouter();
const user = ref<User | null>(null);

const shouldShowSettings = computed(
  () => process.client && window.location.pathname !== '/account/settings'
);
const shouldShowCreditsBadge = useRuntimeConfig().public.ENABLE_CREDIT;

function goToSettings() {
  router.push('/account/settings');
}

onMounted(async () => {
  const { data } = await useSupabaseClient().auth.getSession();
  if (data?.session) {
    user.value = data.session?.user;
  }
});
</script>

<style scoped>
.bg-maincolor {
  background-color: #f8f9fa;
}
</style>
