<template>
  <q-layout view="lHh Lpr lFf">
    <q-header>
      <q-toolbar class="bg-white text-custom no-shadow">
        <q-chip size="xl" color="transparent" text-color="teal">
          <q-avatar class="logo" text-color="white" size="28px">
            <img src="icons/favicon-128x128.png" />
          </q-avatar>
          Leadminer
        </q-chip>
        <q-space />
        <q-btn @click="logout()" flat round dense icon="logout" />
      </q-toolbar>
    </q-header>

    <q-page-container class="bg-transparent">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { defineComponent, ref } from "vue";
import { LocalStorage } from "quasar";

export default defineComponent({
  name: "MainLayout",

  setup() {
    const leftDrawerOpen = ref(false);

    return {
      leftDrawerOpen,
    };
  },
  methods: {
    logout() {
      LocalStorage.clear();
      this.$router.push("/");
    },
  },
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
