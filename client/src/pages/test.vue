<script setup lang="ts">
import Toml from "@/lib/toml";
import { fs } from "@/services/filesystem";
import { neu } from "@/services/neutralino";
import type { AppConfig } from "@/types";
import { computedAsync, useAsyncState } from "@vueuse/core";
import type { Result } from "lib-result";

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
  [] as Result<unknown>[], // initial empty array
);

const _parsed = computedAsync(async () => {
  const content = await fs.readFile("./references/config.example.toml");
  if (content.isOk()) {
    const result = Toml.parse<AppConfig>(content.ok);
    console.dir(result?.ok ?? result?.error, { depth: -1 });
    if (result.isOk()) {
      const str = Toml.stringify(result.ok);
      console.log(str.ok ?? str.error);
    }
  }
});
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
