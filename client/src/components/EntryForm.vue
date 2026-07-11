<script setup lang="ts">
import { ref, computed, watch, toRef } from "vue";
import {
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  generateMemorablePassword,
  generatePassword,
} from "@/lib/generate-password";
import { useEntryTreeStore } from "@/stores/entry-tree";
import { useEntryFormStore } from "@/stores/entry-form";
import { useGenerationConfig } from "@/composables/use-generation-config";

const treeStore = useEntryTreeStore();
const formStore = useEntryFormStore();
const gen = useGenerationConfig();

const isEdit = computed(() => formStore.formMode === "edit");
// Path — editable in create mode, read-only in edit mode
const path = ref("");
watch(
  () => formStore.formMode,
  (mode) => {
    if (mode === "create") {
      path.value = "";
    } else if (mode === "edit" && treeStore.currentEntry) {
      path.value = treeStore.currentEntry.path;
    }
  },
  { immediate: true }
);

// Password
const secret = ref("");
const isSecretVisible = ref(true);
const showGeneratorOptions = ref(false);
const genMemorable = toRef(gen.options, "memorable");
const genLength = toRef(gen.options, "length");
const genSymbols = toRef(gen.options, "symbols");

// Auto-generate when form opens in create mode
watch(
  () => formStore.formMode,
  (mode) => {
    if (mode === "create" && !formStore.formPresetPassword) {
      regeneratePassword();
    }
  },
  { immediate: true },
);

// Initialize secret from entry or preset
watch(
  () => [formStore.formMode, formStore.formPresetPassword, treeStore.currentEntry],
  () => {
    if (formStore.formMode === "create" && formStore.formPresetPassword) {
      secret.value = formStore.formPresetPassword;
      isSecretVisible.value = true;
    } else if (formStore.formMode === "edit" && treeStore.currentEntry) {
      secret.value = treeStore.currentEntry.secret;
      isSecretVisible.value = false;
    }
    // create-without-preset is handled by the config load watcher above
  },
  { immediate: true }
);

// Metadata
type MetaEntry = { key: string; value: string };
const metadata = ref<MetaEntry[]>([]);

watch(
  () => [formStore.formMode, treeStore.currentEntry],
  () => {
    if (formStore.formMode === "edit" && treeStore.currentEntry) {
      metadata.value = Object.entries(treeStore.currentEntry.metadata).map(
        ([key, value]) => ({ key, value })
      );
    } else {
      metadata.value = [];
    }
  },
  { immediate: true }
);

function addMetadata(): void {
  metadata.value.push({ key: "", value: "" });
}

function removeMetadata(index: number): void {
  metadata.value.splice(index, 1);
}

// Form state
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

// Duplicate key validation
const duplicateKeys = computed(() => {
  const keys = metadata.value
    .map(m => m.key.trim())
    .filter(k => k.length > 0);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) dupes.add(k);
    seen.add(k);
  }
  return dupes;
});

const hasDuplicateKeys = computed(() => duplicateKeys.value.size > 0);

// Generate password with current options
function regeneratePassword(): void {
  if (genMemorable.value) {
    secret.value = generateMemorablePassword();
  } else {
    const charset = genSymbols.value
      ? "[[:alnum:]][[:punct:]]"
      : "[[:alnum:]]";
    secret.value = generatePassword(genLength.value, charset);
  }
  isSecretVisible.value = true;
}

// Build content string from form fields
function buildContent(): string {
  const lines = [secret.value];
  for (const meta of metadata.value) {
    if (meta.key.trim()) {
      lines.push(`${meta.key}: ${meta.value}`);
    }
  }
  return lines.join("\n");
}

