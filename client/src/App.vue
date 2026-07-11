<script setup lang="ts">
import { watch } from "vue";
import { RouterView } from "vue-router";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import ReadinessGate from "@/components/readiness/ReadinessGate.vue";
import { useEntryTreeStore } from "@/stores/entry-tree";

const treeStore = useEntryTreeStore();

watch(
  () => treeStore.error,
  (msg) => {
    if (msg) {
      toast.error(msg);
      treeStore.error = null;
    }
  },
);
</script>

<template>
  <ReadinessGate>
    <RouterView />
    <Toaster />
  </ReadinessGate>
</template>
