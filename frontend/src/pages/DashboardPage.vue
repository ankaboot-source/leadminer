<template>
  <q-page class="q-pb-sm q-px-xl">
    <SearchEmails v-if="hasProviderTokenOrIMAP" />
    <transition name="fade">
      <div v-if="showPopup" class="popup">
        <h2 class="popup-title">🎉 Welcome to your Dashboard! 🎉</h2>
        <p class="popup-message">
          To unlock amazing features, we kindly ask for extra permissions. Feel
          free to connect with a different account if you wanted to!
        </p>
        <div class="oauth-buttons">
          <button
            class="oauth-button outlook"
            @click="
              connectWithOAuthPopup(
                'azure',
                'offline_access https://outlook.office.com/IMAP.AccessAsUser.All'
              )
            "
          >
            <i class="fab fa-microsoft"></i>
            Connect with Outlook
          </button>
        </div>
      </div>
    </transition>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LocalStorage, useQuasar } from "quasar";
import SearchEmails from "src/components/Emails/SearchEmails.vue";
import { useRouter } from "vue-router";
import { supabaseClient } from "src/helpers/supabase";
import { api } from "src/boot/axios";
import { ProviderName } from "src/types/providers";
import { useStore } from "../store/index";

const $store = useStore();
const $quasar = useQuasar();
const $router = useRouter();

const showPopup = ref(false);
const hasProviderTokenOrIMAP = ref(false);

const connectWithOAuthPopup = async (
  provider: ProviderName,
  optionalScope?: string
) => {
  try {
    const params: {
      provider: ProviderName;
      nosignup: true;
      redirect_to?: string;
      scopes?: string;
    } = {
      provider,
      nosignup: true,
      redirect_to: `${window.location.origin}/dashboard`,
    };

    if (optionalScope) {
      params.scopes = optionalScope;
    }

    const response = await api.get("/oauth/authorize", { params });
    const { url } = response.data.data;

    // Open the popup with the Outlook consent screen
    const left = window.screenX + (window.outerWidth - 500) / 2;
    const top = window.screenY + (window.outerHeight - 600) / 2.5;
    const popup = window.open(
      url,
      "OAuth Popup",
      `toolbar=no, menubar=no, width=500, height=600, top=${top}, left=${left}`
    );

    const intervalId = setInterval(() => {
      try {
        const successfulCallback = popup?.location.href.includes("dashboard");

        if (!popup) {
          clearInterval(intervalId);
          return;
        }

        if (successfulCallback) {
          const callbackURL = popup.location.href;
          clearInterval(intervalId);
          popup?.close(); // Close the popup
          window.location.href = callbackURL;
        }

        if (popup.closed) {
          clearInterval(intervalId);
        }
      } catch (err) {
        if (!(err instanceof DOMException)) {
          console.error(err);
        }
      }
    }, 500);
  } catch (error) {
    console.error(error);
  }
};

onMounted(async () => {
  const fragmentIdentifier = window.location.hash.split("#")[1];
  const parameters = new URLSearchParams(
    fragmentIdentifier || window.location.search
  );

  if (!parameters) {
    return;
  }

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
    const user = (await supabaseClient.auth.getUser(accessToken)).data?.user;

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

    $router.push("/");
  }

  const hasImapCredentials = !!$store.state.leadminer.imapCredentials;
  hasProviderTokenOrIMAP.value =
    !!$store.state.leadminer.user.providerToken || hasImapCredentials;
  showPopup.value = !hasProviderTokenOrIMAP.value;

  // Clean URL from callback parameters
  $router.replace({ query: undefined });
});
</script>

<style scoped>
.popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.3);
}

.popup-title {
  font-weight: bold;
  font-size: 24px;
  margin-bottom: 10px;
}

.popup-message {
  font-size: 16px;
  margin-bottom: 20px;
}

.oauth-buttons {
  display: flex;
  justify-content: center;
}

.oauth-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  color: #555;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  margin: 0 10px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.oauth-button:hover {
  background-color: #f1f1f1;
}

.oauth-button i {
  margin-right: 8px;
}

.oauth-button.outlook {
  background-color: #0072c6;
  color: #fff;
}

.oauth-button.outlook:hover {
  background-color: #005fa3;
}

.oauth-button.google {
  background-color: #dd4b39;
  color: #fff;
}

.oauth-button.google:hover {
  background-color: #c23321;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
