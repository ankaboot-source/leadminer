<template>
  <q-header
    style="background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(7px)"
  >
    <q-toolbar class="text-custom q-pa-sm">
      <q-chip size="xl" color="transparent" text-color="teal">
        <q-avatar class="logo q-mt-xs" text-color="white" size="28px">
          <img src="icons/favicon-128x128.png" />
        </q-avatar>
        Leadminer
      </q-chip>
      <q-space />

      <q-btn flat class="text-lowercase"> {{ user?.email }}</q-btn>
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

const router = useRouter();
const user = ref<User | null>(null);

async function logout() {
  await supabase.auth.signOut();
  sse.closeConnection();
  router.push("/");
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    user.value = data.session?.user;
  }
});
</script>

<style>
.bg-maincolor {
  background-color: #f8f9fa;
}
.text-custom {
  color: #03c8a8;
}
.logo {
  animation: animation 3s infinite;
}

@keyframes animation {
  10% {
    transform: rotate(110deg);
  }

  50% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(0deg);
  }
}
</style>
