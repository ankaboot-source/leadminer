<template>
  <Sidebar v-model:visible="show" class="h-auto" position="top" :dismissable="false">
    <template #container>
      <div class="grid gap-3 p-8">
        <span class="text-xl font-bold merriweather"
          >🔐 Authorization Required</span
        >
        <span>
          We apologize for the inconvenience. It seems like you have declined to
          grant authorization for us to access your
          <span v-if="provider && provider === 'google'">Google</span>
          <span v-else-if="provider && provider === 'azure'">Outlook</span>
          <span v-else>Google or Outlook</span> mailbox. Without authorization,
          we are unable to extract, clean, and enrich contacts from your
          mailbox.
        </span>

        <Card class="bg-green-50">
          <template #content>
            <div class="grid grid-flow-col gap-3 items-center">
              <img class="size-20" src="/icons/gdpr.png" alt="gdpr-logo" />
              <div>
                <div class="text-lg font-medium">Your data is yours only</div>
                <span>
                  We assure you that we will not use your data commercially or
                  share it with any third parties without your explicit
                  permission. Please be assured that your data will be handled
                  securely and used solely for the purposes of providing you
                  with the best contact mining experience in full compliance
                  with the GDPR.
                  <a
                    href="https://www.leadminer.io/data-privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read our Data Privacy Policy for more information</a
                  >.
                </span>
              </div>
            </div>
          </template>
        </Card>
        <div>
          For any questions or assistance, our support team is here to help at
          <a href="mailto:support@leadminer.io">support@leadminer.io</a>. Keep
          your data secure and take control of your contact mining journey!🔒💪
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
import { type MiningSourceType, type OAuthMiningSource } from '@/types/mining';

const show = defineModel<boolean>('show');
const stepper = defineModel<number>('stepper');
const provider = defineModel<MiningSourceType>('provider');

function close() {
  show.value = false;
  stepper.value = 0;
}

function refreshOAuth() {
  if (provider.value && ['google', 'azure'].includes(provider.value)) {
    addOAuthAccount(provider.value as OAuthMiningSource);
  } else {
    navigateTo('/dashboard');
  }
}
</script>
