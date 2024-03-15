<template>
  <q-layout view="lHh Lpr lFf">
    <app-header />
    <q-page-container>
      <q-page padding>
        <slot />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
</script>
