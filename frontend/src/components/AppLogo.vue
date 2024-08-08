<template>
  <div class="flex">
    <NuxtImg class="logo size-8 mt-1" src="/icons/pickaxe.svg" />
    <NuxtImg class="ml-2 w-40" src="/logo/LogoWithoutIcon.png" />
  </div>
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
