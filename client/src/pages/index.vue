<script setup lang="ts">
import { useAsyncState } from "@vueuse/core";
import type { Result } from "lib-result";
import { neu } from "@/services/neutralino";

// Run all async operations in parallel
const {
  state: tests,
  isLoading,
  error,
} = useAsyncState(
  () =>
    Promise.all([
      neu.execCmd("VAR1=one VAR2=two VAR3=three ./test.sh", [1, 2, 3]),
      neu.execCmd("echo", ["$(echo hi) $USER"]),
    ]),
  [] as Result<unknown>[] // initial empty array
);
</script>

<template>
  <main>
    <div v-if="isLoading">Running tests...</div>
    <div v-else-if="error">Error: {{ error }}</div>

    <template v-else>
      <pre>Total: {{ tests.length }}</pre>

      <pre v-for="(test, index) in tests" :key="index">
Test {{ index + 1 }}: {{ test?.ok ?? test?.error }}
      </pre>
    </template>
  </main>
</template>
