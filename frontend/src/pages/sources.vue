<template>
  <div class="flex flex-col grow">
    <div
      class="flex flex-col grow border border-surface-200 rounded-md px-2 pt-6"
    >
      <DataTable :value="$leadminer.miningSources">
        <Column field="email" header="Email"> </Column>
        <Column field="type" header="Type">
          <template #body="slotProps">
            <i
              :class="getIcon(slotProps.data.type)"
              class="text-secondary text-sm"
            ></i>
            <span class="ml-2">{{ slotProps.data.type }}</span>
          </template>
        </Column>
        <Column field="passive_mining" header="Passive mining">
          <template #body="slotProps">
            <div v-if="slotProps.data.passive_mining">
              <span class="relative flex h-3 w-3">
                <span
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
                ></span>
                <span
                  class="relative inline-flex h-3 w-3 rounded-full bg-green-500"
                ></span>
              </span>
            </div>
            <div v-else>
              <span class="inline-flex h-3 w-3 rounded-full bg-red-500"></span>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
const $leadminer = useLeadminerStore();

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
