<template>
  <q-layout>
    <q-page-container>
      <q-header class="bg-grey-2 q-pt-lg q-px-lg flex" :class="logoPosition">
        <AppLogo />
      </q-header>
      <q-page class="flex justify-center bg-grey-2 q-px-xl">
        <slot></slot>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import AppLogo from "src/components/AppLogo.vue";
import { computed } from "vue";

const $quasar = useQuasar();

const logoPosition = computed(() =>
  $quasar.screen.lt.sm ? "justify-center" : "justify-start"
);
</script>
