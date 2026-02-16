<script setup lang="ts">
import { computedAsync } from "@vueuse/core";
import { fs } from "@/services/filesystem";

const fileInfo = computedAsync(async () => {
  return await fs.exists("package.json");
});
</script>

<template>
  <main>
    <pre>
      file info: {{ fileInfo?.ok }}
    </pre>
  </main>
</template>
