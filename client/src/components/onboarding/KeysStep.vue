<script lang="ts" setup>
import { Loader2, RefreshCw, TriangleAlert } from "@lucide/vue";
import type { ExecCommandResult } from "@neutralinojs/lib";
import type { Result } from "lib-result";
import { toast } from "sonner";
import { computed, reactive, ref } from "vue";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamBox } from "@/components/ui/stream-box";
import { CommandFailedError } from "@/lib/errors";
import { Logger } from "@/lib/logger";
import { Dialog } from "@/services/dialog";
import { Gpg, type GpgKeyCommand } from "@/services/gpg";
import { useReadinessStore } from "@/stores/readiness";
import type { SecretKey } from "@/types";

type KeysStepProps = {
  /** Store path for Re-check (and the auto re-run after a successful GPG run). */
  storePath: string | null;
};

type CreateKeyForm = {
  name: string;
  email: string;
  expiry: string;
  passphrase: string;
};

type RunState = {
  command: string;
  stdout: string;
  stderr: string;
  running: boolean;
  exitCode: number | null;
};

const props = defineProps<KeysStepProps>();
const readiness = useReadinessStore();

/** GPG durations: 0 (never), Nd/Nw/Nm/Ny, or an ISO date (gpg.man:392). */
const EXPIRY_PATTERN = /^(?:0|\d+[dwmy]|\d{4}-\d{2}-\d{2})$/i;

/**
 * Inline form schema (decision Q4): only this step validates these fields,
 * so the schema stays beside its consumer instead of in config-validation.
 */
const CreateKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  expiry: z
    .string()
    .trim()
    .refine(
      value => value === "" || EXPIRY_PATTERN.test(value),
      "Use 0, Nd/Nw/Nm/Ny (e.g. 2y), or YYYY-MM-DD; empty means never"
    ),
});

const form = reactive<CreateKeyForm>({
  name: "",
  email: "",
  expiry: "",
  passphrase: "",
});
const formErrors = ref<Record<string, string>>({});
const pastedKey = ref("");
const run = ref<RunState | null>(null);
const runError = ref<string | null>(null);
const newKey = ref<SecretKey | null>(null);

/** Reentrancy lock: set synchronously, before any await in an action. */
const busy = ref(false);
const anyRunActive = computed(() => busy.value);
const canRecheck = computed(
  () =>
    props.storePath !== null && !readiness.isEvaluating && !anyRunActive.value
);

function appendRun(field: "stdout" | "stderr", chunk: string): void {
  if (run.value === null) return;
  run.value[field] += chunk;
}

function setFormErrors(error: z.ZodError): void {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  formErrors.value = errors;
}

/**
 * Single lock for every entry point (create, file import, paste import).
 * A double-click before the first await cannot start a second GPG run
 * that would interleave output in the one StreamBox.
 */
async function withRunLock(action: () => Promise<void>): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    await action();
  } finally {
    busy.value = false;
  }
}

async function currentKeyIds(): Promise<Set<string>> {
  const keys = await Gpg.listSecretKeys();
  return new Set(keys.isOk() ? keys.ok.map(key => key.keyId) : []);
}

function startRun(command: GpgKeyCommand): void {
  run.value = {
    command: command.display,
    stdout: "",
    stderr: "",
    running: true,
    exitCode: null,
  };
  runError.value = null;
  newKey.value = null;
}

/**
 * Shared completion path for create/import. A zero-exit refreshes the
 * keyring, surfaces the newly added key, and re-evaluates Readiness so
 * the step machine skips Keys once the keyring is non-empty. Raw failure
 * reasons go to the log only — the Stream box already holds GPG's own
 * output, and no secret is ever part of a message here.
 */
async function finishRun(
  result: Result<ExecCommandResult, Error>,
  beforeIds: Set<string>
): Promise<void> {
  if (result.isError()) {
    runError.value = "GPG command failed — see its output above.";
    if (run.value !== null) {
      // Keep GPG's real exit code for the Stream box; only a launch
      // failure (no CommandFailedError) falls back to a generic 1.
      run.value.exitCode =
        result.error instanceof CommandFailedError ? result.error.exitCode : 1;
      run.value.stderr += `\n${runError.value}`;
    }
    await Logger.error(`KeysStep: gpg failed: ${result.error.message}`);
    toast.error("The GPG command failed — check its output above.");
    return;
  }

  if (run.value !== null) run.value.exitCode = result.ok.exitCode;
  const keys = await Gpg.listSecretKeys();
  if (keys.isOk()) {
    newKey.value = keys.ok.find(key => !beforeIds.has(key.keyId)) ?? null;
  }
  toast.success("GPG key ready.");
  if (props.storePath !== null) await readiness.evaluate(props.storePath);
}

