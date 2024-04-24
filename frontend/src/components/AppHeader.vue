<template>
  <div class="py-3.5 flex justify-between">
    <RouterLink to="/dashboard">
      <AppLogo />
    </RouterLink>

    <div class="hidden md:flex md:items-center md:gap-1">
      <CreditsCounter v-if="shouldShowCreditsBadge" />
      <div v-show="shouldShowSettings">
        <Button
          class="text-lowercase"
          text
          @click="navigateTo('/account/settings')"
        >
          {{ $user?.email }}
        </Button>
      </div>
      <Button icon="pi pi-sign-out" text @click="logout()" />
    </div>

    <Button class="md:hidden" icon="pi pi-bars" @click="visible = true" />

    <Sidebar v-model:visible="visible" class="p-3.5">
      <template #container>
        <div class="flex flex-column">
          <RouterLink to="/dashboard">
            <AppLogo />
          </RouterLink>
        </div>

        <div class="overflow-y-auto mt-10">
          <CreditsCounter v-if="shouldShowCreditsBadge" />
        </div>
        <div class="mt-auto w-full">
          <Button
            class="w-full pl-10 text-lowercase justify-center"
            text
            @click="navigateTo('/account/settings')"
          >
            {{ $user?.email }}
          </Button>
          <Button class="w-full flex justify-center gap-2" @click="logout()">
            Logout
            <i class="pi pi-sign-out"></i>
          </Button>
        </div>
      </template>
    </Sidebar>
  </div>
</template>

<script setup lang="ts">
import { logout } from '@/utils/auth';
import CreditsCounter from './Credits/CreditsCounter.vue';
import AppLogo from './AppLogo.vue';

const $user = useSupabaseUser();
const $route = useRoute();

const visible = ref(false);

const shouldShowSettings = computed(() => $route.path !== '/account/settings');
const shouldShowCreditsBadge = useRuntimeConfig().public.ENABLE_CREDIT;
</script>

<style scoped>
.bg-maincolor {
  background-color: #f8f9fa;
}
</style>
