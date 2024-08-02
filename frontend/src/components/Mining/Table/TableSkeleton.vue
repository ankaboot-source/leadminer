<template>
  <DataTable
    ref="TableRef"
    :value="contacts"
    show-gridlines
    size="small"
    striped-rows
    paginator
    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
    current-page-report-template="({currentPage} of {totalPages})"
    :rows="150"
  >
    <template #header>
      <div class="flex items-center gap-1">
        <div>
          <Skeleton
            v-if="$screenStore.size.md"
            height="2rem"
            width="5rem"
          ></Skeleton>
          <Skeleton v-else size="1.5rem"></Skeleton>
        </div>
        <div>
          <Skeleton
            v-if="$screenStore.size.md"
            height="2rem"
            width="5rem"
          ></Skeleton>
          <Skeleton v-else size="1.5rem"></Skeleton>
        </div>
        <div class="ml-2 flex items-center gap-1">
          <Skeleton width="2rem" height="0.5rem"></Skeleton>
          <Skeleton width="4rem" height="0.5rem"></Skeleton>
        </div>
        <div class="grow" />
        <div>
          <Skeleton
            v-if="$screenStore.size.md"
            height="2rem"
            width="5rem"
          ></Skeleton>
          <Skeleton v-else size="1.5rem"></Skeleton>
        </div>
        <div>
          <Skeleton v-if="$screenStore.size.md" size="2rem"></Skeleton>
          <Skeleton v-else size="1.5rem"></Skeleton>
        </div>
        <div>
          <Skeleton v-if="$screenStore.size.md" size="2rem"></Skeleton>
          <Skeleton v-else size="1.5rem"></Skeleton>
        </div>
      </div>
    </template>
    <!-- Checkbox -->
    <Column style="width: 38px">
      <template #header>
        <Skeleton size="1.2rem"></Skeleton>
      </template>
      <template #body>
        <Skeleton size="1.2rem"></Skeleton>
      </template>
    </Column>
    <!-- Source -->
    <Column>
      <template #header>
        <div>
          <Skeleton
            v-if="$screenStore.size.md"
            height="2rem"
            width="16rem"
          ></Skeleton>
          <Skeleton v-else height="1.5rem" width="10rem"></Skeleton>
        </div>
      </template>
      <template #body>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2 grow">
            <Skeleton
              v-if="$screenStore.size.md"
              shape="circle"
              size="2rem"
            ></Skeleton>
            <Skeleton v-else shape="circle" size="1.5rem"></Skeleton>
            <span>
              <div class="flex pb-3">
                <Skeleton
                  v-if="$screenStore.size.md"
                  height="0.5rem"
                  width="5rem"
                ></Skeleton>
                <Skeleton v-else height="0.5rem" width="3rem"></Skeleton>
              </div>
              <Skeleton
                v-if="$screenStore.size.md"
                height="0.5rem"
                width="10rem"
              ></Skeleton>
              <Skeleton v-else height="0.5rem" width="5rem"></Skeleton>
            </span>
          </div>
          <div v-if="$screenStore.size.md" class="flex gap-2 pt-1 pl-2">
            <Skeleton shape="circle" size="2rem"></Skeleton>
            <Skeleton shape="circle" size="2rem"></Skeleton>
            <Skeleton size="2rem"></Skeleton>
          </div>
          <div v-else class="flex gap-2 pt-1 pl-2">
            <Skeleton shape="circle" size="1.5rem"></Skeleton>
            <Skeleton shape="circle" size="1.5rem"></Skeleton>
            <Skeleton size="1.5rem"></Skeleton>
          </div>
        </div>
      </template>
    </Column>
    <!-- Other -->
    <div v-if="$screenStore.size.md">
      <Column v-for="n in 5" :key="n">
        <template #header>
          <Skeleton></Skeleton>
        </template>
        <template #body>
          <Skeleton></Skeleton>
        </template>
      </Column>
    </div>
  </DataTable>
</template>
<script setup lang="ts">
const $screenStore = useScreenStore();
const contacts = ref([{}, {}, {}, {}, {}, {}, {}]);
</script>
