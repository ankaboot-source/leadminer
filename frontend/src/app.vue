<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <NuxtPwaManifest />
  <Toast />
  <Toast group="achievement">
    <template #messageicon>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M7.8016 4.82147C7.76057 4.85934 7.75 4.89567 7.75 4.92308V10.4615C7.75 11.8612 8.13622 13.0615 8.83337 13.8975C9.51569 14.7157 10.5479 15.25 12 15.25C13.4521 15.25 14.4843 14.7157 15.1666 13.8975C15.8638 13.0615 16.25 11.8612 16.25 10.4615V4.92308C16.25 4.89567 16.2394 4.85934 16.1984 4.82147C16.1564 4.78266 16.0881 4.75 16 4.75H8C7.91188 4.75 7.84365 4.78266 7.8016 4.82147ZM6.25 4.92308C6.25 3.94367 7.09116 3.25 8 3.25H16C16.9088 3.25 17.75 3.94367 17.75 4.92308V5.25H19C19.9665 5.25 20.75 6.0335 20.75 7V9C20.75 10.9082 19.2233 12.4212 17.4427 12.7029C17.2081 13.5033 16.8364 14.2373 16.3186 14.8582C15.4663 15.8803 14.2587 16.5455 12.75 16.7101V19.25H15C15.4142 19.25 15.75 19.5858 15.75 20C15.75 20.4142 15.4142 20.75 15 20.75H9C8.58579 20.75 8.25 20.4142 8.25 20C8.25 19.5858 8.58579 19.25 9 19.25H11.25V16.7101C9.7413 16.5455 8.53371 15.8803 7.68135 14.8582C7.1636 14.2373 6.79194 13.5033 6.55731 12.7029C4.77669 12.4212 3.25 10.9082 3.25 9V7C3.25 6.0335 4.0335 5.25 5 5.25H6.25V4.92308ZM6.25 6.75H5C4.86193 6.75 4.75 6.86193 4.75 7V9C4.75 9.90973 5.39429 10.7382 6.27176 11.082C6.25721 10.877 6.25 10.67 6.25 10.4615V6.75ZM17.7282 11.082C18.6057 10.7382 19.25 9.90973 19.25 9V7C19.25 6.86193 19.1381 6.75 19 6.75H17.75V10.4615C17.75 10.67 17.7428 10.877 17.7282 11.082Z"
          fill="black"
        />
      </svg>
    </template>
  </Toast>

  <Toast group="enrich-info">
    <template #messageicon>
      <span class="text-xl">☕️</span>
    </template>
  </Toast>

  <Toast group="has-links">
    <template #message="slotProps">
      <i class="pi pi-info-circle" />
      <div class="p-toast-message-text" data-pc-section="messagetext">
        <span class="p-toast-summary" data-pc-section="summary">
          {{ slotProps.message.summary }}
        </span>
        <div class="p-toast-detail" data-pc-section="detail">
          <template
            v-for="(detail, index) in (slotProps.message
              .detail as ToastHasLinksGroupDetail[]) ?? []"
            :key="index"
          >
            <a
              v-if="detail.link"
              :href="detail.link"
              class="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ detail.text }}
            </a>
            <div v-else>
              {{ detail.text }}
            </div>
          </template>
        </div>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import { signOutManually } from './utils/auth';
import { reloadNuxtApp } from 'nuxt/app';
import { useIdle } from '@vueuse/core';
const user = useSupabaseUser();
const $leadminerStore = useLeadminerStore();
const activeMiningTask = computed(() => $leadminerStore.activeMiningTask);
const $supabaseClient = useSupabaseClient();
const { idle, reset } = useIdle(30 * 60 * 1000); // 30 min timeout
$supabaseClient.auth.onAuthStateChange((event) => {
  switch (event) {
    case 'SIGNED_OUT':
      signOutManually();
      reloadNuxtApp({ persistState: false, force: true });
      break;
    default:
      break;
  }
});
watch(idle, (isIdle) => {
  if (isIdle && !activeMiningTask.value && user.value) {
    signOut();
    reloadNuxtApp({ persistState: false, force: true });
  }
});

watch(activeMiningTask, () => {
  reset();
});

type ToastHasLinksGroupDetail = {
  text: string;
  link?: string;
};
</script>
