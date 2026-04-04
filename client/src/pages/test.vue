<script setup lang="ts">
import { config } from "@/services/config";
import { neu } from "@/services/neutralino";
import { useAsyncState } from "@vueuse/core";
import { type Result } from "lib-result";

// Run all async operations in parallel
const {
  state: tests,
  isLoading,
  error,
} = useAsyncState(
  () =>
    Promise.all([
      neu.execCmd({
        cmd: "VAR1=one VAR2=two VAR3=three ./test.sh",
        args: [1, 2, 3],
      }),
      neu.execCmd({ cmd: "echo", args: ["$(echo hi) $USER"] }),
      config.ensure(),
      config.load(),
    ]),
  [] as Result<unknown>[], // initial empty array
);
</script>

<template>
  <main>
    <h1>Test Page</h1>
    <div v-if="isLoading">Running tests...</div>
    <div v-else-if="error">Error: {{ error }}</div>

    <template v-else>
      <pre v-for="(test, index) in tests" :key="index">
Test {{ index + 1 }}: {{ test?.ok ?? test?.error }}
      </pre>
    </template>
  </main>
</template>
