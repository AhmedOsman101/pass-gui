<script setup lang="ts">
import { execCommand } from "@/services/neutralino";
import type { ExecCommandResult } from "@neutralinojs/lib";
import type { Result } from "lib-result";
import { onMounted, ref, Suspense } from "vue";

const lsCmd = ref<Result<ExecCommandResult>>();

onMounted(async () => {
  lsCmd.value = await execCommand("pass", ["ls"]);
});
</script>

<template>
  <main>
    <Suspense>
      <pre v-if="lsCmd?.isOk()">{{ lsCmd.ok.stdOut }}</pre>
    </Suspense>
  </main>
</template>
