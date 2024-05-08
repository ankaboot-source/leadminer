<template>
  <Sidebar
    v-model:visible="show"
    class="h-auto"
    position="top"
    :dismissable="false"
  >
    <template #container>
      <div class="grid gap-4 px-8 py-4 text-base">
        <span class="text-lg md:text-xl font-bold merriweather">
          🔐 Authorization Required
        </span>
        <span>
          It seems like you have declined to grant authorization for us to
          access your
          <span v-if="provider === MiningSources.GOOGLE">Google mailbox</span>
          <span v-else-if="provider === MiningSources.AZURE"
            >Outlook mailbox</span
          >
          <span v-else-if="provider === MiningSources.IMAP"
            >mailbox using IMAP</span
          >

          <span v-else>Google or Outlook mailbox</span>. Without authorization,
          we are unable to extract contacts from your mailbox.
        </span>
        <div>
          For any questions or assistance, our support team is here to help at
          <NuxtLink class="text-indigo-500" to="mailto:support@leadminer.io">
            support@leadminer.io.
          </NuxtLink>
          Keep your data secure and take control of your contact mining
          journey!🔒💪
        </div>

        <div class="flex justify-end gap-2">
          <Button
            severity="secondary"
            class="secondary-button"
            label="Cancel"
            @click="close()"
          />
          <Button severity="primary" label="Authorize" @click="refreshOAuth" />
        </div>
      </div>
    </template>
  </Sidebar>
</template>
<script setup lang="ts">
import { MiningSources, type OAuthMiningSource } from '@/types/mining';

const show = defineModel<boolean>('show');
const provider = defineModel<MiningSources>('provider');

function close() {
  show.value = false;
  useMiningStepper().go(0);
}

function refreshOAuth() {
  switch (provider.value) {
    case MiningSources.GOOGLE:
    case MiningSources.AZURE:
      addOAuthAccount(provider.value as OAuthMiningSource);
      break;
    default:
      close();
      break;
  }
}
</script>
