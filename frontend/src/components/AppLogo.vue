<template>
  <q-chip color="transparent">
    <q-avatar class="logo" size="25px">
      <img src="/icons/favicon-128x128.png" />
    </q-avatar>
    <q-img src="/logo/LogoWithoutIcon.png" width="9rem" />
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
