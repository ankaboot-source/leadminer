<template>
  <Dialog
    :visible="visible"
    modal
    :header="mode === 'mixed' ? t('mixed_title') : t('title')"
    :style="{ width: '26rem', maxWidth: '95vw' }"
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
    <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 w-full">
      <template v-if="mode === 'mixed'">
        <Button
          :label="t('remine_all')"
          class="w-full whitespace-nowrap sm:w-auto"
          severity="secondary"
          @click="emit('remine')"
        />
        <Button
          :label="t('mine_new_only')"
          class="w-full whitespace-nowrap sm:w-auto"
          @click="emit('mine-new-only')"
        />
      </template>
      <Button
        v-else
        :label="t('remine')"
        class="w-full whitespace-nowrap sm:w-auto"
        @click="emit('remine')"
      />
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
  (e: 'remine' | 'mine-new-only'): void;
}>();

const { t } = useI18n({ useScope: 'local' });

function displayName(folder: AlreadyMinedFolder): string {
  return folderDisplayName(folder.key, t('inbox'), folder.label);
}
</script>

<i18n lang="json">
{
  "en": {
    "title": "Already mined",
    "description": "The selected folders were already mined and have no new messages. Re-mine them from scratch to refresh your contacts.",
    "remine": "Re-mine",
    "mixed_title": "Some folders already mined",
    "mixed_description": "Some selected folders were already mined. Mine only the new folders, or re-mine everything (to recover contacts you deleted).",
    "mine_new_only": "Mine new folders only",
    "remine_all": "Re-mine everything",
    "badge_up_to_date": "Up to date",
    "badge_new": "New",
    "inbox": "Inbox"
  },
  "fr": {
    "title": "Déjà traité",
    "description": "Les dossiers sélectionnés ont déjà été traités et ne contiennent aucun nouveau message. Re-traitez-les entièrement pour actualiser vos contacts.",
    "remine": "Re-traiter",
    "mixed_title": "Certains dossiers déjà traités",
    "mixed_description": "Certains dossiers sélectionnés ont déjà été traités. Extrayez uniquement les nouveaux dossiers, ou re-traitez tout (pour récupérer des contacts supprimés).",
    "mine_new_only": "Extraire les nouveaux dossiers",
    "remine_all": "Tout re-traiter",
    "badge_up_to_date": "À jour",
    "badge_new": "Nouveau",
    "inbox": "Boîte de réception"
  }
}
</i18n>
