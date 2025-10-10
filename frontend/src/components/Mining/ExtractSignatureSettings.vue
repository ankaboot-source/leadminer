<template>
  <div>
    <!-- Toggle -->
    <div class="flex flex-row items-center gap-2 pb-4">
      <ToggleSwitch
        v-model="$leadminerStore.extractSignatures"
        input-id="extractSignatures"
      />
      <label for="extractSignatures" class="cursor-pointer flex-1">
        {{ t('extract_signatures_option') }}
        <span class="">{{ t('extract_signatures_sub') }}</span>
      </label>
    </div>

    <!-- Slider -->
    <div
      v-if="$leadminerStore.extractSignatures"
      class="flex flex-col items-center pl-12"
    >
      <div class="w-full">
        <div class="flex items-center justify-between mb-1">
          <div class="text-xs text-emerald-600">
            {{ displayLabel }}
          </div>
        </div>

        <Slider
          v-model="$leadminerStore.filterBodySize"
          :min="100"
          :max="maxBodySize"
          :step="120"
          class="w-full [&_.p-slider-range]:bg-emerald-600 [&_.p-slider-handle]:border-emerald-600"
        />

        <!-- Tick markers -->
        <div class="flex justify-between text-xs text-gray-500 mt-2">
          <div class="flex flex-col items-center">
            <div class="w-1 h-1 bg-gray-400 rounded-full mb-1"></div>
            <span>{{ t('slider_faster') }}</span>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-1 h-1 bg-emerald-600 rounded-full mb-1"></div>
            <span class="text-emerald-600">{{ t('slider_recommended') }}</span>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-1 h-1 bg-gray-400 rounded-full mb-1"></div>
            <span>{{ t('slider_slower') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({ useScope: 'local' });
const $leadminerStore = useLeadminerStore();
const localBodySizeFilter = computed(() => $leadminerStore.filterBodySize);

const displayLabel = computed(() => {
  if (localBodySizeFilter.value >= maxBodySize) return t('slider_slower_label');
  return `${Math.round(localBodySizeFilter.value / 1024)} KB`;
});
</script>

<i18n lang="json">
{
  "en": {
    "extract_signatures_option": "Extract contact details from signatures",
    "extract_signatures_sub": "",
    "slider_faster": "Faster",
    "slider_recommended": "Recommended",
    "slider_slower_label": "No size limit",
    "slider_slower": "Takes more time"
  },
  "fr": {
    "extract_signatures_option": "Extraire les coordonnées depuis les signatures",
    "extract_signatures_sub": "(l'extraction prendra plus de temps)",
    "slider_faster": "Plus rapide",
    "slider_recommended": "Recommandé",
    "slider_slower_label": "Sans limite de taille",
    "slider_slower": "Tous les bodie"
  }
}
</i18n>
