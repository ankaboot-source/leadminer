<template>
  <q-layout view="lHh Lpr lFf">
    <app-header />
    <q-page-container>
      <q-page padding><slot></slot></q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import AppHeader from "src/components/AppHeader.vue";
</script>
