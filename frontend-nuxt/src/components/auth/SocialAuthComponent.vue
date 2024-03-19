<template>
  <div class="grid gap-6">
    <OAuthButton
      label="Continue with Google"
      icon="pi pi-google"
      class="w-full text-h6"
      size="large"
      source="google"
    />
    <OAuthButton
      label="Continue with Microsoft"
      icon="pi pi-microsoft"
      class="w-full text-h6"
      size="large"
      source="azure"
    />
  </div>
</template>

<script setup lang="ts">
import OAuthButton from '@/components/button/OAuthButton.vue';
</script>
