<template>
  <q-layout>
    <q-page-container>
      <q-header class="bg-grey-2 q-pt-lg q-pl-lg flex items-center row">
        <AppLogo />
      </q-header>
      <q-page class="flex justify-center bg-grey-2">
        <slot></slot>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<script setup lang="ts">
import AppLogo from "src/components/AppLogo.vue";
</script>
