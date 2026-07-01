<script setup lang="ts">
import { RouterView } from "vue-router";
import ClipboardToast from "@/components/ClipboardToast.vue";
import ReadinessGate from "@/components/readiness/ReadinessGate.vue";
</script>

<template>
  <ReadinessGate>
    <RouterView />
    <ClipboardToast />
  </ReadinessGate>
</template>
