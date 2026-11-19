<script lang="ts" setup>
import { TriangleAlert } from "@lucide/vue";
import { refDebounced } from "@vueuse/core";
import { toast } from "sonner";
import { computed, onMounted, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Logger } from "@/lib/logger";
import { Config } from "@/services/config";
import type { ConfigValidationOutcome } from "@/services/config-validator";
import { ConfigValidator } from "@/services/config-validator";
import { Dialog } from "@/services/dialog";
import { Fs } from "@/services/filesystem";
import { Neu } from "@/services/neutralino";
import type { ConfigStatus } from "@/types/onboarding";

const props = defineProps<ConfigStepProps>();
const emit = defineEmits<{ written: []; recheck: [] }>();

/**
 * GUI editors that can be launched detached with a single file-path
 * argument. Terminal editors are deliberately excluded: launching one
 * would block or need a TTY the GUI does not have, so anything
 * unrecognized falls back to the OS system association instead.
 */
const GUI_EDITORS = new Set([
  "code",
  "codium",
  "cursor",
  "windsurf",
  "zed",
  "subl",
  "atom",
  "gedit",
  "kate",
  "mousepad",
  "pluma",
  "notepad",
  "notepad++",
  "nova",
  "textmate",
  "fleet",
  "idea",
]);

type ConfigStepProps = {
  status: ConfigStatus;
  errors: string[];
  warnings: string[];
};

/** The Default config example, byte-identical to what "Use default" writes. */
const exampleConfig = ref<string | null>(null);
const pastedText = ref("");
const busy = ref(false);
const errorLines = ref<string[]>([]);

/** Raw-text editor state for an existing-but-invalid config. */
const diskText = ref("");
const draftText = ref("");
const debouncedDraft = refDebounced(draftText, 300);
const validatedText = ref("");
const localOutcome = ref<ConfigValidationOutcome | null>(null);
let validationSeq = 0;

/** A config that exists but cannot be used: schema or content problem. */
const isInvalid = computed(
  () =>
    props.status.exists &&
    (!props.status.schemaValid || props.status.contentValid === false)
);

/** True once the debounced validation has caught up with the draft. */
const draftIsCurrent = computed(() => validatedText.value === draftText.value);
/** True while the editor holds text that differs from disk. */
const draftIsDirty = computed(() => draftText.value !== diskText.value);

/**
 * Save is enabled only for a valid, changed draft whose validation
 * corresponds to the exact text in the editor. Warnings never block —
 * consistent with how #27 treats non-blocking issues.
 */
const canSave = computed(
  () =>
    isInvalid.value &&
    draftIsDirty.value &&
    draftIsCurrent.value &&
    (localOutcome.value?.errors.length ?? 1) === 0
);

/** Import failures live here; validator findings arrive as props. */
const listedErrors = computed(() => {
  if (!props.status.exists) return errorLines.value;
  if (isInvalid.value && draftIsDirty.value) {
    return localOutcome.value?.errors ?? [];
  }
  return props.errors;
});
const listedWarnings = computed(() => {
  if (!props.status.exists) return [];
  if (isInvalid.value && draftIsDirty.value) {
    return localOutcome.value?.warnings ?? [];
  }
  return props.warnings;
});

/** The issue list + example grid shows for missing, invalid, or warned configs. */
const showDiagnostics = computed(
  () =>
    !props.status.exists ||
    listedErrors.value.length > 0 ||
    listedWarnings.value.length > 0
);

const issueHeading = computed(() => {
  if (!props.status.exists) return "Import failed:";
  return listedErrors.value.length > 0
    ? "Configuration issues:"
    : "Configuration warnings:";
});

watch(
  isInvalid,
  invalid => {
    if (invalid) void loadCurrentText();
  },
  { immediate: true }
);

watch(debouncedDraft, async text => {
  const seq = ++validationSeq;
  const outcome = await ConfigValidator.validateText(text);
  // A newer keystroke superseded this probe — do not overwrite its result.
  if (seq !== validationSeq) return;
  validatedText.value = text;
  localOutcome.value = outcome;
});

