<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { useEntryTreeStore } from "@/stores/entry-tree";
import { useEntryFormStore } from "@/stores/entry-form";
import { usePasswordGenerator } from "@/composables/use-password-generator";
import GeneratorOptionsPanel from "@/components/GeneratorOptionsPanel.vue";
import {
  parseEntryContent,
  serializeEntryContent,
  type MetadataEntry,
} from "@/lib/entry-content";

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
const genOptions = usePasswordGenerator();

// OTP URI
const otpUri = ref("");

// Notes
const notes = ref("");

// Metadata
const metadata = ref<MetadataEntry[]>([]);

// Auto-generate when form opens in create mode
watch(
  () => formStore.formMode,
  (mode) => {
    if (mode === "create" && !formStore.formPresetPassword) {
      secret.value = genOptions.generated;
      isSecretVisible.value = true;
    }
  },
  { immediate: true },
);

// Initialize from entry or preset
watch(
  () => [formStore.formMode, formStore.formPresetPassword, treeStore.currentEntry],
  () => {
    if (formStore.formMode === "create" && formStore.formPresetPassword) {
      secret.value = formStore.formPresetPassword;
      isSecretVisible.value = true;
    } else if (formStore.formMode === "edit" && treeStore.currentEntry) {
      const draft = parseEntryContent(treeStore.currentEntry.raw);
      secret.value = draft.secret;
      otpUri.value = draft.otpUri;
      metadata.value = draft.metadata;
      notes.value = draft.notes;
      isSecretVisible.value = false;
    }
    // create-without-preset is handled by the config load watcher above
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

function onRegenerate(): void {
  genOptions.regenerate();
  secret.value = genOptions.generated;
  isSecretVisible.value = true;
}

watch(() => genOptions.generated, (val) => {
  if (showGeneratorOptions.value && val) {
    secret.value = val;
    isSecretVisible.value = true;
  }
});

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
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="size-8" @click="formStore.closeForm()">
          <ArrowLeft class="size-4" />
        </Button>
        <h2 class="text-lg font-semibold">
          {{ isEdit ? "Edit Entry" : "New Entry" }}
        </h2>
      </div>
      <div class="flex items-center gap-1 rounded-md border p-1">
        <Button type="button" size="sm" :variant="editorMode === 'form' ? 'secondary' : 'ghost'" @click="toFormMode">
          Form
        </Button>
        <Button type="button" size="sm" :variant="editorMode === 'raw' ? 'secondary' : 'ghost'" @click="toRawMode">
          Raw
        </Button>
      </div>
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

      <!-- Form mode -->
      <template v-if="editorMode === 'form'">
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

          <GeneratorOptionsPanel
            v-if="showGeneratorOptions"
            v-model:gen-state="genOptions"
            @regenerate="onRegenerate"
          />
        </div>

        <!-- OTP URI -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">OTP URI</label>
          <textarea v-model="otpUri" rows="2" placeholder="otpauth://totp/..." class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y" />
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

        <!-- Notes -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
          <textarea v-model="notes" rows="4" placeholder="Any lines that are not key: value pairs" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y" />
        </div>
      </template>

      <!-- Raw mode -->
      <div v-else class="space-y-2">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entry content</label>
        <textarea v-model="rawContent" rows="14" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y" />
        <p class="text-xs text-muted-foreground">
          First line is required password. Later <code>key: value</code> lines are metadata; first <code>otpauth://...</code> line is OTP; other lines are notes.
        </p>
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
