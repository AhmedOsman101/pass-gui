<script setup lang="ts">
import { ref } from "vue";
import toml from "@/lib/toml";

/**
 * Empirical probe for open question #5: what does j-toml `stringify`
 * do with `undefined` values (and `null`)? Loud throw (surfaced as
 * Result Err by our wrapper) vs silent corruption.
 */
type Case = {
  name: string;
  input: string;
  outcome: string;
};

const cases = ref<Case[]>([]);

function record(name: string, input: object): void {
  const result = toml.stringify(input);
  const outcome = result.isOk()
    ? `OK →\n${result.ok}`
    : `ERR → ${result.error.message}`;
  cases.value.push({ name, input: JSON.stringify(input), outcome });
}

function run(): void {
  cases.value = [];
  // Control: plain serializable object must succeed.
  record("control: plain values", { core: { active_store: "default" } });
  // The real-world shape: optional key cleared via `?? undefined`
  // (e.g. Store.set passing gnupg_home: undefined).
  record(
    "section with undefined optional key",
    { gpg: { opts: [], signing_key: undefined } }
  );
  // Top-level undefined value.
  record("top-level undefined value", { a: "x", b: undefined });
  // null for comparison (j-toml docs: throws unless xOption.null enabled).
  record("null value", { a: null });
}

run();
</script>

<template>
  <main class="p-6 space-y-6">
    <h1 class="text-2xl font-semibold">Test Page</h1>
    <p class="text-sm text-muted-foreground">
      j-toml stringify vs undefined/null — open question #5
    </p>

    <div v-for="(testCase, index) in cases" :key="index" class="space-y-1">
      <p class="font-medium">{{ index + 1 }}. {{ testCase.name }}</p>
      <p class="text-xs text-muted-foreground font-mono">
        input: {{ testCase.input }}
      </p>
      <pre
        class="text-xs bg-muted rounded p-2 whitespace-pre-wrap">{{ testCase.outcome }}</pre>
    </div>
  </main>
</template>
