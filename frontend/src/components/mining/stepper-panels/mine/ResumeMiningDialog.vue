<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('title')"
    :style="{ width: '26rem', maxWidth: '95vw' }"
    @update:visible="(value: boolean) => emit('update:visible', value)"
  >
    <p class="text-sm text-surface-600 mb-4">{{ t('description') }}</p>
    <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 w-full">
      <Button
        :label="t('rescan')"
        class="w-full whitespace-nowrap sm:w-auto"
        severity="secondary"
        outlined
        @click="emit('rescan')"
      />
      <Button
        :label="t('resume')"
        class="w-full whitespace-nowrap sm:w-auto"
        @click="emit('continue')"
      />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'continue' | 'rescan'): void;
}>();

const { t } = useI18n({ useScope: 'local' });
</script>

<i18n lang="json">
{
  "en": {
    "title": "New messages found",
    "description": "Some selected folders were already mined and have new messages. Resume mining only the folders with new messages, or re-scan everything.",
    "resume": "Resume new messages",
    "rescan": "Re-scan everything"
  },
  "fr": {
    "title": "Nouveaux messages trouvés",
    "description": "Certains dossiers sélectionnés ont déjà été traités et contiennent de nouveaux messages. Reprenez uniquement les dossiers contenant de nouveaux messages ou relancez une analyse complète.",
    "resume": "Reprendre les nouveaux messages",
    "rescan": "Tout ré-analyser"
  }
}
</i18n>
