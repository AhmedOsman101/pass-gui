<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type StreamBoxProps = {
  command: string;
  stdout?: string;
  stderr?: string;
  running?: boolean;
  exitCode?: number | null;
  defaultOpen?: boolean;
};

const props = withDefaults(defineProps<StreamBoxProps>(), {
  stdout: "",
  stderr: "",
  running: false,
  exitCode: null,
  defaultOpen: false,
});

const open = ref(props.defaultOpen);
const outputRef = ref<HTMLElement | null>(null);

const status = computed(() => {
  if (props.running) return "running";
  if (props.exitCode === null || props.exitCode === undefined) return "idle";
  return props.exitCode === 0 ? "success" : "error";
});

const statusLabel = computed(() => {
  if (props.running) return "Running...";
  if (status.value === "success") return "Done";
  if (status.value === "error") return `Exit ${props.exitCode}`;
  return "";
});

async function copy(): Promise<void> {
  const text = `$ ${props.command}\n${props.stdout}${props.stderr ? `\n${props.stderr}` : ""}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback: no-op — clipboard may be unavailable in some contexts
  }
}

watch(
  () => [props.stdout, props.stderr, open.value],
  async () => {
    if (!open.value) return;
    await nextTick();
    if (outputRef.value) outputRef.value.scrollTop = outputRef.value.scrollHeight;
  },
);
</script>

<template>
  <Collapsible v-model:open="open" class="rounded-lg border bg-card overflow-hidden">
    <CollapsibleTrigger
      class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
    >
      <span class="text-muted-foreground shrink-0">
        <svg
          v-if="open"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <svg
          v-else
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
      <code class="flex-1 truncate font-mono text-xs">$ {{ command }}</code>
      <span
        v-if="statusLabel"
        class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
        :class="{
          'bg-muted text-muted-foreground': status === 'running' || status === 'idle',
          'bg-green-500/15 text-green-700 dark:text-green-400': status === 'success',
          'bg-destructive/15 text-destructive': status === 'error',
        }"
      >
        {{ statusLabel }}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 size-6"
        aria-label="Copy output"
        @click.stop="copy"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" />
        </svg>
      </Button>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div
        ref="outputRef"
        class="max-h-64 overflow-auto bg-muted/30 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all border-t"
      >
        <span v-if="stdout" class="text-foreground">{{ stdout }}</span>
        <span v-if="stderr" class="text-destructive">{{ stderr }}</span>
        <span v-if="!stdout && !stderr && !running" class="text-muted-foreground italic">No output</span>
        <span v-if="running" class="inline-block size-2 animate-pulse bg-foreground/60 ml-1 align-middle" />
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
