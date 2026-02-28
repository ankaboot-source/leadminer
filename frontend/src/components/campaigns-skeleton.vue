<template>
  <div class="grid gap-3">
    <div
      v-for="n in 3"
      :key="`campaign-skeleton-${n}`"
      class="border border-surface-200 rounded-md p-4"
      data-testid="skeleton-card"
    >
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex flex-col gap-2">
          <Skeleton width="8rem" height="1rem" data-testid="header-skeleton" />
          <Skeleton
            width="14rem"
            height="0.85rem"
            data-testid="header-skeleton"
          />
        </div>
        <div class="flex items-center gap-2">
          <Skeleton
            width="5.5rem"
            height="2rem"
            data-testid="actions-skeleton"
          />
          <Skeleton
            width="2.8rem"
            height="1.6rem"
            data-testid="actions-skeleton"
          />
          <Skeleton
            width="5.2rem"
            height="1.75rem"
            data-testid="actions-skeleton"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        <Skeleton height="4.5rem" data-testid="metric-skeleton" />
        <Skeleton height="4.5rem" data-testid="metric-skeleton" />
        <Skeleton height="4.5rem" data-testid="metric-skeleton" />
        <Skeleton height="4.5rem" data-testid="metric-skeleton" />
        <Skeleton height="4.5rem" data-testid="metric-skeleton" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts"></script>
