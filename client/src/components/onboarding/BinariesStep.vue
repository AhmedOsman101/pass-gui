<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Loader2, RefreshCw, TriangleAlert } from "@lucide/vue";
import { toast } from "sonner";
import BinaryGuide from "./BinaryGuide.vue";
import { Button } from "@/components/ui/button";
import { StreamBox } from "@/components/ui/stream-box";
import { detectDistroFamily, prettyNameFrom } from "@/lib/distro";
import { Logger } from "@/lib/logger";
import { Askpass, runPayload } from "@/services/askpass";
import { Dialog } from "@/services/dialog";
import { Fs } from "@/services/filesystem";
import { Guides } from "@/services/guides";
import { Neu } from "@/services/neutralino";
import { useReadinessStore } from "@/stores/readiness";
import type { Icon, MessageBoxChoice } from "@neutralinojs/lib";

type BinariesStepProps = {
  /**
   * Store path for Re-check evaluation. The page resolves a usable
   * path (active store, default fallback) so the step always has a
   * target to evaluate — a null path disables Re-check only.
   */
  storePath: string | null;
};

type RunState = {
  command: string;
  stdout: string;
  stderr: string;
  running: boolean;
  exitCode: number | null;
};

const props = defineProps<BinariesStepProps>();

const readiness = useReadinessStore();

/** /etc/os-release text, read once; null on non-Linux or read failure. */
const osRelease = ref<string | null>(null);

onMounted(async () => {
  if (Neu.OS !== "Linux") return;

  const result = await Fs.readFile("/etc/os-release");
  if (result.isError()) {
    await Logger.warn(
      `BinariesStep: /etc/os-release unavailable: ${result.error.message}`
    );
    return;
  }
  osRelease.value = result.ok;
});

const family = computed(() => detectDistroFamily(Neu.OS, osRelease.value));

const detectedLine = computed(() => {
  const label = Guides.familyLabel(family.value);
  if (osRelease.value === null) return label;
  const prettyName = prettyNameFrom(osRelease.value);
  return prettyName ? `${prettyName} — ${label}` : label;
});

/**
 * Guides render per blocking issue code (missing → install variant,
 * too-old → upgrade variant with found/expected versions). The
 * detection chain short-circuits at the first failed check, so a
 * snapshot currently carries at most one binary issue — the list
 * mapping keeps several sections possible.
 */
const entries = computed(() =>
  Guides.issueEntries(readiness.blockingIssues).map(entry => ({
    entry,
    guide: Guides.forBinary(entry.binary, family.value, entry.variant, Neu.OS),
  }))
);

const isWindows = Neu.OS === "Windows";
/** Docs-only fallback systems cannot auto-run anything. */
const canRun = !isWindows;
const needsRunNote = computed(
  () => !isWindows && entries.value.some(row => row.guide.candidates.length > 0)
);

// --- Run for me -------------------------------------------------------

const run = ref<RunState | null>(null);

const anyRunActive = computed(() => run.value?.running === true);

function appendRun(
  field: "stdout" | "stderr",
  chunk: string
): void {
  if (run.value === null) return;
  run.value[field] += chunk;
}

/**
 * Runs a guide command in-app (decision Q4): stream box + `Neu.spawn`.
 * `sudo -A` commands get SUDO_ASKPASS resolved first — GUI apps have
 * no TTY for a plain sudo prompt. A zero-exit install is followed by
 * an auto re-check so the step clears itself. The command is whatever
 * the guide currently has selected — its chip is the source of truth.
 */
async function runGuide(command: string): Promise<void> {
  if (!canRun || anyRunActive.value || command === "") return;

  const confirm = await Dialog.showMessageBox(
    "Run command in a terminal box?",
    `$ ${command}\n\nThis runs as ${command.includes("sudo -A") ? "root (via sudo)" : "your user"} and may ask for your password.`,
    "OK_CANCEL" as MessageBoxChoice,
    "WARNING" as Icon
  );
  if (confirm.isError() || (confirm.ok !== "OK" && confirm.ok !== "YES")) {
    return;
  }

  const askpass = await Askpass.ensure();
  if (askpass.isError()) {
    toast.error(`Cannot run this command: ${askpass.error.message}`);
    return;
  }

  run.value = {
    command,
    stdout: "",
    stderr: "",
    running: true,
    exitCode: null,
  };

  const result = await Neu.spawn({
    cmd: "sh",
    args: ["-c", runPayload(command, askpass.ok)],
    onStdOut: chunk => appendRun("stdout", chunk),
    onStdErr: chunk => appendRun("stderr", chunk),
  });

  if (run.value !== null) {
    run.value.running = false;
    if (result.isError()) {
      run.value.exitCode = 1;
      run.value.stderr += `\n${result.error.message}`;
    } else {
      run.value.exitCode = result.ok.exitCode;
    }
  }

  if (result.isOk() && result.ok.exitCode === 0) {
    toast.success("Install finished.");
    if (props.storePath !== null) await readiness.evaluate(props.storePath);
  } else {
    toast.error("The command failed — check its output above.");
  }
}

// --- Re-check ---------------------------------------------------------

const canRecheck = computed(
  () => props.storePath !== null && !readiness.isEvaluating && !anyRunActive.value
);

async function recheck(): Promise<void> {
  if (props.storePath === null) return;
  await readiness.evaluate(props.storePath);
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <p class="text-sm font-medium">Required binaries</p>
        <p class="text-xs text-muted-foreground">{{ detectedLine }}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="!canRecheck"
        @click="recheck"
      >
        <Loader2
          v-if="readiness.isEvaluating"
          class="size-3.5 animate-spin"
        />
        <RefreshCw v-else class="size-3.5" />
        {{ readiness.isEvaluating ? "Checking..." : "Re-check" }}
      </Button>
    </div>

    <p
      v-if="readiness.error"
      class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
    >
      <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
      <span>
        Readiness check failed: {{ readiness.error.message }} — fix the
        system and run Re-check again.
      </span>
    </p>

    <p
      v-if="entries.length === 0"
      class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
    >
      {{
        readiness.snapshot === null
          ? "No readiness snapshot yet — run Re-check to evaluate."
          : "All required binaries are present."
      }}
    </p>

    <template v-for="row in entries" :key="`${row.entry.binary}-${row.entry.variant}`">
      <BinaryGuide
        :guide="row.guide"
        :found="row.entry.found"
        :expected="row.entry.expected"
        :can-run="canRun"
        :run-disabled="anyRunActive"
        @run="runGuide"
      />
    </template>

    <StreamBox
      v-if="run"
      :command="run.command"
      :stdout="run.stdout"
      :stderr="run.stderr"
      :running="run.running"
      :exit-code="run.exitCode"
      :default-open="run.running"
    />

    <p v-if="isWindows" class="text-xs text-muted-foreground">
      tree is not required on Windows.
    </p>
    <p v-else-if="needsRunNote" class="text-xs text-muted-foreground">
      Commands use sudo -A: the password prompt travels through a
      SUDO_ASKPASS helper because this window has no terminal. If you
      paste a command by hand, drop -A and run plain sudo instead.
    </p>
  </section>
</template>
