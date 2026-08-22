<script setup lang="ts">
import { ArrowRightLeft, Copy, Eye, EyeOff, Files, Pencil, Plus, Scissors, Sparkles, SquarePen, Trash2, X } from "@lucide/vue";
import { computed, ref, shallowRef, watch } from "vue";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog.vue";
import EntryForm from "@/components/EntryForm.vue";
import MoveOrDuplicateDialog from "@/components/MoveOrDuplicateDialog.vue";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";
import PasswordGenerator from "@/components/PasswordGenerator.vue";
import { useClipboardStore } from "@/stores/clipboard";
import { useEntryTreeStore } from "@/stores/entry-tree";
import { useEntryFormStore } from "@/stores/entry-form";

const treeStore = useEntryTreeStore();
const formStore = useEntryFormStore();
const clipboard = useClipboardStore();

const isSecretVisible = shallowRef<boolean>(false);
const isDeleteOpen = ref(false);
const isRenameOpen = ref(false);

const entry = computed(() => treeStore.currentEntry);

const showSkeleton = ref(false);
let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => treeStore.currentPath,
  () => {
    showSkeleton.value = false;
    if (skeletonTimer) {
      clearTimeout(skeletonTimer);
      skeletonTimer = null;
    }

    if (treeStore.currentPath) {
      skeletonTimer = setTimeout(() => {
        if (treeStore.currentEntry?.path !== treeStore.currentPath) {
          showSkeleton.value = true;
        }
      }, 500);
    }
  },
);

watch(
  () => treeStore.currentEntry,
  (entry) => {
    if (entry && entry.path === treeStore.currentPath) {
      showSkeleton.value = false;
      if (skeletonTimer) {
        clearTimeout(skeletonTimer);
        skeletonTimer = null;
      }
    }
  },
);

const editPath = computed(() => treeStore.currentPath ?? "");

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

async function copySecret(): Promise<void> {
  if (!entry.value || !treeStore.currentPath) return;
  const result = await clipboard.copy(
    entry.value.secret,
    treeStore.currentPath
  );
  result.match({
    okFn: (action) => {
      toast.success("Password copied", {
        description: `Clears in ${action.timerSeconds}s · ${treeStore.currentPath}`,
        action: {
          label: "Clear",
          onClick: () => void clipboard.clear(),
        },
        duration: action.timerSeconds * 1000,
      });
    },
    errFn: (e) => toast.error(`Copy failed: ${e.message}`),
  });
}

async function copyValue(value: string, label: string): Promise<void> {
  const result = await clipboard.copy(value, treeStore.currentPath ?? "");
  result.match({
    okFn: (action) => {
      toast.success(`${label} copied`, {
        description: `Clears in ${action.timerSeconds}s`,
        action: {
          label: "Clear",
          onClick: () => void clipboard.clear(),
        },
        duration: action.timerSeconds * 1000,
      });
    },
    errFn: (e) => toast.error(`Copy failed: ${e.message}`),
  });
}
</script>

<template>
  <!-- Entry form (create or edit) -->
  <EntryForm v-if="formStore.isFormOpen" />

  <!-- Loading -->
  <div v-else-if="showSkeleton" class="p-6 space-y-4">
    <div class="h-6 w-48 bg-muted animate-pulse rounded" />
    <div class="h-10 w-full bg-muted animate-pulse rounded" />
    <div class="h-20 w-full bg-muted animate-pulse rounded" />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="!entry"
    class="flex flex-col items-center justify-center h-full text-muted-foreground space-y-6"
  >
    <div class="text-center space-y-2">
      <p class="text-sm">No entry selected</p>
      <p class="text-xs">Choose an entry from the sidebar or create a new one.</p>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" @click="formStore.openCreateForm()">
        <Plus class="size-4 mr-1" />
        New Entry
      </Button>
      <PasswordGenerator @save="(pw: string) => formStore.openCreateForm(pw)">
        <Button variant="outline" size="sm">
          <Sparkles class="size-4 mr-1" />
          Generate
        </Button>
      </PasswordGenerator>
    </div>
  </div>

  <!-- Entry detail -->
  <TooltipProvider v-else>
    <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <h2 class="text-lg font-semibold font-mono">{{ entry.path }}</h2>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            aria-label="Close entry"
            @click="treeStore.clearSelection()"
          >
            <X class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close entry</TooltipContent>
      </Tooltip>
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
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 shrink-0"
              :aria-label="isSecretVisible ? 'Hide password' : 'Show password'"
              @click="toggleSecret"
            >
              <EyeOff v-if="isSecretVisible" class="size-4" />
              <Eye v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ isSecretVisible ? "Hide password" : "Show password" }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 shrink-0"
              aria-label="Copy password"
              @click="copySecret"
            >
              <Copy class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy password</TooltipContent>
        </Tooltip>
      </div>
      <p class="sr-only" role="status">Password {{ isSecretVisible ? "shown" : "hidden" }}</p>
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
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 shrink-0"
                :aria-label="`Copy ${getLabel(key)}`"
                @click="copyValue(value, getLabel(key))"
              >
                <Copy class="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy {{ getLabel(key) }}</TooltipContent>
          </Tooltip>
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
      <MoveOrDuplicateDialog v-if="treeStore.currentPath" mode="duplicate" :current-path="treeStore.currentPath">
        <Button variant="outline" size="sm">
          <Files class="size-4 mr-1" />
          Duplicate
        </Button>
      </MoveOrDuplicateDialog>
      <Button
        v-if="treeStore.currentPath && entry"
        variant="outline"
        size="sm"
        @click="formStore.openEditForm(editPath)"
      >
        <SquarePen class="size-4 mr-1" />
        Edit
      </Button>
      <RenameEntryDialog
        v-if="treeStore.currentPath"
        :current-path="treeStore.currentPath"
        v-model:open="isRenameOpen"
      >
        <Button
          variant="outline"
          size="sm"
          @click="isRenameOpen = true"
        >
          <Pencil class="size-4 mr-1" />
          Rename
        </Button>
      </RenameEntryDialog>
      <MoveOrDuplicateDialog v-if="treeStore.currentPath" mode="move" :current-path="treeStore.currentPath">
        <Button variant="outline" size="sm">
          <ArrowRightLeft class="size-4 mr-1" />
          Move
        </Button>
      </MoveOrDuplicateDialog>
      <DeleteConfirmDialog
        v-if="treeStore.currentPath"
        :entry-path="treeStore.currentPath"
        v-model:open="isDeleteOpen"
      >
        <Button
          variant="outline"
          size="sm"
          class="text-destructive hover:text-destructive"
          @click="isDeleteOpen = true"
        >
          <Trash2 class="size-4 mr-1" />
          Delete
        </Button>
      </DeleteConfirmDialog>
    </div>
    </div>
  </TooltipProvider>
</template>
