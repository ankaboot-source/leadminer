<template>
  <q-page class="q-pb-sm q-px-xl">
    <SearchEmails />
  </q-page>
</template>

<script setup lang="ts">
import { LocalStorage, useQuasar } from "quasar";
import SearchEmails from "src/components/Emails/SearchEmails.vue";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "../store/index";

const $store = useStore();
const $quasar = useQuasar();
const $router = useRouter();

onMounted(() => {
  const fragmentIdentifier = window.location.hash.split("#")[1];
  const parameters = new URLSearchParams(
    fragmentIdentifier || window.location.search
  );

  if (!parameters) {
    return;
  }
  const {
    id,
    email,
    access_token: accessToken,
    error,
  } = Object.fromEntries(parameters);

  if (id && email && accessToken) {
    $store.commit("leadminer/SET_USER_CREDENTIALS", {
      id,
      email,
      accessToken,
    });
    LocalStorage.set("user", $store.state.leadminer.user);
  }

  if (error) {
    $quasar.notify({
      message: error,
      color: "red",
      icon: "error",
      actions: [
        {
          label: "OK",
          color: "white",
        },
      ],
    });
    $router.push("/");
  }
});
</script>
