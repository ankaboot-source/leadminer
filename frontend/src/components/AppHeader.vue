<template>
  <div class="py-3.5 flex justify-between bg-white md:bg-transparent">
    <AppLogo class="cursor-pointer" @click="navigateHome()" />

    <template v-if="$user">
      <div id="desktop-navbar" class="hidden md:flex md:items-center md:gap-1">
        <component :is="CreditsCounter" />
        <Button
          class="text-lowercase"
          text
          @click="navigateTo('/account/settings')"
        >
          {{ $user?.email }}
        </Button>
        <Button
          icon="pi pi-sign-out"
          text
          class="sign-out-button"
          @click="signOut"
        />
      </div>
      <div id="mobile-navbar" class="flex md:hidden">
        <Button class="md:hidden" icon="pi pi-bars" @click="visible = true" />
        <Drawer v-model:visible="visible" class="p-3.5">
          <template #container="{ closeCallback }">
            <Button unstyled class="flex flex-column" @click="closeCallback">
              <NuxtLink to="/dashboard">
                <AppLogo />
              </NuxtLink>
            </Button>

            <div class="overflow-y-auto mt-10">
              <component :is="CreditsCounter" />
            </div>
            <div class="mt-auto w-full">
              <Button
                class="w-full pl-10 text-lowercase justify-center"
                text
                @click="closeCallback"
              >
                <NuxtLink to="/account/settings">
                  {{ $user?.email }}
                </NuxtLink>
              </Button>
              <Button class="w-full flex justify-center gap-2" @click="signOut">
                {{ $t('auth.sign_out') }}
                <i class="pi pi-sign-out"></i>
              </Button>
            </div>
          </template>
        </Drawer>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import AppLogo from './AppLogo.vue';
const $user = useSupabaseUser();
const $router = useRouter();
const visible = ref(false);
function navigateHome() {
  const homePath = '/dashboard';
  if ($router.currentRoute.value.path === homePath) {
    $router.go(0); // reload the page
  } else {
    $router.push(homePath);
  }
}
</script>
