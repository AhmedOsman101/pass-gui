<script lang="ts" setup>
import { toast } from "sonner";
import { watch } from "vue";
import { RouterView } from "vue-router";
import ReadinessGate from "@/components/readiness/ReadinessGate.vue";
import { Toaster } from "@/components/ui/sonner";
import { useEntryTreeStore } from "@/stores/entry-tree";

const treeStore = useEntryTreeStore();

watch(
  () => treeStore.error,
  err => {
    if (err) {
      toast.error(err.message);
      treeStore.error = null;
    }
  }
);
</script>

<template>
  <ReadinessGate>
    <RouterView />
    <Toaster />
  </ReadinessGate>
</template>
