<template>
  <div class="flex flex-col space-y-4">
    <div>
      <OAuthButton
        label="Continue with Google"
        icon="pi pi-google"
        class="w-full"
        source="google"
      />
    </div>
    <div>
      <OAuthButton
        label="Continue with Microsoft"
        icon="pi pi-microsoft"
        class="w-full"
        source="azure"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import OAuthButton from '@/components/auth/OAuthButton.vue';
</script>
