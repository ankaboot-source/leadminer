<template>
  <q-page class="q-pb-sm q-px-xl">
    <template v-if="authenticatedUser && !shouldShowDialogue">
      <SearchEmails />
    </template>
    <template v-if="authenticatedUser && shouldShowDialogue">
      <ExtraPermissions />
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { onBeforeMount, computed } from "vue";
import { LocalStorage, useQuasar } from "quasar";
import SearchEmails from "src/components/Emails/SearchEmails.vue";
import { supabaseClient } from "src/helpers/supabase";
import ExtraPermissions from "src/components/Popups/ExtraPermissions.vue";
import { useStore } from "../store/index";

const $store = useStore();
const $quasar = useQuasar();

const authenticatedUser = computed(() => {
  const { accessToken, refreshToken } = $store.state.leadminer.user || {};
  return accessToken && refreshToken;
});

const shouldShowDialogue = computed(() => {
  const {
    providerToken: pToken,
    email,
    host,
    password,
  } = $store.state.leadminer.user || {};
  const needsRequiredToken =
    pToken === undefined && !(email && host && password);
  return needsRequiredToken;
});

onBeforeMount(async () => {
  const fragmentIdentifier = window.location.hash.split("#")[1];
  const parameters = new URLSearchParams(
    fragmentIdentifier || window.location.search
  );

  if (!parameters) {
    return;
  }

  // Remove query params from URL
  window.history.replaceState(
    {},
    document.title,
    window.location.href.split("#")[0]
  );

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_in: expiresIn,
    provider_token: providerToken,
    provider_name: providerName,
    error_description: errorDescription,
    error,
  } = Object.fromEntries(parameters);

  if (accessToken && refreshToken && tokenType && expiresIn) {
    const expiresAt = Math.floor(Date.now() / 1000) + parseInt(expiresIn);
    const { user } = (await supabaseClient.auth.getUser(accessToken)).data;

    if (user) {
      const { id: userId, app_metadata: appMetadata } = user;
      const isAzureProvider = appMetadata.provider === "azure";

      $store.commit("leadminer/SET_USER_CREDENTIALS", {
        id: userId,
        accessToken,
        refreshToken,
        tokenType,
        expiresIn,
        expiresAt,
        providerToken: isAzureProvider ? undefined : providerToken,
        providerName,
      });

      LocalStorage.set("user", $store.state.leadminer.user);
      $quasar.cookies.remove("sb-access-token");
      $quasar.cookies.set("sb-access-token", accessToken);
    }
  } else if (providerToken) {
    $store.commit("leadminer/SET_USER_CREDENTIALS", {
      ...$store.state.leadminer.user,
      providerToken,
    });
    LocalStorage.set("user", $store.state.leadminer.user);
  }

  if (error) {
    $quasar.notify({
      message: `${error} ${errorDescription || ""}`,
      color: "red",
      icon: "error",
      actions: [
        {
          label: "OK",
          color: "white",
        },
      ],
    });
  }
});
</script>
