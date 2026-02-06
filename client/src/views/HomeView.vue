<script setup lang="ts">
import type { ExecCommandResult } from "@neutralinojs/lib";
import type { Result } from "lib-result";
import { onMounted, ref, Suspense } from "vue";
import { NEU_ERROR_CODES } from "@/lib/constants";
import { execCommand } from "@/services/neutralino";

const lsCmd = ref<Result<ExecCommandResult>>();

onMounted(async () => {
  lsCmd.value = await execCommand("pass", ["ls"]);
});
</script>

<template>
  <main>
    <pre>{{ JSON.stringify(NEU_ERROR_CODES, null, 2) }}</pre>
    <pre v-if="lsCmd?.isOk()">{{ lsCmd.ok.stdOut }}</pre>
  </main>
</template>
