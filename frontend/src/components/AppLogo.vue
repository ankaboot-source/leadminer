<template>
  <div class="flex">
    <Image class="logo mt-1" image-class="size-8" src="/icons/pickaxe.svg" />
    <Image class="ml-2" image-class="w-40" src="/logo/LogoWithoutIcon.png" />
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
