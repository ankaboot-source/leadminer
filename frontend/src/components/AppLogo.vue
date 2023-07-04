<template>
  <q-chip size="xl" color="transparent" text-color="teal">
    <q-avatar class="logo q-mt-xs" size="40px">
      <img src="icons/favicon-128x128.png" />
    </q-avatar>
    <span class="text-h5">𝗹𝗲𝗮𝗱𝗺𝗶𝗻𝗲𝗿</span>
  </q-chip>
</template>
<style>
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
