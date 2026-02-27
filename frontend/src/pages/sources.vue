<template>
  <div class="flex flex-col grow">
    <div
      class="flex flex-col grow border border-surface-200 rounded-md px-2 pt-6"
    >
      <DataTable :value="$leadminer.miningSources">
        <Column field="email" :header="t('email')"> </Column>
        <Column field="type" :header="t('type')">
          <template #body="slotProps">
            <i
              :class="getIcon(slotProps.data.type)"
              class="text-secondary text-sm"
            ></i>
            <span class="ml-2">{{ slotProps.data.type }}</span>
          </template>
        </Column>
        <Column field="passive_mining" :header="t('passive_mining')">
          <template #body="slotProps">
            <ToggleSwitch
              v-model="slotProps.data.passive_mining"
              @update:model-value="
                (val: boolean) =>
                  togglePassiveMining(
                    slotProps.data.email,
                    slotProps.data.type,
                    val,
                  )
              "
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
const $leadminer = useLeadminerStore();
const { t } = useI18n({
  useScope: 'local',
});

async function togglePassiveMining(
  email: string,
  type: string,
  value: boolean,
) {
  await updatePassiveMining(email, type, value);
}

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
    "email": "Email",
    "type": "Type",
    "passive_mining": "Passive mining"
  },
  "fr": {
    "email": "Email",
    "type": "Type",
    "passive_mining": "Extraction passive"
  }
}
</i18n>
