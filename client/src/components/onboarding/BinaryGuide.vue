<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, Copy, ExternalLink, PlayCircle } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Guides } from "@/services/guides";
import { useClipboardStore } from "@/stores/clipboard";
import type { Version } from "@/types";
import type { BinaryGuide } from "@/types/guide";

type BinaryGuideProps = {
  guide: BinaryGuide;
  /** "Found X — needs ≥ Y" line for version-too-old issues. */
  found?: Version | null;
  expected?: Version | null;
  /** Run-for-me available (Linux/macOS, not while another runs). */
  canRun?: boolean;
  /** Disables the Run button while its process is active. */
  runDisabled?: boolean;
};

const props = withDefaults(defineProps<BinaryGuideProps>(), {
  found: null,
  expected: null,
  canRun: false,
  runDisabled: false,
});

const emit = defineEmits<{
  run: [command: string];
}>();

const clipboard = useClipboardStore();

/**
 * Chip selection state, internal by design: selection, copy target and
 * the emitted run command always travel together. Index 0 is the
 * detected default; the choice resets on remount, never mid-step.
 */
const selected = ref(0);

const activeCandidate = computed(() => {
  const index = selected.value;
  const inRange = props.guide.candidates[index] !== undefined;
  const fallback = props.guide.candidates[0];
  return inRange ? props.guide.candidates[index] : fallback;
});

const command = computed(() => activeCandidate.value?.command ?? null);
const note = computed(() => activeCandidate.value?.note ?? null);

const copied = computed(
  () => command.value !== null && clipboard.persistentCopiedText === command.value
);

const versionLine = computed(() => {
  if (!props.found || !props.expected) return null;
  return `Found ${Guides.versionLabel(props.found)} — needs ${Guides.versionLabel(props.expected)} or newer.`;
});

const variantBadge = computed(() =>
  props.guide.variant === "upgrade" ? "Upgrade needed" : "Missing"
);

const badgeVariant = computed(() =>
  props.guide.variant === "upgrade" ? "destructive" : "outline"
);

async function copyCommand(): Promise<void> {
  if (command.value === null) return;
  await clipboard.copy(command.value);
}

function pickCandidate(index: number): void {
  selected.value = index;
}
</script>

<template>
  <section class="space-y-3 rounded-lg border p-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-medium">{{ guide.label }}</h3>
      <Badge :variant="badgeVariant">{{ variantBadge }}</Badge>
    </div>

    <p v-if="versionLine" class="text-xs text-muted-foreground">
      {{ versionLine }}
    </p>

    <p
      v-if="guide.candidates.length === 0"
      class="text-sm text-muted-foreground"
    >
      {{ guide.fallbackNote }}
    </p>
    <div v-else class="space-y-2">
      <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <code
          class="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap"
        >{{ command }}</code>
        <Button
          variant="ghost"
          size="icon-sm"
          class="shrink-0"
          :aria-label="`Copy ${guide.label} ${guide.variant} command`"
          @click="copyCommand"
        >
          <Check
            v-if="copied"
            class="size-3.5 text-green-600 dark:text-green-400"
          />
          <Copy v-else class="size-3.5" />
        </Button>
      </div>
      <p v-if="copied" class="text-xs text-muted-foreground">
        Copied — it stays on your clipboard.
      </p>

      <div
        v-if="guide.candidates.length > 1"
        class="flex flex-wrap items-center gap-1"
      >
        <button
          v-for="(candidate, index) in guide.candidates"
          :key="candidate.command"
          class="rounded-md border px-2 py-0.5 font-mono text-xs transition-colors"
          :class="
            index === selected
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
          "
          @click="pickCandidate(index)"
        >
          {{ Guides.chipLabel(candidate.command) }}
        </button>
      </div>

      <Button
        v-if="canRun"
        size="sm"
        variant="secondary"
        :disabled="runDisabled"
        @click="emit('run', command ?? '')"
      >
        <PlayCircle class="size-3.5" />
        Run for me
      </Button>
    </div>

    <p v-if="note" class="text-xs text-muted-foreground">{{ note }}</p>

    <a
      :href="guide.docsUrl"
      target="_blank"
      rel="noreferrer"
      class="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4 hover:text-primary/80"
    >
      Official documentation
      <ExternalLink class="size-3" />
    </a>
  </section>
</template>
