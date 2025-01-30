<template>
  <div class="py-3.5 flex justify-between bg-white md:bg-transparent">
    <template v-if="$user">
      <AppLogo class="cursor-pointer" @click="navigateHome()" />
      <div id="desktop-navbar" class="hidden md:flex md:items-center md:gap-1">
        <Button text type="button" @click="toggle">
          <Image image-class="size-4" src="/icons/pickaxe.svg" />
          {{ selectedMember ? selectedMember.email : 'Mine' }}
        </Button>

        <Popover ref="op">
          <div class="flex flex-col gap-4">
            <div>
              <span class="font-medium block mb-2">Sources</span>
              <ul class="list-none p-0 m-0 flex flex-col">
                <li
                  v-for="source in sources"
                  :key="source.email"
                  class="flex items-center gap-2 px-2 py-3 hover:bg-emphasis cursor-pointer rounded-border"
                  @click="selectSource(source)"
                >
                  <i :class="source.icon" />
                  <span>{{ source.email }}</span>
                </li>
                <Divider />
                <li
                  class="flex items-center gap-2 px-2 py-3 hover:bg-emphasis cursor-pointer rounded-border"
                  @click="selectSource(null)"
                >
                  Add a new source
                </li>
              </ul>
            </div>
          </div>
        </Popover>

        <Button
          icon="pi pi-users"
          label="Contacts"
          text
          class="contacts-button"
          @click="navigateTo('/contacts')"
        />
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
    <template v-else>
      <AppLogo class="cursor-pointer" @click="navigateHome()" />
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

const op = ref();
const selectedMember = ref(null);
const sources = ref([
  {
    email: 'amy@email.com',
    provider: 'Other',
    icon: 'pi pi-inbox',
  },
  {
    email: 'bernardo@outlook.com',
    provider: 'Microsoft',
    icon: 'pi pi-microsoft',
  },
  {
    email: 'ioni@gmail.com',
    provider: 'Google',
    icon: 'pi pi-google',
  },
]);

const toggle = (event) => {
  op.value.toggle(event);
};

const selectSource = (member) => {
  selectedMember.value = member;
  op.value.hide();
};
</script>
