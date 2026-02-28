<template>
  <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
    <div>
      <div class="inline-flex p-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="5rem"
          height="5rem"
          viewBox="0 0 24 24"
        >
          <path
            fill="#e53e3e"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
      </div>
      <div class="text-4xl font-bold font-serif">
        {{ $t('unsubscribe.failure_header') }}
      </div>
    </div>
    <div>
      <p>
        {{ $t('unsubscribe.failure_message') }}
      </p>
    </div>
    <div>
      <Button :label="$t('unsubscribe.go_home')" @click="navigateTo('/')" />
    </div>
  </div>
</template>

<script setup lang="ts"></script>
