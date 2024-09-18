<template>
  <div class="text-gray-700 font-serif">
    <span>{{ t('legal_information_1') }}</span>
    <br v-if="!authMode" />
    <span>{{ t('legal_information_2') }}</span>
    <br v-if="!authMode" />
    <span>
      {{ t('legal_information_3') }}
      <NuxtLink
        class="text-indigo-500"
        to="https://www.gnu.org/licenses/"
        target="_blank"
        rel="noopener noreferrer"
      >
        https://www.gnu.org/licenses/</NuxtLink
      >.
    </span>
  </div>
</template>

<script setup lang="ts">
import type { authModes } from '@/types/auth';
const { t } = useI18n({
  useScope: 'local',
});

const { authMode } = defineProps<{
  authMode?: authModes;
}>();
</script>

<i18n lang="json">
{
  "en": {
    "legal_information_1": "This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.",
    "legal_information_2": "This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.",
    "legal_information_3": "You should have received a copy of the GNU General Public License along with this program. If not, see "
  },
  "fr": {
    "legal_information_1": "Ce programme est un logiciel libre : vous pouvez le redistribuer et/ou le modifier selon les termes de la Licence Publique Générale GNU telle que publiée par la Free Software Foundation, soit la version 3 de la licence, soit (à votre choix) toute version ultérieure.",
    "legal_information_2": "Ce programme est distribué dans l'espoir qu'il sera utile, mais SANS AUCUNE GARANTIE ; sans même la garantie implicite de QUALITÉ MARCHANDE ou d'ADÉQUATION À UN BUT PARTICULIER. Consultez la Licence Publique Générale GNU pour plus de détails.",
    "legal_information_3": "Vous devriez avoir reçu une copie de la Licence Publique Générale GNU avec ce programme. Sinon, voir "
  }
}
</i18n>
