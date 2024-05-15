<template>
  <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
    <div>
      <div class="rounded-full bg-green-200 text-green-600 inline-flex p-3">
        <i class="pi pi-envelope text-5xl" />
      </div>
      <div class="text-4xl font-bold font-[Merriweather]">
        {{ messages.header }}
      </div>
    </div>
    <div>
      <p>
        {{ messages.message1 }} <b>{{ email }}</b
        >.
        {{ messages.message2 }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const $route = useRoute();
const { email } = $route.query;

const messages = {
  header: 'Almost done',
  message1: 'We sent an email to',
  message2:
    "It is a link that will sign you up. If you can't see this email, please check your spam folder.",
};
</script>
