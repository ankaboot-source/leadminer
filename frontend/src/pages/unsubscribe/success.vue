<template>
  <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
    <div>
      <div class="inline-flex p-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="5rem"
          height="5rem"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M16.5 12C17.3284 12 18 11.3284 18 10.5C18 9.67157 17.3284 9 16.5 9C15.6716 9 15 9.67157 15 10.5C15 11.3284 15.6716 12 16.5 12Z"
            fill="#FFB74D"
          />
          <path
            d="M12.5 12C13.0523 12 13.5 11.5523 13.5 11C13.5 10.4477 13.0523 10 12.5 10C11.9477 10 11.5 10.4477 11.5 11C11.5 11.5523 11.9477 12 12.5 12Z"
            fill="#FFB74D"
          />
          <path
            d="M8.5 12C9.32843 12 10 11.3284 10 10.5C10 9.67157 9.32843 9 8.5 9C7.67157 9 7 9.67157 7 10.5C7 11.3284 7.67157 12 8.5 12Z"
            fill="#FFB74D"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M10.5 2C10.5 2 9 4 9 6C9 7.10457 9.89543 8 11 8C11.3333 8 11.6667 7.86667 12 7.66667C12.3333 7.86667 12.6667 8 13 8C14.1046 8 15 7.10457 15 6C15 4 13.5 2 13.5 2C13.5 2 13.6667 3 14 4C14.3333 5 14 6 14 6C14 6 16 5 17 4C17.5 3.5 18 4 18 5C18 6.5 16 8 16 8L17 10C17 10 15.5 11 14 11C13.5 11 13 10.5 13 10.5L12.5 13L11 13.5L9 15L8 17L7 18L7.5 19L9 19.5L10 18L11 16.5L12 15L13.5 14.5L14 15L16 16L17 17.5L18 18.5L18.5 17.5L17.5 16L16 15L14.5 14L13.5 13.5L13 14C13 14 14 14.5 15 14C16 13.5 17 12 17 12C17 12 18.5 10.5 19 9C19.5 7.5 19 6 18.5 5.5C18 5 17.5 5 17 5.5C16.5 6 16 7 15.5 7.5C15 8 14.5 8 14 7.5L14.5 6C14.5 6 15.5 5.5 15.5 4.5C15.5 3.5 15 2.5 14 2C13 1.5 12.5 2 12 2.5L11 3L10.5 2Z"
            fill="#FFB74D"
          />
          <path
            d="M4 19C4.55228 19 5 18.5523 5 18C5 17.4477 4.55228 17 4 17C3.44772 17 3 17.4477 3 18C3 18.5523 3.44772 19 4 19Z"
            fill="#FFCC80"
          />
        </svg>
      </div>
      <div class="text-4xl font-bold font-serif">
        {{ $t('unsubscribe.success_header') }}
      </div>
    </div>
    <div>
      <p>
        {{ $t('unsubscribe.success_message') }}
      </p>
    </div>
    <div v-if="isPreview" class="bg-blue-50 border border-blue-200 rounded p-4">
      <p class="text-sm text-blue-800">
        {{ $t('unsubscribe.preview_notice') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const $route = useRoute();
const isPreview = Boolean($route.query.preview);
</script>
