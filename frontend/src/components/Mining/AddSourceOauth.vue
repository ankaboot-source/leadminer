<template>
  <q-btn
    :icon="icon"
    :label="label"
    unelevated
    outline
    no-caps
    @click="addOAuthSource(source)"
  />
</template>
<script setup lang="ts">
import { OAuthMiningSource } from "src/types/mining";
import { addOAuthAccount } from "src/helpers/oauth";
import { useQuasar } from "quasar";

const $quasar = useQuasar();

const { label, icon, source } = defineProps<{
  label: string;
  icon: string;
  source: OAuthMiningSource;
}>();

async function addOAuthSource(provider: OAuthMiningSource) {
  try {
    await addOAuthAccount(provider);
  } catch (error) {
    if (error instanceof Error) {
      const message =
        error.message?.toLowerCase() === "network error"
          ? "Unable to access server. Please retry again or contact your service provider."
          : error.message;
      $quasar.notify({
        message,
        color: "negative",
        icon: "error",
      });
    }
  }
}
</script>
