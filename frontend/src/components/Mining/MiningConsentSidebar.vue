<template>
  <Drawer
    v-model:visible="show"
    class="h-auto"
    :position="$screenStore.size.sm ? 'top' : 'full'"
    :dismissable="false"
    :show-close-icon="false"
    :block-scroll="true"
    :header="t('authorization_required')"
    pt:footer:class="pt-0"
  >
    <div class="grid gap-4 px-8 pt-4 text-base">
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
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
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
      </div>
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
  switch (provider.value) {
    case 'google':
    case 'azure':
      signInWithOAuth(provider.value as OAuthMiningSource);
      break;
    default:
      showImapDialog();
      break;
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "authorize": "authorize",
    "authorization_required": "🔐 Authorization Required",
    "authorization_declined": "It seems like you have declined to grant authorization for us to access your mailbox.",
    "using": "using",
    "no_authorization_contacts": "Without authorization, we are unable to extract contacts from your mailbox.",
    "keep_data_secure": "Keep your data secure and take control of your contact mining journey!🔒💪"
  },
  "fr": {
    "authorize": "autoriser",
    "authorization_required": "🔐 Autorisation Requise",
    "authorization_declined": "Il semble que vous ayez refusé d'accorder l'autorisation pour que nous puissions accéder à votre boîte aux lettres.",
    "using": "utilisant",
    "no_authorization_contacts": "Sans autorisation, nous ne pouvons pas extraire les contacts de votre boîte aux lettres.",
    "keep_data_secure": "Protégez vos données et prenez le contrôle de votre parcours d'extraction de contacts !🔒💪"
  }
}
</i18n>
