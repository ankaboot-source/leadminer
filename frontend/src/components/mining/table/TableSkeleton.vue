<template>
  <DataTable
    :value="[{}, {}, {}, {}, {}, {}, {}]"
    show-gridlines
    striped-rows
    paginator
    size="small"
    class="h-full bg-white"
    scroll-height="flex"
    pt:tablecontainer:class="grow"
    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
    :current-page-report-template="`({currentPage} ${$t('of')} {totalPages})`"
    :rows="150"
  >
    <template #header>
      <div class="flex items-center gap-1">
        <div>
          <Skeleton height="2rem" width="2rem" class="md:!w-20"></Skeleton>
        </div>
        <div>
          <Skeleton height="2rem" width="2rem" class="md:!w-20"></Skeleton>
        </div>
        <div class="ml-2 flex items-center gap-1">
          <Skeleton width="2rem" height="0.5rem"></Skeleton>
          <Skeleton width="4rem" height="0.5rem"></Skeleton>
        </div>
        <div class="grow" />
        <div>
          <Skeleton height="2rem" width="2rem" class="md:!w-20"></Skeleton>
        </div>
        <div>
          <Skeleton size="2rem"></Skeleton>
        </div>
        <div>
          <Skeleton size="2rem"></Skeleton>
        </div>
      </div>
    </template>
    <!-- Checkbox -->
    <Column style="width: 38px" class="hidden md:table-cell">
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
          <Skeleton height="2rem" width="8rem" class="md:!w-64"></Skeleton>
        </div>
      </template>
      <template #body>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2 grow">
            <Skeleton shape="circle" size="2rem"></Skeleton>
            <span>
              <div class="flex pb-3">
                <Skeleton height="0.5rem" width="5rem"></Skeleton>
              </div>
              <Skeleton height="0.5rem" width="10rem"></Skeleton>
            </span>
          </div>
          <div class="flex gap-2 pt-1 pl-2">
            <Skeleton shape="circle" size="2rem"></Skeleton>
            <Skeleton shape="circle" size="2rem"></Skeleton>
            <Skeleton size="2rem"></Skeleton>
          </div>
        </div>
      </template>
    </Column>
    <!-- Other -->
    <Column class="hidden md:table-cell">
      <template #header>
        <Skeleton></Skeleton>
      </template>
      <template #body>
        <Skeleton></Skeleton>
      </template>
    </Column>
  </DataTable>
</template>
