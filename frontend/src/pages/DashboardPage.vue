<template>
  <q-page class="q-pb-sm q-px-xl">
    <SearchEmails />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import SearchEmails from "src/components/Emails/SearchEmails.vue";
import { useStore } from "../store/index";

const $store = useStore();

onMounted(() => {
  const fragmentIdentifier = window.location.hash.split("#")[1];
  const parameters = new URLSearchParams(
    fragmentIdentifier || window.location.search
  );

  if (parameters) {
    const params = {
      id: parameters.get("id"),
      email: parameters.get("email"),
      accessToken: parameters.get("accessToken"),
    };

    const { id, accessToken } = params;

    if (id && accessToken && params.email) {
      $store.commit("leadminer/SET_USER_CREDENTIALS", params);
      localStorage.setItem("user", JSON.stringify($store.state.leadminer.user));
    }
  }
});
</script>
