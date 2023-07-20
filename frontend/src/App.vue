<template>
  <router-view v-slot="{ Component }">
    <transition
      enter-active-class="animated fadeIn"
      leave-active-class="animated fadeOut"
      appear
      :duration="300"
    >
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { api } from "./boot/axios";
import { supabase } from "./helpers/supabase";
import { useLeadminerStore } from "./store/leadminer";

const SKIP_DASHBOARD_REDIRECT = ["/oauth-consent-error", "/account"];
const $router = useRouter();
const $store = useLeadminerStore();

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    // All future API calls will be linked to the signed in user
    api.defaults.headers.common["x-sb-jwt"] = `${session.access_token}`;
  }

  if (
    event === "SIGNED_IN" &&
    !SKIP_DASHBOARD_REDIRECT.includes($router.currentRoute.value.path)
  ) {
    $router.push("/dashboard");
  }

  if (event === "SIGNED_OUT") {
    $router.push("/");
    $store.$reset();
  }
});
</script>
