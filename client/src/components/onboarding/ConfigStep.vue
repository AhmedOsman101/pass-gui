<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { TriangleAlert } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Logger } from "@/lib/logger";
import { Config } from "@/services/config";
import { Dialog } from "@/services/dialog";
import { Fs } from "@/services/filesystem";
import type { ConfigStatus } from "@/types/onboarding";

type ConfigStepProps = {
  status: ConfigStatus;
  errors: string[];
  warnings: string[];
};

const props = defineProps<ConfigStepProps>();
const emit = defineEmits<{ written: []; recheck: [] }>();

/** The Default config example, byte-identical to what "Use default" writes. */
const exampleConfig = ref<string | null>(null);
const pastedText = ref("");
const busy = ref(false);
const errorLines = ref<string[]>([]);

/** A config that exists but cannot be used: schema or content problem. */
const isInvalid = computed(
  () =>
    props.status.exists &&
    (!props.status.schemaValid || props.status.contentValid === false)
);

/** The issue list + example grid shows for missing, invalid, or warned configs. */
const showDiagnostics = computed(
  () =>
    !props.status.exists ||
    isInvalid.value ||
    props.warnings.length > 0
);

/** Import failures live here; validator findings arrive as props. */
const listedErrors = computed(() =>
  props.status.exists ? props.errors : errorLines.value
);
const listedWarnings = computed(() =>
  props.status.exists ? props.warnings : []
);

const issueHeading = computed(() => {
  if (!props.status.exists) return "Import failed:";
  return listedErrors.value.length > 0
    ? "Configuration issues:"
    : "Configuration warnings:";
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

function showErrors(error: Error): void {
  errorLines.value = error.message
    .split("\n")
    .filter(line => line.trim() !== "");
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
        <p class="mt-1 text-xs text-muted-foreground">
          Choose how to set up the Default config before continuing.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button size="sm" :disabled="busy" @click="useDefault">
          Use default
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="chooseFile"
        >
          Choose file…
        </Button>
      </div>

      <div class="space-y-2">
        <label for="config-paste" class="block text-xs font-medium">
          Or paste TOML
        </label>
        <textarea
          id="config-paste"
          v-model="pastedText"
          rows="6"
          spellcheck="false"
          class="w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
          placeholder="Paste config.toml contents here"
        />
        <Button
          variant="outline"
          size="sm"
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
        <p class="mt-1 text-xs text-muted-foreground">
          Fix the issues below, then use Re-check.
        </p>
      </div>

      <Button variant="outline" size="sm" @click="emit('recheck')">
        Re-check
      </Button>
    </template>

    <!-- Errors sit beside the example so they can be compared directly. -->
    <div v-if="showDiagnostics" class="grid gap-4 sm:grid-cols-2">
      <div
        v-if="listedErrors.length > 0 || listedWarnings.length > 0"
        class="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
      >
        <p class="mb-1 flex items-center gap-2 font-medium">
          <TriangleAlert class="size-3.5 shrink-0" />
          {{ issueHeading }}
        </p>
        <ul v-if="listedErrors.length > 0" class="list-disc space-y-0.5 pl-4">
          <li v-for="(line, index) in listedErrors" :key="`error-${index}`">
            {{ line }}
          </li>
        </ul>
        <ul
          v-if="listedWarnings.length > 0"
          class="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground"
        >
          <li v-for="(line, index) in listedWarnings" :key="`warning-${index}`">
            {{ line }}
          </li>
        </ul>
      </div>
      <div class="min-w-0">
        <p class="mb-1 text-xs font-medium">Example Default config</p>
        <pre
          class="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-snug"
        >{{ exampleConfig ?? "Loading example…" }}</pre>
      </div>
    </div>

    <div
      v-else
      class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
    >
      Configuration found — no issues detected.
    </div>
  </section>
</template>
