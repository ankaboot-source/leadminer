<template>
  <q-btn
    :disable="disable || isLoading"
    class="text-weight-regular"
    label="Start Mining"
    no-caps
    color="teal"
    :loading="isLoading"
    @click="handleClickSignIn"
  />
</template>

<script lang="ts">
import { useQuasar } from "quasar";
import { api } from "src/boot/axios";

export default {
  name: "OauthLogin",
  props: {
    disable: Boolean,
    oauthProvider: { type: String, required: true },
  },

  data() {
    return {
      user: "",
      quasar: useQuasar(),
      isLoading: false,
    };
  },

  methods: {
    handleClickSignIn() {
      this.isLoading = true;

      const frontendCallbackURL = `${window.location.origin}/`;
      const params: Record<string, string> = {
        provider: this.oauthProvider,
        redirect_to: frontendCallbackURL,
        nosignup: "true", // Set to false when integrating gotrue auth table.
      };
      const backendAuthorizationURL = `${api.getUri()}/oauth/authorize?${new URLSearchParams(
        params
      ).toString()}`;

      try {
        api.get(backendAuthorizationURL).then((response) => {
          const { data, error } = response.data;
          if (error) {
            throw error;
          }

          const { authorizationURL } = data;

          window.location.assign(authorizationURL);
        });
      } catch (error) {
        console.error(error);
      }
    },
  },
};
</script>
