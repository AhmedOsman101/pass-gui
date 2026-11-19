<script lang="ts" setup>
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
    if (outputRef.value)
      outputRef.value.scrollTop = outputRef.value.scrollHeight;
  }
);
</script>

<template>
  <Collapsible
    class="bg-card overflow-hidden rounded-lg border"
    v-model:open="open"
  >
    <CollapsibleTrigger
      class="hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
    >
      <span class="text-muted-foreground shrink-0">
        <svg
          fill="none"
          height="14"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          width="14"
          v-if="open"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <svg
          fill="none"
          height="14"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          width="14"
          v-else
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </span>
      <code class="flex-1 truncate font-mono text-xs">$ {{ command }}</code>
      <span
        class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
        v-if="statusLabel"
        :class="{
          'bg-muted text-muted-foreground':
            status === 'running' || status === 'idle',
          'bg-green-500/15 text-green-700 dark:text-green-400':
            status === 'success',
          'bg-destructive/15 text-destructive': status === 'error',
        }"
      >
        {{ statusLabel }}
      </span>
      <Button
        aria-label="Copy output"
        class="size-6 shrink-0"
        size="icon-sm"
        variant="ghost"
        @click.stop="copy"
      >
        <svg
          fill="none"
          height="14"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          width="14"
        >
          <rect height="13" rx="2" width="13" x="9" y="9" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" />
        </svg>
      </Button>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div
        class="bg-muted/30 max-h-64 overflow-auto border-t px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap"
        ref="outputRef"
      >
        <span class="text-foreground" v-if="stdout">{{ stdout }}</span>
        <span class="text-destructive" v-if="stderr">{{ stderr }}</span>
        <span
          class="text-muted-foreground italic"
          v-if="!stdout && !stderr && !running"
          >No output</span
        >
        <span
          class="bg-foreground/60 ml-1 inline-block size-2 animate-pulse align-middle"
          v-if="running"
        />
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
