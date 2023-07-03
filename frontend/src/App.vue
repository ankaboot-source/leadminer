<template>
  <router-view />
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { api } from "./boot/axios";
import { supabase } from "./helpers/supabase";

const $router = useRouter();

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    api.defaults.headers.common["x-sb-jwt"] = `${session.access_token}`;
  }
  if (event === "SIGNED_IN") {
    // All future API calls will be linked to the signed in user
    $router.push("/dashboard");
  }
  if (event === "SIGNED_OUT") {
    $router.push("/");
  }
});
</script>
