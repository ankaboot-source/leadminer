<template>
  <q-dialog v-model="show" position-class="q-dialog--standard">
    <q-card>
      <q-card-section class="q-pa-md text-center">
        <h2 class="popup-title text-h5">🎉 Welcome to your Dashboard! 🎉</h2>
        <p class="popup-message">
          To unlock amazing features, we kindly ask for extra permissions.
        </p>
        <div class="oauth-buttons q-mt-md">
          <q-btn
            class="oauth-button outlook"
            flat
            color="primary"
            icon="fab fa-microsoft"
            label="Connect with outlook"
            @click.prevent="
              redirectToOAuth(
                'azure',
                'offline_access https://outlook.office.com/IMAP.AccessAsUser.All'
              )
            "
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { api } from "src/boot/axios";
import { showNotification } from "src/helpers/notification";
import { ProviderName } from "src/types/providers";
import { ref } from "vue";

const show = ref(true);

async function redirectToOAuth(provider: ProviderName, optionalScope?: string) {
  try {
    const params: {
      provider: ProviderName;
      no_signup: true;
      redirect_to?: string;
      scopes?: string;
    } = {
      provider,
      no_signup: true,
      redirect_to: `${window.location.origin}/dashboard`,
    };

    if (optionalScope) {
      params.scopes = optionalScope;
    }

    const response = await api.get("/oauth/authorize", { params });
    const { url } = response.data.data;

    window.location.href = url;
  } catch (error) {
    if (error instanceof Error) {
      showNotification(error.message, 'red', 'error');
    }
  }
}
</script>
