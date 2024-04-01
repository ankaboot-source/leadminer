<template>
  <Divider align="center" type="solid">
    <b class="text-gray-400 font-semibold">{{ content }}</b>
  </Divider>
</template>

<script setup lang="ts">
const { content } = defineProps<{
  content: string;
}>();
</script>
