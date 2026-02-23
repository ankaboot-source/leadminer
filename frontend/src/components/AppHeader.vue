<template>
  <div class="py-3.5 flex justify-between bg-white lg:bg-transparent">
    <template v-if="showAuthenticatedNavigation">
      <AppLogo class="cursor-pointer" @click="navigateHome()" />
      <Button
        icon="pi pi-users"
        :label="$t('common.contacts')"
        outlined
        class="ml-4 border-b-2 border-0 rounded-sm invisible lg:visible hover:border-primary"
        :class="{
          'border-primary': $router.currentRoute.value.path === contactsPath,
        }"
        @click="navigateTo(contactsPath)"
      />
      <Button
        icon="pi pi-envelope"
        outlined
        class="ml-4 border-b-2 border-0 rounded-sm invisible lg:visible hover:border-primary"
        :class="{
          'border-primary': $router.currentRoute.value.path === sourcesPath,
        }"
        type="button"
        :label="$t('common.sources')"
        @click="navigateTo(sourcesPath)"
      />
      <div class="grow" />
      <div id="desktop-navbar" class="hidden lg:flex lg:items-center lg:gap-1">
        <Button
          type="button"
          :label="$t('common.start_mining')"
          :disabled="
            $leadminerStore.activeMiningTask ||
            $leadminerStore.isLoadingStartMining
          "
          @click="navigateToMine()"
        />
        <div class="ml-4">
          <component :is="CreditsCounter" />
        </div>
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
      <div id="mobile-navbar" class="flex lg:hidden">
        <Button class="lg:hidden" icon="pi pi-bars" @click="visible = true" />
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
              class="border-l-4 border-0 rounded-sm"
              :class="{
                'border-primary bg-primary-50':
                  $router.currentRoute.value.path === contactsPath,
              }"
              @click="
                navigateTo(contactsPath);
                closeCallback();
              "
            />

            <Button
              type="button"
              :label="$t('common.start_mining')"
              @click="
                navigateToMine();
                closeCallback();
              "
            />

            <div class="mt-10">
              <component :is="CreditsCounter" />
            </div>
            <div class="mt-auto w-full">
              <Button class="w-full justify-center" text @click="closeCallback">
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
const $route = useRoute();
const $router = useRouter();
const $contactsStore = useContactsStore();
const $stepper = useMiningStepper();
const $sourcePanelStore = useStepperSourcePanel();
const $leadminerStore = useLeadminerStore();
const visible = ref(false);
const contactsPath = '/contacts';
const minePath = '/mine';
const sourcesPath = '/sources';
const isAuthRoute = computed(() => $route.path.startsWith('/auth'));
const showAuthenticatedNavigation = computed(
  () => Boolean($user.value) && !isAuthRoute.value,
);
const homePath = computed(() =>
  $user.value ? '/' : $contactsStore.contactCount ? contactsPath : minePath,
);

function navigateToMine() {
  // If finished a mining or if already on the mining page, reset the stepper and mining store
  if (
    $leadminerStore.miningStartedAndFinished ||
    $router.currentRoute.value.path === minePath
  ) {
    $stepper.go(1);
    $leadminerStore.$resetMining();
    $sourcePanelStore.hideOtherSources();
  }

  navigateTo(minePath);
}
function navigateHome() {
  if ($router.currentRoute.value.path === homePath.value) {
    $router.go(0); // reload the page
  } else {
    $router.push(homePath.value);
  }
}
</script>
