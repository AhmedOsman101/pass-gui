<script lang="ts" setup>
import { Check, Copy, ExternalLink, PlayCircle } from "@lucide/vue";
import { computed, ref } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { plainSudoCommand } from "@/services/askpass";
import { Guides } from "@/services/guides";
import { useClipboardStore } from "@/stores/clipboard";
import type { Version } from "@/types";
import type { BinaryGuide } from "@/types/guide";

type BinaryGuideProps = {
  guide: BinaryGuide;
  /** "Found X — needs ≥ Y" line for version-too-old issues. */
  found?: Version | null;
  expected?: Version | null;
  /** Run-for-me available (askpass helper present, none running). */
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
 * Chip selection state, internal by design: selection, display/copy
 * target and the emitted run command always travel together. Index 0
 * is the detected default; the choice resets on remount, never mid-step.
 */
const selected = ref(0);

const activeCandidate = computed(() => {
  const index = selected.value;
  const inRange = props.guide.candidates[index] !== undefined;
  const fallback = props.guide.candidates[0];
  return inRange ? props.guide.candidates[index] : fallback;
});

/** Raw command for the runner — keeps sudo -A for the internal payload. */
const command = computed(() => activeCandidate.value?.command ?? null);
/** Human-facing command for display and clipboard — plain sudo. */
const displayCommand = computed(() =>
  command.value === null ? null : plainSudoCommand(command.value)
);
const note = computed(() => activeCandidate.value?.note ?? null);

const copied = computed(
  () =>
    displayCommand.value !== null &&
    clipboard.persistentCopiedText === displayCommand.value
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
  if (displayCommand.value === null) return;
  await clipboard.copy(displayCommand.value);
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

    <p class="text-muted-foreground text-xs" v-if="versionLine">
      {{ versionLine }}
    </p>

    <p
      class="text-muted-foreground text-sm"
      v-if="guide.candidates.length === 0"
    >
      {{ guide.fallbackNote }}
    </p>
    <div class="space-y-2" v-else>
      <div
        class="bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-2"
      >
        <code
          class="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap"
          >{{
            displayCommand
          }}</code
        >
        <Button
          class="shrink-0"
          size="icon-sm"
          variant="ghost"
          :aria-label="`Copy ${guide.label} ${guide.variant} command`"
          @click="copyCommand"
        >
          <Check
            class="size-3.5 text-green-600 dark:text-green-400"
            v-if="copied"
          />
          <Copy class="size-3.5" v-else />
        </Button>
      </div>
      <p class="text-muted-foreground text-xs" v-if="copied">
        Copied — it stays on your clipboard.
      </p>

      <div
        class="flex flex-wrap items-center gap-1"
        v-if="guide.candidates.length > 1"
      >
        <button
          class="rounded-md border px-2 py-0.5 font-mono text-xs transition-colors"
          v-for="(candidate, index) in guide.candidates"
          :key="candidate.command"
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
        size="sm"
        variant="secondary"
        v-if="canRun"
        :disabled="runDisabled"
        @click="emit('run', command ?? '')"
      >
        <PlayCircle class="size-3.5" />
        Run for me
      </Button>
    </div>

    <p class="text-muted-foreground text-xs" v-if="note">{{ note }}</p>

    <a
      class="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs underline underline-offset-4"
      rel="noreferrer"
      target="_blank"
      :href="guide.docsUrl"
    >
      Official documentation
      <ExternalLink class="size-3" />
    </a>
  </section>
</template>
