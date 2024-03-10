<template>
  <div class="h-screen w-screen">
    <div class="absolute top-4 left-4">
      <AppLogo />
    </div>
    <div class="grid h-full place-items-center place">
      <slot></slot>
    </div>
  </div>
</template>

<script>
import AppLogo from "~/components/AppLogo.vue";
</script>