// Submit
async function handleSubmit(): Promise<void> {
  if (!path.value.trim()) {
    formError.value = "Path is required";
    return;
  }

  if (!secret.value) {
    formError.value = "Password is required";
    return;
  }

  if (hasDuplicateKeys.value) {
    formError.value = `Duplicate metadata keys: ${[...duplicateKeys.value].join(", ")}`;
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  const content = buildContent();
  let result: string | null;

  if (isEdit.value) {
    result = await treeStore.editEntry(path.value, content);
  } else {
    result = await treeStore.insertEntry(path.value, content);
  }

  isSubmitting.value = false;

  if (result) {
    formError.value = result;
    return;
  }

  formStore.closeForm();
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-2xl">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" @click="formStore.closeForm()">
        <ArrowLeft class="size-4" />
      </Button>
      <h2 class="text-lg font-semibold">
        {{ isEdit ? "Edit Entry" : "New Entry" }}
      </h2>
    </div>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <!-- Path -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Path
        </label>
        <input
          v-model="path"
          type="text"
          placeholder="Email/work"
          :disabled="isEdit"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p v-if="isEdit" class="text-xs text-muted-foreground">
          Path cannot be changed after creation. Use Rename to change it.
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Store-relative path, e.g. <code>Email/work</code>
        </p>
      </div>

      <!-- Password -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Password
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs"
            @click="showGeneratorOptions = !showGeneratorOptions"
          >
            <RefreshCw class="size-3 mr-1" />
            {{ showGeneratorOptions ? "Hide Generator" : "Generate" }}
          </Button>
        </div>

        <!-- Password input with toggle -->
        <div class="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <code class="flex-1 font-mono text-sm break-all">
            <template v-if="isSecretVisible">{{ secret }}</template>
            <template v-else>
              {{ secret ? "••••••••••••••••" : "—" }}
            </template>
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            :disabled="!secret"
            @click="isSecretVisible = !isSecretVisible"
          >
            <EyeOff v-if="isSecretVisible" class="size-4" />
            <Eye v-else class="size-4" />
          </Button>
        </div>

        <!-- Inline generator options -->
        <div v-if="showGeneratorOptions" class="rounded-lg border p-4 space-y-4">
          <!-- Memorable toggle -->
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Memorable</label>
            <button
              type="button"
              role="switch"
              :aria-checked="genMemorable"
              class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              :class="genMemorable ? 'bg-primary' : 'bg-input'"
              @click="genMemorable = !genMemorable"
            >
              <span
                class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
                :class="genMemorable ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Length slider + numeric -->
          <div v-if="!genMemorable" class="space-y-2">
            <label class="text-sm font-medium">Length</label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="genLength"
                type="range"
                min="8"
                max="64"
                class="flex-1"
              />
              <input
                v-model.number="genLength"
                type="number"
                min="8"
                max="64"
                class="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>

          <!-- Symbols toggle -->
          <div v-if="!genMemorable" class="flex items-center justify-between">
            <label class="text-sm font-medium">Symbols</label>
            <button
              type="button"
              role="switch"
              :aria-checked="genSymbols"
              class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              :class="genSymbols ? 'bg-primary' : 'bg-input'"
              @click="genSymbols = !genSymbols"
            >
              <span
                class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
                :class="genSymbols ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <p v-if="genMemorable" class="text-xs text-muted-foreground">
            Format: NNNN-word-word-word (4 digits + 3 EFF words)
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            class="w-full"
            @click="regeneratePassword"
          >
            <RefreshCw class="size-4 mr-2" />
            Generate New Password
          </Button>
        </div>
      </div>

      <!-- Metadata -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Metadata
        </label>

        <div v-if="metadata.length > 0" class="space-y-2">
          <div
            v-for="(meta, index) in metadata"
            :key="index"
            class="flex items-start gap-2"
          >
            <input
              v-model="meta.key"
              type="text"
              placeholder="Key"
              class="w-1/3 rounded-md border bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              :class="duplicateKeys.has(meta.key.trim()) ? 'border-destructive' : 'border-input'"
            />
            <textarea
              v-model="meta.value"
              rows="1"
              placeholder="Value"
              class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y max-h-32"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-9 shrink-0 mt-0.5"
              @click="removeMetadata(index)"
            >
              <Trash2 class="size-4 text-destructive" />
            </Button>
          </div>
        </div>

        <p v-if="hasDuplicateKeys" class="text-xs text-destructive">
          Duplicate keys: {{ [...duplicateKeys].join(", ") }} — last value wins on save.
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          class="w-full"
          @click="addMetadata"
        >
          <Plus class="size-4 mr-1" />
          Add Metadata
        </Button>
      </div>

      <!-- Error -->
      <p v-if="formError" class="text-sm text-destructive">
        {{ formError }}
      </p>

      <!-- Actions -->
      <div class="flex items-center gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          @click="formStore.closeForm()"
        >
          Cancel
        </Button>
        <Button type="submit" :disabled="isSubmitting">
          <Save class="size-4 mr-1" />
          {{ isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Entry" }}
        </Button>
      </div>
    </form>
  </div>
</template>
