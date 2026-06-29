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
    Promise.all([
      neu.exec({
        cmd: "./test.sh",
        args: [1, 2, 3],
        options: {
          envs: { VAR1: "one", VAR2: "two", VAR3: "three" },
        },
      }),
      neu.exec({
        cmd: "echo",
        args: [
          "$(printf hi)",
          "$USER",
          "`echo hello`",
          "hello",
          "'hello'",
          '"hello"',
        ],
      }),
      Ok(
        quoteForPosix(
          "echo $(printf hi) $USER `echo hello` \"Hello\" 'hello' hello \\n \\0 \\t \\r",
        ),
      ),
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
