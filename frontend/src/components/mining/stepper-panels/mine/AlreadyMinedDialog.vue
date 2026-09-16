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
        :label="t('skip')"
        severity="secondary"
        outlined
        @click="emit('skip')"
      />
      <Button :label="t('remine')" @click="emit('remine')" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'remine' | 'skip'): void;
}>();

const { t } = useI18n({ useScope: 'local' });
</script>

<i18n lang="json">
{
  "en": {
    "title": "Already mined",
    "description": "The selected folders were already mined and have no new messages. Re-mine them from scratch, or skip and keep your existing contacts.",
    "remine": "Re-mine",
    "skip": "Skip"
  },
  "fr": {
    "title": "Déjà traité",
    "description": "Les dossiers sélectionnés ont déjà été traités et ne contiennent aucun nouveau message. Re-traitez-les entièrement, ou ignorez et conservez vos contacts existants.",
    "remine": "Re-traiter",
    "skip": "Ignorer"
  }
}
</i18n>
