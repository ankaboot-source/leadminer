<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('title')"
    :style="{ width: '26rem' }"
    @update:visible="(value: boolean) => emit('update:visible', value)"
  >
    <p class="text-sm text-surface-600 mb-4">{{ t('description') }}</p>
    <div class="flex justify-end gap-2">
      <Button
        :label="t('rescan')"
        severity="secondary"
        outlined
        @click="emit('rescan')"
      />
      <Button :label="t('continue')" @click="emit('continue')" />
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
    "description": "Some selected folders were already mined and have new messages. Continue from the last mined position, or re-scan everything.",
    "continue": "Continue from last position",
    "rescan": "Re-scan everything"
  },
  "fr": {
    "title": "Nouveaux messages trouvés",
    "description": "Certains dossiers sélectionnés ont déjà été traités et contiennent de nouveaux messages. Continuez depuis la dernière position ou relancez une analyse complète.",
    "continue": "Continuer depuis la dernière position",
    "rescan": "Tout ré-analyser"
  }
}
</i18n>