onMounted(async () => {
  const result = await Config.getDefaultConfigText();
  if (result.isOk()) {
    exampleConfig.value = result.ok;
  } else {
    await Logger.error(
      `ConfigStep: failed to load example config: ${result.error.message}`
    );
  }
});

/** Loads the on-disk config into both the editor and its clean baseline. */
async function loadCurrentText(): Promise<void> {
  const pathResult = await Config.getPath();
  if (pathResult.isError()) {
    await Logger.error(`ConfigStep: ${pathResult.error.message}`);
    return;
  }
  const readResult = await Fs.readFile(pathResult.ok);
  if (readResult.isError()) {
    await Logger.error(`ConfigStep: ${readResult.error.message}`);
    return;
  }
  diskText.value = readResult.ok;
  draftText.value = readResult.ok;
  validatedText.value = readResult.ok;
  // Seed from the disk-derived diagnostics so the issue list does not
  // blink empty during the first 300 ms after the editor appears.
  localOutcome.value = {
    schemaValid: props.status.schemaValid,
    contentValid: props.status.contentValid,
    errors: [...props.errors],
    warnings: [...props.warnings],
  };
}

function showErrors(error: Error): void {
  errorLines.value = error.message
    .split("\n")
    .filter(line => line.trim() !== "");
}

async function saveDraft(): Promise<void> {
  if (!canSave.value || busy.value) return;
  busy.value = true;
  const result = await Config.replaceText(draftText.value);
  busy.value = false;
  if (result.isError()) {
    toast.error(`Could not save config: ${result.error.message}`);
    return;
  }
  emit("written");
}

/**
 * Re-sync the editor from disk before rechecking. The UI invites opening
 * the file externally then rechecking; if that edit left the config still
 * invalid, `isInvalid` stays true and would not re-trigger the load watch,
 * so without this the textarea would keep stale text and a later save
 * could overwrite the external edit.
 */
function recheck(): void {
  if (isInvalid.value) void loadCurrentText();
  emit("recheck");
}

/** Opens the config file's parent directory in the OS file manager. */
async function openInFileManager(): Promise<void> {
  const pathResult = await Config.getPath();
  if (pathResult.isError()) {
    toast.error(`Could not locate the config: ${pathResult.error.message}`);
    return;
  }
  const parts = await Fs.getPathParts(pathResult.ok);
  if (parts.isError()) {
    toast.error(
      `Could not resolve the config directory: ${parts.error.message}`
    );
    return;
  }
  const result = await Neu.openPath(parts.ok.parentPath);
  if (result.isError()) {
    toast.error(`Could not open the file manager: ${result.error.message}`);
  }
}

/**
 * Launches $EDITOR only when it names a known GUI editor; any other
 * value (terminal editor, unset, unsafe, or a failed launch) falls back
 * to the OS system association for the config file.
 */
async function openInDefaultEditor(): Promise<void> {
  const configPathResult = await Config.getPath();
  if (configPathResult.isError()) {
    toast.error(
      `Could not locate the config: ${configPathResult.error.message}`
    );
    return;
  }
  const configPath = configPathResult.ok;

  const editor = (await Neu.getEnv("EDITOR")).trim();
  const firstToken = editor.split(/\s+/)[0] ?? "";
  const baseName = firstToken.split(/[\\/]/).pop()?.toLowerCase() ?? "";

  if (baseName !== "" && GUI_EDITORS.has(baseName)) {
    const result = await Neu.exec({
      cmd: firstToken,
      args: [configPath],
      options: { background: true },
    });
    if (result.isOk()) return;
    await Logger.warn(
      `ConfigStep: editor '${firstToken}' failed to launch, using system association.`
    );
  }

  const fallback = await Neu.openPath(configPath);
  if (fallback.isError()) {
    toast.error(`Could not open the config: ${fallback.error.message}`);
  }
}

async function runImport(text: string): Promise<void> {
  errorLines.value = [];
  const result = await Config.importText(text);
  if (result.isError()) {
    showErrors(result.error);
    return;
  }
  emit("written");
}

async function importPasted(): Promise<void> {
  if (busy.value || pastedText.value.trim() === "") return;
  busy.value = true;
  await runImport(pastedText.value);
  busy.value = false;
}

