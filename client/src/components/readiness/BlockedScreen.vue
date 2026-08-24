<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useActiveStoreStore } from "@/stores/active-store";
import { useReadinessStore } from "@/stores/readiness";
import IssueCard from "./IssueCard.vue";

const readiness = useReadinessStore();
const activeStore = useActiveStoreStore();

const primaryIssue = computed(() => readiness.blockingIssues[0] ?? null);
const storeError = computed(() => activeStore.error?.message ?? null);

async function retry(): Promise<void> {
  await activeStore.load();
  if (activeStore.storePath) {
    await readiness.evaluate(activeStore.storePath);
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
    <div class="max-w-md w-full space-y-4">
      <div class="text-center space-y-2">
        <h1 class="text-xl font-semibold">pass-gui</h1>
        <p class="text-sm text-muted-foreground">
          Something needs your attention before the app can start.
        </p>
      </div>

      <IssueCard v-if="primaryIssue" :issue="primaryIssue" />

      <div
        v-if="readiness.blockingIssues.length > 1"
        class="text-xs text-muted-foreground text-center"
      >
        + {{ readiness.blockingIssues.length - 1 }} more issue(s)
      </div>

      <div v-if="storeError" class="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <p class="text-sm text-destructive">{{ storeError }}</p>
      </div>

      <div v-if="readiness.error" class="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <p class="text-sm text-destructive">{{ readiness.error?.message }}</p>
      </div>

      <!-- Retry can only help when a store is configured; otherwise point
           at Settings — re-polling an unconfigured store is a dead button. -->
      <div v-if="activeStore.storePath" class="text-center">
        <button
          class="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          @click="retry"
        >
          Retry
        </button>
      </div>
      <p v-else class="text-center text-sm text-muted-foreground">
        No store configured — add one in
        <RouterLink
          to="/settings"
          class="underline underline-offset-4 hover:text-foreground"
        >
          Settings
        </RouterLink>
      </p>
    </div>
  </div>
</template>
