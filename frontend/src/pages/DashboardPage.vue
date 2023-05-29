<template>
  <q-page class="q-pb-sm q-px-xl">
    <SearchEmails />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useQuasar } from "quasar";
import { useRouter } from "vue-router";
import SearchEmails from "src/components/Emails/SearchEmails.vue";
import { useStore } from "../store/index";

const $store = useStore();
const $quasar = useQuasar();
const $router = useRouter();

onMounted(() => {
  const fragmentIdentifier = window.location.hash.split("#")[1];
  const parameters = new URLSearchParams(
    fragmentIdentifier || window.location.search
  );

  if (parameters) {
    const {
      id,
      email,
      access_token: accessToken,
      error,
    } = Object.fromEntries(parameters);

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
    } else if (id && email && accessToken) {
      $store.commit("leadminer/SET_USER_CREDENTIALS", {
        id,
        email,
        accessToken,
      });
      localStorage.setItem("user", JSON.stringify($store.state.leadminer.user));
    }
  }
});
</script>