/** File picker is one of the two import affordances; cancel is a no-op. */
async function chooseFile(): Promise<void> {
  if (busy.value) return;

  const picked = await Dialog.showOpenDialog("Import config (TOML)", {
    filters: [{ name: "TOML", extensions: ["toml"] }],
  });
  if (picked.isError()) {
    showErrors(picked.error);
    return;
  }
  if (picked.ok.length === 0) return;

  const first = picked.ok[0];
  if (!first) return;

  busy.value = true;
  const readResult = await Fs.readFile(first);
  if (readResult.isError()) {
    busy.value = false;
    showErrors(readResult.error);
    return;
  }
  await runImport(readResult.ok);
  busy.value = false;
}

async function useDefault(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  errorLines.value = [];
  const result = await Config.createDefault();
  busy.value = false;
  if (result.isError()) {
    showErrors(result.error);
    return;
  }
  emit("written");
}
</script>

<template>
  <section class="space-y-4">
    <template v-if="!props.status.exists">
      <div>
        <p class="text-sm font-medium">No configuration found</p>
        <p class="text-muted-foreground mt-1 text-xs">
          Choose how to set up the Default config before continuing.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button size="sm" :disabled="busy" @click="useDefault">
          Use default
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="chooseFile"
        >
          Choose file…
        </Button>
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-medium" for="config-paste">
          Or paste TOML
        </label>
        <textarea
          class="border-input bg-background w-full rounded-md border p-2 font-mono text-xs"
          id="config-paste"
          placeholder="Paste config.toml contents here"
          rows="6"
          spellcheck="false"
          v-model="pastedText"
        />
        <Button
          size="sm"
          variant="outline"
          :disabled="busy || pastedText.trim() === ''"
          @click="importPasted"
        >
          Import pasted TOML
        </Button>
      </div>
    </template>

    <template v-else-if="isInvalid">
      <div>
        <p class="text-sm font-medium">
          Configuration found — issues need attention
        </p>
        <p class="text-muted-foreground mt-1 text-xs">
          Edit the TOML below, then save once the issues are gone. You can also
          open the file externally, then use Re-check.
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-medium" for="config-editor">
          config.toml
        </label>
        <textarea
          class="border-input bg-background w-full rounded-md border p-2 font-mono text-xs"
          id="config-editor"
          placeholder="config.toml"
          rows="14"
          spellcheck="false"
          v-model="draftText"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <Button size="sm" :disabled="!canSave || busy" @click="saveDraft">
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="openInFileManager"
        >
          Open in file manager
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="openInDefaultEditor"
        >
          Open in default editor
        </Button>
        <Button size="sm" variant="outline" @click="recheck"> Re-check </Button>
      </div>
    </template>

    <!-- Errors sit beside the example so they can be compared directly. -->
    <div class="grid gap-4 sm:grid-cols-2" v-if="showDiagnostics">
      <div
        class="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-xs"
        v-if="listedErrors.length > 0 || listedWarnings.length > 0"
      >
        <p class="mb-1 flex items-center gap-2 font-medium">
          <TriangleAlert class="size-3.5 shrink-0" />
          {{ issueHeading }}
        </p>
        <ul class="list-disc space-y-0.5 pl-4" v-if="listedErrors.length > 0">
          <li v-for="(line, index) in listedErrors" :key="`error-${index}`">
            {{ line }}
          </li>
        </ul>
        <ul
          class="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4"
          v-if="listedWarnings.length > 0"
        >
          <li v-for="(line, index) in listedWarnings" :key="`warning-${index}`">
            {{ line }}
          </li>
        </ul>
      </div>
      <div class="min-w-0">
        <p class="mb-1 text-xs font-medium">Example Default config</p>
        <pre
          class="bg-muted/40 max-h-64 overflow-auto rounded-lg border p-3 font-mono text-[11px] leading-snug"
        >{{ exampleConfig ?? "Loading example…" }}</pre>
      </div>
    </div>

    <div
      class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
      v-else
    >
      Configuration found — no issues detected.
    </div>
  </section>
</template>
