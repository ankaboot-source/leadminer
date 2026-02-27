<template>
  <div
    class="flex flex-col grow border border-surface-200 rounded-md p-4 gap-4"
  >
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('sources') }}</h1>
    </div>

    <DataView
      :value="$leadminer.miningSources"
      data-key="email"
      :paginator="true"
      :rows="10"
    >
      <template #empty>
        <div class="text-center py-8 text-surface-500">
          {{ t('no_sources') }}
        </div>
      </template>
      <template #list="slotProps">
        <div class="grid gap-3">
          <div
            v-for="source in slotProps.items"
            :key="source.email"
            class="border border-surface-200 rounded-md p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="font-medium">{{ source.email }}</div>
                <div class="text-sm text-surface-500 flex items-center gap-2">
                  <i
                    :class="getIcon(source.type)"
                    class="text-secondary text-sm"
                  ></i>
                  <span>{{ source.type }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Tag
                  :value="source.isValid ? t('valid') : t('invalid')"
                  :severity="source.isValid ? 'success' : 'danger'"
                />
                <Tag
                  v-if="source.passive_mining"
                  :value="t('passive_mining_active')"
                  severity="info"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('email') }}</div>
                <div class="font-medium truncate">{{ source.email }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('type') }}</div>
                <div class="flex items-center gap-2 font-medium">
                  <i :class="getIcon(source.type)" class="text-secondary"></i>
                  <span>{{ source.type }}</span>
                </div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('passive_mining') }}</div>
                <div class="flex items-center gap-2">
                  <span
                    v-if="source.passive_mining"
                    class="relative flex h-3 w-3"
                  >
                    <span
                      class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
                    ></span>
                    <span
                      class="relative inline-flex h-3 w-3 rounded-full bg-green-500"
                    ></span>
                  </span>
                  <span
                    v-else
                    class="inline-flex h-3 w-3 rounded-full bg-gray-500"
                  ></span>
                  <span>{{
                    source.passive_mining ? t('enabled') : t('disabled')
                  }}</span>
                </div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('status') }}</div>
                <div class="flex items-center gap-2">
                  <Tag
                    :value="source.isValid ? t('valid') : t('invalid')"
                    :severity="source.isValid ? 'success' : 'danger'"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </DataView>
  </div>
</template>

<script setup lang="ts">
const $leadminer = useLeadminerStore();
const { t } = useI18n({
  useScope: 'local',
});

function getIcon(type: string) {
  switch (type) {
    case 'google':
      return 'pi pi-google';
    case 'azure':
      return 'pi pi-microsoft';
    default:
      return 'pi pi-inbox';
  }
}

onMounted(async () => {
  await $leadminer.fetchMiningSources();
});
</script>

<i18n lang="json">
{
  "en": {
    "sources": "Sources",
    "no_sources": "No sources yet",
    "email": "Email",
    "type": "Type",
    "passive_mining": "Passive mining",
    "passive_mining_active": "Passive mining active",
    "status": "Status",
    "valid": "Valid",
    "invalid": "Invalid",
    "enabled": "Enabled",
    "disabled": "Disabled"
  },
  "fr": {
    "sources": "Sources",
    "no_sources": "Aucune source",
    "email": "Email",
    "type": "Type",
    "passive_mining": "Extraction passive",
    "passive_mining_active": "Extraction passive active",
    "status": "Statut",
    "valid": "Valide",
    "invalid": "Invalide",
    "enabled": "Activé",
    "disabled": "Désactivé"
  }
}
</i18n>
