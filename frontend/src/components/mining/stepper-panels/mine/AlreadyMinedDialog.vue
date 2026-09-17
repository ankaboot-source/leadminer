<template>
  <Dialog
    :visible="visible"
    modal
    :header="mode === 'mixed' ? t('mixed_title') : t('title')"
    :style="{ width: '26rem' }"
    @update:visible="(value: boolean) => emit('update:visible', value)"
  >
    <p class="text-sm text-surface-600 mb-4">
      {{ mode === 'mixed' ? t('mixed_description') : t('description') }}
    </p>
    <ul v-if="mode === 'mixed'" class="flex flex-col gap-1.5 mb-4">
      <li
        v-for="folder in folders"
        :key="folder.key"
        class="flex items-center justify-between gap-2"
      >
        <span class="truncate text-sm">{{ displayName(folder) }}</span>
        <Badge
          :value="
            folder.status === 'up_to_date'
              ? t('badge_up_to_date')
              : t('badge_new')
          "
          :severity="folder.status === 'up_to_date' ? 'secondary' : 'warn'"
        />
      </li>
    </ul>
    <div class="flex justify-end gap-2">
      <Button
        :label="t('skip')"
        severity="secondary"
        outlined
        @click="emit('skip')"
      />
      <Button
        v-if="mode === 'mixed'"
        :label="t('mine_new_only')"
        @click="emit('mine-new-only')"
      />
      <Button v-else :label="t('remine')" @click="emit('remine')" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import type { AlreadyMinedFolder } from '~/types/mining';
import { folderDisplayName } from '~/utils/selected-folders';

withDefaults(
  defineProps<{
    visible: boolean;
    mode?: 'all-mined' | 'mixed';
    folders?: AlreadyMinedFolder[];
  }>(),
  { mode: 'all-mined', folders: () => [] },
);

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'remine' | 'skip' | 'mine-new-only'): void;
}>();

const { t } = useI18n({ useScope: 'local' });
const { t: $tGlobal } = useI18n({ useScope: 'global' });

function displayName(folder: AlreadyMinedFolder): string {
  return folderDisplayName(
    folder.key,
    $tGlobal('sources.folder_inbox'),
    folder.label,
  );
}
</script>

<i18n lang="json">
{
  "en": {
    "title": "Already mined",
    "description": "The selected folders were already mined and have no new messages. Re-mine them from scratch, or skip and keep your existing contacts.",
    "remine": "Re-mine",
    "skip": "Skip",
    "mixed_title": "Some folders already mined",
    "mixed_description": "Some selected folders were already mined and have no new messages. Mine only the new folders, or skip and keep your existing contacts.",
    "mine_new_only": "Mine new folders only",
    "badge_up_to_date": "Up to date",
    "badge_new": "New"
  },
  "fr": {
    "title": "Déjà traité",
    "description": "Les dossiers sélectionnés ont déjà été traités et ne contiennent aucun nouveau message. Re-traitez-les entièrement, ou ignorez et conservez vos contacts existants.",
    "remine": "Re-traiter",
    "skip": "Ignorer",
    "mixed_title": "Certains dossiers déjà traités",
    "mixed_description": "Certains dossiers sélectionnés ont déjà été traités et ne contiennent aucun nouveau message. Extrayez uniquement les nouveaux dossiers, ou ignorez et conservez vos contacts existants.",
    "mine_new_only": "Extraire les nouveaux dossiers",
    "badge_up_to_date": "À jour",
    "badge_new": "Nouveau"
  }
}
</i18n>
