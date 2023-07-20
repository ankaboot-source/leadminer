<template>
  <q-layout view="lHh Lpr lFf">
    <app-header />
    <q-page-container>
      <q-page :class="pageClass" padding><slot></slot></q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import AppHeader from "src/components/AppHeader.vue";

defineProps<{
  pageClass?: string;
}>();
</script>
