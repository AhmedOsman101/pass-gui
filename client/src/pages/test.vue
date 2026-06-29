<script setup lang="ts">
import { quoteForPosix } from "@/lib/shell";
import { neu } from "@/services/neutralino";
import { useAsyncState } from "@vueuse/core";
import { Ok, type Result } from "lib-result";

// Run all async operations in parallel
const {
  state: tests,
  isLoading,
  error,
} = useAsyncState(
  () =>
    Promise.all([ ]),
  [] as Result<unknown>[], // initial empty array
);
</script>

<template>
  <main>
    <h1>Test Page</h1>
    <div v-if="isLoading">Running tests...</div>
    <div v-else-if="error">Error: {{ error }}</div>

    <template v-else>
      <div v-for="(test, index) in tests" :key="index" class="mb-10">
        <p class="text-3xl">Test {{ index + 1 }}:</p>
        <pre>{{ test?.ok ?? test?.error }}</pre>
      </div>
    </template>
  </main>
</template>
