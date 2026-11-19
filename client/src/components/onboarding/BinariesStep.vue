<script lang="ts" setup>
import { Loader2, RefreshCw, TriangleAlert } from "@lucide/vue";
import type { Icon, MessageBoxChoice } from "@neutralinojs/lib";
import { toast } from "sonner";
import { computed, onMounted, ref } from "vue";
import { Button } from "@/components/ui/button";
import { StreamBox } from "@/components/ui/stream-box";
import { detectDistroFamily, prettyNameFrom } from "@/lib/distro";
import { Logger } from "@/lib/logger";
import { Askpass, plainSudoCommand, runPayload } from "@/services/askpass";
import { Dialog } from "@/services/dialog";
import { Fs } from "@/services/filesystem";
import { Guides } from "@/services/guides";
import { Neu } from "@/services/neutralino";
import { useReadinessStore } from "@/stores/readiness";
import BinaryGuide from "./BinaryGuide.vue";

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

/** Whether an in-app sudo password prompt can be offered on this system. */
const askpassAvailable = ref(false);

onMounted(async () => {
  if (Neu.OS === "Linux") {
    const result = await Fs.readFile("/etc/os-release");
    if (result.isError()) {
      await Logger.warn(
        `BinariesStep: /etc/os-release unavailable: ${result.error.message}`
      );
    } else {
      osRelease.value = result.ok;
    }
  }

  // Read-only probe: no wrapper write, no dialog. Hides the Run workflow
  // when this environment has no system askpass helper.
  askpassAvailable.value = await Askpass.isAvailable();
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
/** Docs-only systems and systems without an askpass helper cannot auto-run. */
const canRun = computed(() => !isWindows && askpassAvailable.value);
const hasCommands = computed(() =>
  entries.value.some(row => row.guide.candidates.length > 0)
);
/** With no helper, the copyable plain-sudo command is the only path. */
const needsHelperNote = computed(
  () => !isWindows && hasCommands.value && !askpassAvailable.value
);
const missingHelperHint = computed(() =>
  Neu.OS === "Darwin"
    ? "a password helper (osascript or ssh-askpass)"
    : "a password helper (zenity, kdialog, yad or ssh-askpass)"
);

// --- Run for me -------------------------------------------------------

const run = ref<RunState | null>(null);
/** Persistent, inline reason the last run could not start or finish. */
const runError = ref<string | null>(null);

const anyRunActive = computed(() => run.value?.running === true);

function appendRun(field: "stdout" | "stderr", chunk: string): void {
  if (run.value === null) return;
  run.value[field] += chunk;
}

/**
 * Runs a guide command in-app (decision Q4): stream box + `Neu.spawn`.
 * `sudo -A` commands get SUDO_ASKPASS resolved first — GUI apps have
 * no TTY for a plain sudo prompt. A zero-exit install is followed by
 * an auto re-check so the step clears itself. The command is whatever
 * the guide currently has selected — its chip is the source of truth.
 * Failures are kept inline and logged, never only toasted.
 */
async function runGuide(command: string): Promise<void> {
  if (!canRun.value || anyRunActive.value || command === "") return;

  const confirm = await Dialog.showMessageBox(
    "Run command in a terminal box?",
    `$ ${plainSudoCommand(command)}\n\nThis runs as ${command.includes("sudo -A") ? "root (via sudo)" : "your user"} and may ask for your password.`,
    "OK_CANCEL" as MessageBoxChoice,
    "WARNING" as Icon
  );
  if (confirm.isError() || (confirm.ok !== "OK" && confirm.ok !== "YES")) {
    return;
  }

  // A fresh attempt replaces any previous output/error state.
  run.value = null;
  runError.value = null;

  const askpass = await Askpass.ensure();
  if (askpass.isError()) {
    // The raw reason can name internal paths; keep it in the log only.
    const reason = askpass.error.message;
    const message = "Could not prepare the password helper — see the log.";
    runError.value = message;
    await Logger.error(`BinariesStep: cannot run command: ${reason}`);
    toast.error(message);
    return;
  }

  run.value = {
    // The stream box shows the human-facing command; `-A` and the
    // SUDO_ASKPASS export stay internal to the runner payload.
    command: plainSudoCommand(command),
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

  if (run.value !== null) run.value.running = false;

  if (result.isError()) {
    // Keep the raw error for the log only: CommandFailedError.message
    // embeds the internal `sh -c` payload (sudo -A + wrapper path).
    const reason = result.error.message;
    runError.value = `${plainSudoCommand(command)} failed — see its output above.`;
    if (run.value !== null) {
      run.value.exitCode = 1;
      run.value.stderr += `\n${runError.value}`;
    }
    await Logger.error(`BinariesStep: command failed: ${reason}`);
    toast.error("The command failed — check its output above.");
    return;
  }

  if (run.value !== null) run.value.exitCode = result.ok.exitCode;
  toast.success("Install finished.");
  if (props.storePath !== null) await readiness.evaluate(props.storePath);
}

// --- Re-check ---------------------------------------------------------

const canRecheck = computed(
  () =>
    props.storePath !== null && !readiness.isEvaluating && !anyRunActive.value
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
        <p class="text-muted-foreground text-xs">{{ detectedLine }}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        :disabled="!canRecheck"
        @click="recheck"
      >
        <Loader2 class="size-3.5 animate-spin" v-if="readiness.isEvaluating" />
        <RefreshCw class="size-3.5" v-else />
        {{ readiness.isEvaluating ? "Checking..." : "Re-check" }}
      </Button>
    </div>

    <p
      class="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
      v-if="readiness.error"
    >
      <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
      <span>
        Readiness check failed: {{ readiness.error.message }} — fix the system
        and run Re-check again.
      </span>
    </p>

    <p
      class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
      v-if="entries.length === 0"
    >
      {{
        readiness.snapshot === null
          ? "No readiness snapshot yet — run Re-check to evaluate."
          : "All required binaries are present."
      }}
    </p>

    <template
      v-for="row in entries"
      :key="`${row.entry.binary}-${row.entry.variant}`"
    >
      <BinaryGuide
        :can-run="canRun"
        :expected="row.entry.expected"
        :found="row.entry.found"
        :guide="row.guide"
        :run-disabled="anyRunActive"
        @run="runGuide"
      />
    </template>

    <p
      class="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
      role="alert"
      v-if="runError"
    >
      <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
      <span>{{ runError }}</span>
    </p>

    <StreamBox
      v-if="run"
      :command="run.command"
      :default-open="run.running"
      :exit-code="run.exitCode"
      :running="run.running"
      :stderr="run.stderr"
      :stdout="run.stdout"
    />

    <p class="text-muted-foreground text-xs" v-if="isWindows">
      tree is not required on Windows.
    </p>
    <p class="text-muted-foreground text-xs" v-else-if="needsHelperNote">
      Install {{ missingHelperHint }} to run commands here. Until then, copy the
      command and run it in a terminal.
    </p>
  </section>
</template>
