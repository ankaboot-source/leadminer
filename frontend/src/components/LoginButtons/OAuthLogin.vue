<template>
  <q-btn
    :disable="isLoading"
    class="text-weight-regular"
    label="Start Mining"
    no-caps
    color="teal"
    :loading="isLoading"
    @click="handleClickSignIn"
  />
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import { api } from "src/boot/axios";
import { GENERIC_ERROR_MESSAGE_NETWORK_ERROR } from "src/constants";
import { ref } from "vue";
import { AxiosError } from "axios";

const props = defineProps({
  oauthProvider: {
    required: true,
    type: String,
  },
});
const isLoading = ref(false);
const $quasar = useQuasar();

async function handleClickSignIn() {
  isLoading.value = true;

  const frontendCallbackURL = `${window.location.origin}/dashboard`;
  const params: Record<string, string> = {
    provider: props.oauthProvider as string,
    redirect_to: frontendCallbackURL,
    nosignup: "true", // Set to false when integrating gotrue auth table.
  };
  const backendAuthorizationURL = `${api.getUri()}/oauth/authorize?${new URLSearchParams(
    params
  ).toString()}`;

  try {
    const response = await api.get(backendAuthorizationURL);
    const { data, error } = response.data;

    if (error) {
      throw error;
    }

    const { authorizationURL } = data;
    window.location.assign(authorizationURL);
  } catch (err) {
    if (err !== null && err instanceof AxiosError) {
      let message = null;
      const error = err.response?.data?.error || err;

      if (error.message?.toLowerCase() === "network error") {
        message = GENERIC_ERROR_MESSAGE_NETWORK_ERROR;
      } else {
        message = error.message;
      }

      $quasar.notify({
        message,
        color: "red",
        icon: "error",
        actions: [
          {
            label: "ok",
            color: "white",
          },
        ],
      });
    }
  }
  isLoading.value = false;
}
</script>
