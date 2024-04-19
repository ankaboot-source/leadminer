<template>
  <div class="py-3.5 flex justify-between">
    <RouterLink to="/dashboard">
      <AppLogo />
    </RouterLink>

    <div class="md:flex md:items-center md:gap-2 max-md:hidden">
      <CreditsCounter v-if="shouldShowCreditsBadge" />
      <div v-show="shouldShowSettings">
        <Button
          class="text-lowercase"
          text
          @click="navigateTo('/account/settings')"
        >
          {{ $user?.email }}
        </Button>
        <Button icon="pi pi-sign-out" text @click="logout()" />
      </div>
    </div>

    <Button class="md:hidden" icon="pi pi-bars" @click="visible = true" />

    <Sidebar v-model:visible="visible">
      <template #container>
        <div class="absolute flex flex-column h-screen px-6">
          <div class="w-full">
            <div
              class="flex align-items-center justify-content-between pt-3.5 pb-10 flex-shrink-0"
            >
              <RouterLink to="/dashboard">
                <AppLogo />
              </RouterLink>
            </div>

            <CreditsCounter v-if="shouldShowCreditsBadge" />
          </div>
          <div class="overflow-y-auto"></div>

          <div class="overflow-y-auto w-full"></div>
          <div class="mt-auto w-full mb-4">
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
