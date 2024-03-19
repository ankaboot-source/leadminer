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
        <q-btn
          flat
          class="text-lowercase"
          @click="navigateTo('/account/settings')"
        >
          {{ $user?.email }}
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
import { logout } from '@/utils/auth';
import CreditsCounter from './Credits/CreditsCounter.vue';
import AppLogo from './AppLogo.vue';

const $user = useSupabaseUser();
const $route = useRoute();

const shouldShowSettings = computed(() => $route.path !== '/account/settings');
const shouldShowCreditsBadge = useRuntimeConfig().public.ENABLE_CREDIT;
</script>

<style scoped>
.bg-maincolor {
  background-color: #f8f9fa;
}
</style>
