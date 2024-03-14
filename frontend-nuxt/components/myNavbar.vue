<template>
  <Menubar :model="items">
    <template #start> Leadminer </template>
    <template #item="{ item, props }">
      <a v-ripple :target="item.target" v-bind="props.action">
        <span :class="item.icon" />
        <span class="ml-2">{{ item.label }}</span>
      </a>
    </template>
  </Menubar>
</template>

<script setup>
import { ref } from "vue";
const router = useRouter();

const items = ref([
  {
    label: "Home",
    icon: "pi pi-home",
    command: () => {
      router.push("/");
    },
  },
  {
    label: "Fetch",
    icon: "pi pi-star",
    command: () => {
      router.push("/fetch");
    },
  },
  {
    label: "Realtime",
    icon: "pi pi-star",
    command: () => {
      router.push("/realtime");
    },
  },
]);
</script>
