<script setup lang="ts">
import { Eye, EyeOff, Copy, ArrowRightLeft, Trash2, Pencil, SquarePen, Files } from "@lucide/vue";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog.vue";
import DuplicateEntryDialog from "@/components/DuplicateEntryDialog.vue";
import EditEntryDialog from "@/components/EditEntryDialog.vue";
import MoveEntryDialog from "@/components/MoveEntryDialog.vue";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";
import { useClipboardStore } from "@/stores/clipboard";
import { useEntriesStore } from "@/stores/entries";

const entries = useEntriesStore();
const clipboard = useClipboardStore();

const isSecretVisible = ref(false);

const entry = computed(() => entries.currentEntry);
const showSkeleton = computed(() => entries.showEntrySkeleton);

const metadataEntries = computed(() => {
  if (!entry.value) return [];
  return Object.entries(entry.value.metadata);
});

const friendlyLabels: Record<string, string> = {
  username: "Username",
  URL: "Website",
  url: "Website",
  otp: "OTP Secret",
  login: "Login",
  email: "Email",
  host: "Host",
  note: "Note",
};

function getLabel(key: string): string {
  return friendlyLabels[key] ?? key;
}

function toggleSecret(): void {
  isSecretVisible.value = !isSecretVisible.value;
}

function copySecret(): void {
  if (!entry.value || !entries.currentPath) return;
  clipboard.copy(entry.value.secret, entries.currentPath);
}

function copyValue(value: string): void {
  clipboard.copy(value, entries.currentPath ?? "");
}
</script>

<template>
  <!-- Loading -->
  <div v-if="showSkeleton" class="p-6 space-y-4">
    <div class="h-6 w-48 bg-muted animate-pulse rounded" />
    <div class="h-10 w-full bg-muted animate-pulse rounded" />
    <div class="h-20 w-full bg-muted animate-pulse rounded" />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="!entry"
    class="flex items-center justify-center h-full text-muted-foreground"
  >
    <p class="text-sm">Select an entry from the sidebar</p>
  </div>

  <!-- Entry detail -->
  <div v-else class="p-6 space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-lg font-semibold font-mono">{{ entry.path }}</h2>
    </div>

    <!-- Secret field -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Password
      </label>
      <div class="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 mt-5">
        <code class="flex-1 font-mono text-sm break-all">
          <template v-if="isSecretVisible">{{ entry.secret }}</template>
          <template v-else>••••••••••••••••</template>
        </code>
        <Button
          variant="ghost"
          size="icon"
          class="size-8 shrink-0"
          @click="toggleSecret"
        >
          <EyeOff v-if="isSecretVisible" class="size-4" />
          <Eye v-else class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-8 shrink-0"
          @click="copySecret"
        >
          <Copy class="size-4" />
        </Button>
      </div>
    </div>

    <!-- Metadata -->
    <div v-if="metadataEntries.length > 0" class="space-y-2">
      <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Metadata
      </label>
      <div class="rounded-lg border divide-y my-5">
        <div
          v-for="[key, value] in metadataEntries"
          :key="key"
          class="flex items-center justify-between px-3 py-2"
        >
          <div class="min-w-0">
            <span class="text-xs text-muted-foreground">{{ getLabel(key) }}</span>
            <p class="text-sm font-mono truncate">{{ value }}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            @click="copyValue(value)"
          >
            <Copy class="size-3" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Other lines -->
    <div v-if="entry.other.length > 0" class="space-y-2">
      <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Notes
      </label>
      <div class="rounded-lg border bg-muted/50 px-3 py-2">
        <p
          v-for="(line, i) in entry.other"
          :key="i"
          class="text-sm font-mono"
        >
          {{ line }}
        </p>
      </div>
    </div>

    <div
      v-if="metadataEntries.length === 0 && entry.other.length === 0"
      class="text-sm text-muted-foreground"
    >
      No additional metadata
    </div>

    <!-- Actions bar -->
    <div class="flex items-center gap-2 px-2 py-5 border-t">
      <DuplicateEntryDialog v-if="entries.currentPath" :current-path="entries.currentPath">
        <Button variant="outline" size="sm">
          <Files class="size-4 mr-1" />
          Duplicate
        </Button>
      </DuplicateEntryDialog>
      <EditEntryDialog
        v-if="entries.currentPath && entry"
        :current-path="entries.currentPath"
        :current-content="entry.raw"
      >
        <Button variant="outline" size="sm">
          <SquarePen class="size-4 mr-1" />
          Edit
        </Button>
      </EditEntryDialog>
      <RenameEntryDialog v-if="entries.currentPath" :current-path="entries.currentPath">
        <Button variant="outline" size="sm">
          <Pencil class="size-4 mr-1" />
          Rename
        </Button>
      </RenameEntryDialog>
      <MoveEntryDialog v-if="entries.currentPath" :current-path="entries.currentPath">
        <Button variant="outline" size="sm">
          <ArrowRightLeft class="size-4 mr-1" />
          Move
        </Button>
      </MoveEntryDialog>
      <DeleteConfirmDialog v-if="entries.currentPath" :entry-path="entries.currentPath">
        <Button variant="outline" size="sm" class="text-destructive hover:text-destructive">
          <Trash2 class="size-4 mr-1" />
          Delete
        </Button>
      </DeleteConfirmDialog>
    </div>
  </div>
</template>
