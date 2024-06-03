<template>
  <div class="grid gap-4 md:flex md:gap-0">
    <div
      v-tooltip.bottom="{
        value: `${CREDITS_PER_CONTACT} credit per contact`,
        showDelay: 0,
        hideDelay: 300,
      }"
    >
      <Button
        class="flex justify-center w-full cursor-default md:rounded-r-none"
        :class="creditsBadgeState"
        outlined
      >
        <PhosphorCoin class="h-6 mr-2" />
        <span :class="creditsBadgeTextAnimation" class="font-semibold text-sm">
          {{ formattedCredits }}
        </span>
      </Button>
    </div>
    <Button
      class="flex space-x-1 items-center justify-center md:rounded-l-none"
      severity="contrast"
      size="small"
      @click="refillCreditsOrUpgrade"
    >
      <span class="font-semibold">Refill</span>
      <span class="material-icons" style="font-size: 1.3rem">
        rocket_launch
      </span>
    </Button>
  </div>
  <Toast group="lowCredit">
    <template #message="slotProps">
      <i class="pi pi-exclamation-triangle text-lg" />
      <span class="p-toast-message-text">
        <span class="p-toast-summary"> {{ slotProps.message.summary }}</span>
        <div class="p-toast-detail">
          {{ slotProps.message.detail }}
        </div>
        <Button
          class="flex space-x-1 items-center justify-center justify-self-end ml-auto mt-1.5"
          severity="contrast"
          @click="refillCreditsOrUpgrade, $toast.removeGroup('lowCredit')"
        >
          <span class="font-semibold">Refill</span>
          <span class="material-icons" style="font-size: 1.3rem">
            rocket_launch
          </span>
        </Button>
      </span>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import {
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import {
  CREDITS_MIN_THRESHOLD,
  CREDITS_PER_CONTACT,
  refillCreditsOrUpgrade,
} from '@/utils/credits';
import type { Profile } from '~/types/user';
import PhosphorCoin from '../icons/PhosphorCoin.vue';

const $toast = useToast();

let subscription: RealtimeChannel;

const creditsRef = ref(0);
const credits = computed(() => creditsRef.value);

const formattedCredits = computed(() =>
  credits.value === 0
    ? 'Out of credit'
    : new Intl.NumberFormat().format(credits.value)
);
const creditsBadgeState = computed(() =>
  credits.value >= CREDITS_MIN_THRESHOLD
    ? 'text-black border-gray-400'
    : 'text-red-700  border border-red-700'
);
const creditsBadgeTextAnimation = computed(() =>
  credits.value < CREDITS_MIN_THRESHOLD ? 'flash-animation' : ''
);

onMounted(async () => {
  const profile = (
    await useSupabaseClient().from('profiles').select('*').single()
  ).data as unknown as Profile;
  creditsRef.value = profile.credits;
  const user = useSupabaseUser().value;
  subscription = useSupabaseClient()
    .channel('credits')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user?.id}`,
      },
      (payload: RealtimePostgresChangesPayload<Profile>) => {
        const newProfile = payload.new as Profile;
        creditsRef.value = newProfile.credits;
      }
    );
  subscription.subscribe();
});

onUnmounted(() => {
  subscription.unsubscribe();
});

watch(credits, (newVal: number) => {
  if (newVal === 0) {
    $toast.add({
      severity: 'warn',
      summary: 'Insufficient credits',
      detail: 'Your current balance is empty. Please refill.',
      life: 3000,
    });
  } else if (newVal < CREDITS_MIN_THRESHOLD) {
    $toast.add({
      severity: 'warn',
      summary: 'Low credits',
      detail: 'Running low on credits. Remember to refill.',
      group: 'lowCredit',
      life: 10000,
    });
  }
});
</script>
