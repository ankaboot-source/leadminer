<template>
  <div class="flex flex-col space-y-4">
    <div>
      <OAuthButton
        :label="$t('auth.continue_with', { provider: 'Google' })"
        icon="pi pi-google"
        class="w-full"
        source="google"
        :auth-mode="authMode"
      />
    </div>
    <div>
      <OAuthButton
        :label="$t('auth.continue_with', { provider: 'Microsoft' })"
        icon="pi pi-microsoft"
        class="w-full"
        source="azure"
        :auth-mode="authMode"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import OAuthButton from '@/components/auth/OAuthButton.vue';
import type { authModes } from '@/types/auth';
const { authMode } = defineProps<{
  authMode: authModes;
}>();
</script>
