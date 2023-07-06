<template>
  <q-chip size="xl" color="transparent" text-color="teal">
    <q-avatar class="logo q-mt-xs" size="30px">
      <img src="/icons/favicon-128x128.png" />
    </q-avatar>
    <q-icon name="img:/logo/LogoWithoutIcon.png" class="text-h5 full-width" />
  </q-chip>
</template>
<style>
.logo {
  animation: animation 3s infinite;
}

@keyframes animation {
  10% {
    transform: rotate(-50deg);
  }

  50% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(0deg);
  }
}
</style>
