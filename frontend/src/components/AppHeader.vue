<template>
  <div class="py-3.5 flex justify-between bg-white md:bg-transparent">
    <template v-if="$user">
      <AppLogo class="cursor-pointer" @click="navigateHome()" />
      <Button
        icon="pi pi-users"
        :label="$t('common.contacts')"
        outlined
        class="ml-2 border-x-0 border-t-0 invisible md:visible rounded-sm"
        :class="{
          'border-primary': $router.currentRoute.value.path === contactsPath,
        }"
        @click="navigateTo(contactsPath)"
      />
      <div class="grow" />
      <div id="desktop-navbar" class="hidden md:flex md:items-center md:gap-1">
        <Button outlined type="button" @click="navigateToMine()">
          <Image image-class="size-4" src="/icons/pickaxe.svg" />
          {{ $t('common.mine') }}
        </Button>
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
        <Drawer v-model:visible="visible" class="p-3.5 gap-4">
          <template #container="{ closeCallback }">
            <Button unstyled class="flex flex-column" @click="closeCallback">
              <NuxtLink :to="homePath">
                <AppLogo />
              </NuxtLink>
            </Button>

            <Button
              icon="pi pi-users"
              :label="$t('common.contacts')"
              outlined
              :class="{
                'border-primary':
                  $router.currentRoute.value.path === contactsPath,
              }"
              @click="
                navigateTo(contactsPath);
                closeCallback();
              "
            />

            <Button
              outlined
              type="button"
              @click="
                navigateTo(minePath);
                closeCallback();
              "
            >
              <Image image-class="size-4" src="/icons/pickaxe.svg" />
              {{ $t('common.mine') }}
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
    <template v-else>
      <AppLogo class="cursor-pointer" @click="navigateHome()" />
    </template>
  </div>
</template>

<script setup lang="ts">
import AppLogo from './AppLogo.vue';
const $user = useSupabaseUser();
const $router = useRouter();
const $contactsStore = useContactsStore();
const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();
const visible = ref(false);
const contactsPath = '/contacts';
const minePath = '/mine';
const homePath = $user
  ? '/'
  : $contactsStore.contactCount
    ? contactsPath
    : minePath;

function navigateToMine() {
  if ($leadminerStore.miningStartedAndFinished) {
    $stepper.$reset();
    $leadminerStore.$resetMining();
  }

  navigateTo(minePath);
}
function navigateHome() {
  if ($router.currentRoute.value.path === homePath) {
    $router.go(0); // reload the page
  } else {
    $router.push(homePath);
  }
}
</script>
