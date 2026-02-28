<template>
  <Divider :layout="layout">
    <b class="text-gray-400 font-semibold">{{ content }}</b>
  </Divider>
</template>

<script setup lang="ts">
const { layout, content } = defineProps<{
  layout: 'vertical' | 'horizontal';
  content: string;
}>();
</script>
