<template>
  <div class="flex">
    <img class="logo h-8 mt-1" src="/icons/pickaxe.svg" />
    <img class="ml-2 h-10 dark:invert" src="/logo/LogoWithoutIcon.png" />
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