async function performRun(command: GpgKeyCommand): Promise<void> {
  const beforeIds = await currentKeyIds();
  startRun(command);
  try {
    const result = await Gpg.runKeyCommand(command, {
      onStdOut: chunk => appendRun("stdout", chunk),
      onStdErr: chunk => appendRun("stderr", chunk),
    });
    await finishRun(result, beforeIds);
  } finally {
    // The Stream box stays in "running" state until the key refresh and
    // Readiness re-evaluation have fully completed.
    if (run.value !== null) run.value.running = false;
  }
}

async function createKey(): Promise<void> {
  await withRunLock(async () => {
    const parsed = CreateKeySchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(parsed.error);
      return;
    }
    formErrors.value = {};
    const { name, email, expiry } = parsed.data;
    // Passphrase is intentionally outside the schema (never validated or
    // logged); read it straight from the masked field before clearing it.
    const command = Gpg.createKeyCommand(name, email, expiry, form.passphrase);
    // Masked input is cleared as soon as the command is built — the secret
    // now lives only in the command's stdin, never in a field or the display.
    form.passphrase = "";
    await performRun(command);
  });
}

/** File picker is one of the two import affordances; cancel is a no-op. */
async function importFile(): Promise<void> {
  await withRunLock(async () => {
    const picked = await Dialog.showOpenDialog("Import GPG key", {
      filters: [{ name: "GPG keys", extensions: ["asc", "gpg", "key"] }],
    });
    if (picked.isError()) {
      runError.value = `Could not open the file picker: ${picked.error.message}`;
      await Logger.error(
        `KeysStep: file picker failed: ${picked.error.message}`
      );
      return;
    }
    const path = picked.ok[0];
    if (path === undefined) return;
    await performRun(Gpg.importFileCommand(path));
  });
}

async function importPasted(): Promise<void> {
  await withRunLock(async () => {
    if (pastedKey.value.trim() === "") return;
    const command = Gpg.importTextCommand(pastedKey.value.trim());
    pastedKey.value = "";
    await performRun(command);
  });
}

async function recheck(): Promise<void> {
  if (props.storePath === null) return;
  await readiness.evaluate(props.storePath);
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <p class="text-sm font-medium">Encryption key</p>
        <p class="text-muted-foreground text-xs">
          Your keyring is empty. Create a key or import one to continue.
        </p>
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

    <div class="space-y-3 rounded-lg border p-3">
      <p class="text-sm font-medium">Create a new key</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <label class="block text-xs font-medium" for="key-name">Name</label>
          <Input
            autocomplete="name"
            id="key-name"
            placeholder="Jane Doe"
            v-model="form.name"
          />
          <p class="text-destructive text-xs" v-if="formErrors.name">
            {{ formErrors.name }}
          </p>
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-medium" for="key-email">Email</label>
          <Input
            autocomplete="email"
            id="key-email"
            placeholder="jane@example.com"
            v-model="form.email"
          />
          <p class="text-destructive text-xs" v-if="formErrors.email">
            {{ formErrors.email }}
          </p>
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-medium" for="key-expiry">
            Expiry
            <span class="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="key-expiry"
            placeholder="2y, 2028-01-01, or empty for never"
            v-model="form.expiry"
          />
          <p class="text-destructive text-xs" v-if="formErrors.expiry">
            {{ formErrors.expiry }}
          </p>
        </div>
        <div class="space-y-1">
          <label class="block text-xs font-medium" for="key-passphrase">
            Passphrase
            <span class="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            autocomplete="new-password"
            id="key-passphrase"
            placeholder="Sent on stdin, never stored"
            type="password"
            v-model="form.passphrase"
          />
        </div>
      </div>
      <Button size="sm" :disabled="anyRunActive" @click="createKey">
        Create key
      </Button>
    </div>

    <div class="space-y-3 rounded-lg border p-3">
      <p class="text-sm font-medium">Import an existing key</p>
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          :disabled="anyRunActive"
          @click="importFile"
        >
          Choose file…
        </Button>
      </div>
      <div class="space-y-2">
        <label class="block text-xs font-medium" for="key-paste">
          Or paste an armored key
        </label>
        <textarea
          class="border-input bg-background w-full rounded-md border p-2 font-mono text-xs"
          id="key-paste"
          placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
          rows="5"
          spellcheck="false"
          v-model="pastedKey"
        />
        <Button
          size="sm"
          variant="outline"
          :disabled="anyRunActive || pastedKey.trim() === ''"
          @click="importPasted"
        >
          Import pasted key
        </Button>
      </div>
    </div>

    <p
      class="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
      role="alert"
      v-if="runError"
    >
      <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
      <span>{{ runError }}</span>
    </p>

    <div
      class="bg-muted/40 rounded-lg border p-3 text-xs"
      v-if="newKey !== null"
    >
      <p class="font-medium">Key ready</p>
      <p class="text-muted-foreground mt-1 break-all">
        {{ newKey.userId }} · {{ newKey.keyId }}
      </p>
    </div>

    <StreamBox
      v-if="run"
      :command="run.command"
      :default-open="run.running"
      :exit-code="run.exitCode"
      :running="run.running"
      :stderr="run.stderr"
      :stdout="run.stdout"
    />
  </section>
</template>
