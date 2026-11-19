<script lang="ts" setup>
import { ArrowLeft, Eye, EyeOff, Plus, Save, Trash2 } from "@lucide/vue";
import type { Result } from "lib-result";
import { computed, ref, watch } from "vue";
import GeneratorOptionsPanel from "@/components/GeneratorOptionsPanel.vue";
import { Button } from "@/components/ui/button";
import { usePasswordGenerator } from "@/composables/use-password-generator";
import {
  type MetadataEntry,
  parseEntryContent,
  serializeEntryContent,
} from "@/lib/entry-content";
import type { EntriesReadError, EntriesWriteError } from "@/services/entries";
import { useEntryFormStore } from "@/stores/entry-form";
import { useEntryTreeStore } from "@/stores/entry-tree";
import type { MutationResult } from "@/types/entries";

const treeStore = useEntryTreeStore();
const formStore = useEntryFormStore();
const isEdit = computed(() => formStore.formMode === "edit");

// Editor mode
const editorMode = ref<"form" | "raw">("form");
const rawContent = ref("");

// Path — editable in create mode, read-only in edit mode
const path = ref("");
watch(
  () => formStore.formMode,
  mode => {
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
const isSecretVisible = ref(false);
const showGeneratorOptions = ref(false);
const genOptions = usePasswordGenerator();

// OTP URI
const otpUri = ref("");

// Notes
const notes = ref("");

// Metadata
const metadata = ref<MetadataEntry[]>([]);

// Initialize from entry or preset
watch(
  () => [
    formStore.formMode,
    formStore.formPresetPassword,
    treeStore.currentEntry,
  ],
  () => {
    if (formStore.formMode === "create") {
      // Empty until Generate is pressed (preset from the generator dialog
      // still applies, everything else resets fresh).
      secret.value = formStore.formPresetPassword ?? "";
      otpUri.value = "";
      metadata.value = [];
      notes.value = "";
      isSecretVisible.value = false;
    } else if (formStore.formMode === "edit" && treeStore.currentEntry) {
      const draft = parseEntryContent(treeStore.currentEntry.raw);
      secret.value = draft.secret;
      otpUri.value = draft.otpUri;
      metadata.value = draft.metadata;
      notes.value = draft.notes;
      isSecretVisible.value = false;
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
  const keys = metadata.value.map(m => m.key.trim()).filter(k => k.length > 0);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) dupes.add(k);
    seen.add(k);
  }
  return dupes;
});

const hasDuplicateKeys = computed(() => duplicateKeys.value.size > 0);

function toggleGenerator(): void {
  showGeneratorOptions.value = !showGeneratorOptions.value;
  if (showGeneratorOptions.value && genOptions.generated) {
    secret.value = genOptions.generated;
    isSecretVisible.value = true;
  }
}

function onRegenerate(): void {
  genOptions.regenerate();
  secret.value = genOptions.generated;
  isSecretVisible.value = true;
}

watch(
  () => genOptions.generated,
  val => {
    if (showGeneratorOptions.value && val) {
      secret.value = val;
      isSecretVisible.value = true;
    }
  }
);

// Mode conversion
function toRawMode(): void {
  rawContent.value = serializeEntryContent({
    secret: secret.value,
    otpUri: otpUri.value,
    metadata: metadata.value,
    notes: notes.value,
  });
  editorMode.value = "raw";
}

function toFormMode(): void {
  const draft = parseEntryContent(rawContent.value);
  secret.value = draft.secret;
  otpUri.value = draft.otpUri;
  metadata.value = draft.metadata;
  notes.value = draft.notes;
  editorMode.value = "form";
}

// Build content string from canonical draft
function buildContent(): string {
  return serializeEntryContent({
    secret: secret.value,
    otpUri: otpUri.value,
    metadata: metadata.value,
    notes: notes.value,
  });
}

// Submit
async function handleSubmit(): Promise<void> {
  if (!path.value.trim()) {
    formError.value = "Path is required";
    return;
  }

  // Sync raw to canonical refs before validation
  if (editorMode.value === "raw") {
    const draft = parseEntryContent(rawContent.value);
    secret.value = draft.secret;
    otpUri.value = draft.otpUri;
    metadata.value = draft.metadata;
    notes.value = draft.notes;
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
  let result: Result<MutationResult, EntriesReadError | EntriesWriteError>;

  if (isEdit.value) {
    result = await treeStore.editEntry(path.value, content);
  } else {
    result = await treeStore.insertEntry(path.value, content);
  }

  isSubmitting.value = false;

  result.match({
    okFn: () => {
      formStore.closeForm();
    },
    errFn: e => {
      formError.value = e.message;
    },
  });
}
</script>

<template>
  <div class="max-w-2xl space-y-6 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button
          class="size-8"
          size="icon"
          variant="ghost"
          @click="formStore.closeForm()"
        >
          <ArrowLeft class="size-4" />
        </Button>
        <h2 class="text-lg font-semibold">
          {{ isEdit ? "Edit Entry" : "New Entry" }}
        </h2>
      </div>
      <div class="flex items-center gap-1 rounded-md border p-1">
        <Button
          size="sm"
          type="button"
          :variant="editorMode === 'form' ? 'secondary' : 'ghost'"
          @click="toFormMode"
        >
          Form
        </Button>
        <Button
          size="sm"
          type="button"
          :variant="editorMode === 'raw' ? 'secondary' : 'ghost'"
          @click="toRawMode"
        >
          Raw
        </Button>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <!-- Path -->
      <div class="space-y-2">
        <label
          class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          for="entry-path"
        >
          Path
        </label>
        <input
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          id="entry-path"
          placeholder="Email/work"
          type="text"
          v-model="path"
          :disabled="isEdit"
        >
        <p class="text-muted-foreground text-xs" v-if="isEdit">
          Path cannot be changed after creation. Use Rename to change it.
        </p>
        <p class="text-muted-foreground text-xs" v-else>
          Store-relative path, e.g. <code>Email/work</code>
        </p>
      </div>

      <!-- Form mode -->
      <template v-if="editorMode === 'form'">
        <!-- Password -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label
              class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
              for="entry-password"
            >
              Password
            </label>
            <Button
              class="h-7 px-2 text-xs"
              size="sm"
              type="button"
              variant="ghost"
              @click="toggleGenerator"
            >
              {{ showGeneratorOptions ? "Hide Generator" : "Generate" }}
            </Button>
          </div>

          <!-- Password input with toggle -->
          <div
            class="border-input bg-muted/50 focus-within:ring-ring flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:ring-2"
          >
            <input
              class="placeholder:text-muted-foreground flex-1 bg-transparent font-mono text-sm outline-none"
              id="entry-password"
              placeholder="—"
              v-model="secret"
              :type="isSecretVisible ? 'text' : 'password'"
            >
            <Button
              class="size-8 shrink-0"
              size="icon"
              type="button"
              variant="ghost"
              :disabled="!secret"
              @click="isSecretVisible = !isSecretVisible"
            >
              <EyeOff class="size-4" v-if="isSecretVisible" />
              <Eye class="size-4" v-else />
            </Button>
          </div>

          <GeneratorOptionsPanel
            v-if="showGeneratorOptions"
            v-model:gen-state="genOptions"
            :show-value="false"
            @regenerate="onRegenerate"
          />
        </div>

        <!-- OTP URI -->
        <div class="space-y-2">
          <label
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            for="entry-otp-uri"
            >OTP URI</label
          >
          <textarea
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full resize-y rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
            id="entry-otp-uri"
            placeholder="otpauth://totp/..."
            rows="2"
            v-model="otpUri"
          />
        </div>

        <!-- Metadata -->
        <div class="space-y-2">
          <div
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            Metadata
          </div>

          <div class="space-y-2" v-if="metadata.length > 0">
            <div
              class="flex items-start gap-2"
              v-for="(meta, index) in metadata"
              :key="index"
            >
              <input
                class="bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-1/3 rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                placeholder="Key"
                type="text"
                v-model="meta.key"
                :class="
                  duplicateKeys.has(meta.key.trim())
                    ? 'border-destructive'
                    : 'border-input'
                "
              >
              <textarea
                class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring max-h-32 flex-1 resize-y rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                placeholder="Value"
                rows="1"
                v-model="meta.value"
              />
              <Button
                class="mt-0.5 size-9 shrink-0"
                size="icon"
                type="button"
                variant="ghost"
                @click="removeMetadata(index)"
              >
                <Trash2 class="text-destructive size-4" />
              </Button>
            </div>
          </div>

          <p class="text-destructive text-xs" v-if="hasDuplicateKeys">
            Duplicate keys: {{ [...duplicateKeys].join(", ") }} — last value
            wins on save.
          </p>

          <Button
            class="w-full"
            size="sm"
            type="button"
            variant="outline"
            @click="addMetadata"
          >
            <Plus class="mr-1 size-4" />
            Add Metadata
          </Button>
        </div>

        <!-- Notes -->
        <div class="space-y-2">
          <label
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            for="entry-notes"
            >Notes</label
          >
          <textarea
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full resize-y rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
            id="entry-notes"
            placeholder="Any lines that are not key: value pairs"
            rows="4"
            v-model="notes"
          />
        </div>
      </template>

      <!-- Raw mode -->
      <div class="space-y-2" v-else>
        <label
          class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          for="entry-raw-content"
          >Entry content</label
        >
        <textarea
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full resize-y rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
          id="entry-raw-content"
          rows="14"
          v-model="rawContent"
        />
        <p class="text-muted-foreground text-xs">
          First line is required password. Later <code>key: value</code> lines
          are metadata; first <code>otpauth://...</code> line is OTP; other
          lines are notes.
        </p>
      </div>

      <!-- Error -->
      <p class="text-destructive text-sm" v-if="formError">
        {{ formError }}
      </p>

      <!-- Actions -->
      <div class="flex items-center gap-2 border-t pt-4">
        <Button type="button" variant="outline" @click="formStore.closeForm()">
          Cancel
        </Button>
        <Button type="submit" :disabled="isSubmitting">
          <Save class="mr-1 size-4" />
          {{
            isSubmitting
              ? "Saving..."
              : isEdit
                ? "Save Changes"
                : "Create Entry"
          }}
        </Button>
      </div>
    </form>
  </div>
</template>
