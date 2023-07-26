<template>
  <q-header
    style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(7px)"
    class="q-pt-md q-px-md"
  >
    <q-toolbar class="text-custom q-pa-sm">
      <RouterLink to="/dashboard"><AppLogo /></RouterLink>
      <q-space />
      <q-btn flat class="text-lowercase" @click="settings()">
        {{ user?.email }}</q-btn
      >
      <q-btn class="q-mr-sm" flat round dense icon="logout" @click="logout()" />
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">
import { User } from "@supabase/supabase-js";
import { sse } from "src/helpers/sse";
import { supabase } from "src/helpers/supabase";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppLogo from "./AppLogo.vue";

const router = useRouter();
const user = ref<User | null>(null);

async function logout() {
  await supabase.auth.signOut();
  sse.closeConnection();
  router.push("/");
}

function settings() {
  router.push("/account");
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    user.value = data.session?.user;
  }
});
</script>

<style scoped>
.bg-maincolor {
  background-color: #f8f9fa;
}
.text-custom {
  color: #03c8a8;
}
</style>
