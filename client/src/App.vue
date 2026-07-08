<script setup lang="ts">
import { watch } from "vue";
import { RouterView } from "vue-router";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import ReadinessGate from "@/components/readiness/ReadinessGate.vue";
import { useEntriesStore } from "@/stores/entries";

const entries = useEntriesStore();

watch(
  () => entries.error,
  (msg) => {
    if (msg) {
      toast.error(msg);
      entries.error = null;
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
