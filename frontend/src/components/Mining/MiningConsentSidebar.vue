<template>
  <Drawer
    v-model:visible="show"
    class="h-auto"
    :position="$screenStore.size.sm ? 'top' : 'full'"
    :dismissable="false"
    :show-close-icon="false"
    :block-scroll="true"
    :header="t('authorization_required')"
    pt:footer:class="pt-0 flex justify-end gap-2"
    pt:content:class="grid gap-4 px-8 pt-4 text-base"
  >
    <span>
      {{ t('authorization_declined') }}
      {{ t('no_authorization_contacts') }}
    </span>
    <div>
      {{ $t('common.support_assistance') }}
      <NuxtLink class="text-indigo-500" to="mailto:support@leadminer.io">
        support@leadminer.io.
      </NuxtLink>
      {{ t('keep_data_secure') }}
    </div>
    <template #footer>
      <Button
        severity="secondary"
        class="secondary-button capitalize"
        :label="$t('common.cancel')"
        @click="close()"
      />
      <Button
        severity="primary"
        class="capitalize"
        :label="t('authorize')"
        @click="refreshOAuth"
      />
    </template>
  </Drawer>
</template>

<script setup lang="ts">
import type { MiningSourceType, OAuthMiningSource } from '@/types/mining';

const { t } = useI18n({
  useScope: 'local',
});

const show = defineModel<boolean>('show');
const $screenStore = useScreenStore();
const $imapDialogStore = useImapDialog();

const provider = defineModel<MiningSourceType>('provider');

function close() {
  show.value = false;
  useMiningStepper().go(1);
}
function showImapDialog() {
  $imapDialogStore.showImapDialog = true;
  close();
}
function refreshOAuth() {
  if (provider.value === 'imap') {
    showImapDialog();
  } else {
    addOAuthAccount(provider.value as OAuthMiningSource);
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "authorize": "authorize",
    "authorization_required": "🔐 Authorization Required",
    "authorization_declined": "Your permission is required so that we can access your mailbox to extract contacts.",
    "no_authorization_contacts": "Without authorization, we are unable to extract contacts from your mailbox.",
    "keep_data_secure": "Keep your data secure and take control of your contacts!🔒💪"
  },
  "fr": {
    "authorize": "autoriser",
    "authorization_required": "🔐 Autorisation Requise",
    "authorization_declined": "Votre autorisation est indispensable pour que nous puissions accéder à votre boîte aux lettres afin d'en extraire des contacts.",
    "no_authorization_contacts": "Sans autorisation, nous ne pouvons pas extraire les contacts de votre boîte aux lettres.",
    "keep_data_secure": "Protégez vos données et reprenez le contrôle de vos contacts !🔒💪"
  }
}
</i18n>
