<script lang="ts" setup>
import {
  ArrowRightLeft,
  Copy,
  Eye,
  EyeOff,
  Files,
  Pencil,
  Plus,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from "@lucide/vue";
import { toast } from "sonner";
import { computed, onUnmounted, ref, watch } from "vue";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog.vue";
import EntryForm from "@/components/EntryForm.vue";
import MoveOrDuplicateDialog from "@/components/MoveOrDuplicateDialog.vue";
import PasswordGenerator from "@/components/PasswordGenerator.vue";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNotifyResult } from "@/composables/use-notify-result";
import { useClipboardStore } from "@/stores/clipboard";
import { useEntryFormStore } from "@/stores/entry-form";
import { useEntryTreeStore } from "@/stores/entry-tree";

const treeStore = useEntryTreeStore();
const formStore = useEntryFormStore();
const clipboard = useClipboardStore();

const isSecretVisible = ref<boolean>(false);
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
  }
);

watch(
  () => treeStore.currentEntry,
  currentEntry => {
    if (currentEntry && currentEntry.path === treeStore.currentPath) {
      showSkeleton.value = false;
      if (skeletonTimer) {
        clearTimeout(skeletonTimer);
        skeletonTimer = null;
      }
    }
  }
);

onUnmounted(() => {
  if (skeletonTimer) {
    clearTimeout(skeletonTimer);
    skeletonTimer = null;
  }
});

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

/** Manual clear from a toast — silent on success, error toast on failure. */
async function clearCopied(): Promise<void> {
  useNotifyResult(await clipboard.clear(), { ok: false });
}

async function copyValue(value: string, label: string): Promise<void> {
  if (!treeStore.currentPath) return;
  const result = await clipboard.copyWithTimeout(value, treeStore.currentPath);
  result.match({
    okFn: action => {
      toast.success(`${label} copied`, {
        description: `Clears in ${action.timerSeconds}s · ${treeStore.currentPath}`,
        action: {
          label: "Clear",
          onClick: () => void clearCopied(),
        },
        duration: action.timerSeconds * 1000,
      });
    },
    errFn: e => toast.error(`Copy failed: ${e.message}`),
  });
}

function copySecret(): void {
  if (!entry.value) return;
  void copyValue(entry.value.secret, "Password");
}
</script>

<template>
  <!-- Entry form (create or edit) -->
  <EntryForm v-if="formStore.isFormOpen" />

  <!-- Loading -->
  <div class="space-y-4 p-6" v-else-if="showSkeleton">
    <div class="bg-muted h-6 w-48 animate-pulse rounded" />
    <div class="bg-muted h-10 w-full animate-pulse rounded" />
    <div class="bg-muted h-20 w-full animate-pulse rounded" />
  </div>

  <!-- Empty state -->
  <div
    class="text-muted-foreground flex h-full flex-col items-center justify-center space-y-6"
    v-else-if="!entry"
  >
    <div class="space-y-2 text-center">
      <p class="text-sm">No entry selected</p>
      <p class="text-xs">
        Choose an entry from the sidebar or create a new one.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <Button size="sm" variant="outline" @click="formStore.openCreateForm()">
        <Plus class="mr-1 size-4" />
        New Entry
      </Button>
      <PasswordGenerator @save="(pw: string) => formStore.openCreateForm(pw)">
        <Button size="sm" variant="outline">
          <Sparkles class="mr-1 size-4" />
          Generate
        </Button>
      </PasswordGenerator>
    </div>
  </div>

  <!-- Entry detail -->
  <TooltipProvider v-else>
    <div class="space-y-6 p-6">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <h2 class="font-mono text-lg font-semibold">{{ entry.path }}</h2>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              aria-label="Close entry"
              class="size-8 shrink-0"
              size="icon"
              variant="ghost"
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
        <div
          class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
        >
          Password
        </div>
        <div
          class="bg-muted/50 mt-5 flex items-center gap-2 rounded-lg border px-3 py-2"
        >
          <code class="flex-1 font-mono text-sm break-all">
            <template v-if="isSecretVisible">{{ entry.secret }}</template>
            <template v-else>••••••••••••••••</template>
          </code>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                class="size-8 shrink-0"
                size="icon"
                variant="ghost"
                :aria-label="
                  isSecretVisible ? 'Hide password' : 'Show password'
                "
                @click="toggleSecret"
              >
                <EyeOff class="size-4" v-if="isSecretVisible" />
                <Eye class="size-4" v-else />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{
              isSecretVisible ? "Hide password" : "Show password"
            }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                aria-label="Copy password"
                class="size-8 shrink-0"
                size="icon"
                variant="ghost"
                @click="copySecret"
              >
                <Copy class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy password</TooltipContent>
          </Tooltip>
        </div>
        <p class="sr-only" role="status">
          Password {{ isSecretVisible ? "shown" : "hidden" }}
        </p>
      </div>

      <!-- Metadata -->
      <div class="space-y-2" v-if="metadataEntries.length > 0">
        <div
          class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
        >
          Metadata
        </div>
        <div class="my-5 divide-y rounded-lg border">
          <div
            class="flex items-center justify-between px-3 py-2"
            v-for="[ key, value ] in metadataEntries"
            :key="key"
          >
            <div class="min-w-0">
              <span class="text-muted-foreground text-xs">{{
                getLabel(key)
              }}</span>
              <p class="truncate font-mono text-sm">{{ value }}</p>
            </div>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  class="size-8 shrink-0"
                  size="icon"
                  variant="ghost"
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
      <div class="space-y-2" v-if="entry.other.length > 0">
        <div
          class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
        >
          Notes
        </div>
        <div class="bg-muted/50 rounded-lg border px-3 py-2">
          <p
            class="font-mono text-sm"
            v-for="(line, i) in entry.other"
            :key="i"
          >
            {{ line }}
          </p>
        </div>
      </div>

      <div
        class="text-muted-foreground text-sm"
        v-if="metadataEntries.length === 0 && entry.other.length === 0"
      >
        No additional metadata
      </div>

      <!-- Actions bar -->
      <div class="flex items-center gap-2 border-t px-2 py-5">
        <MoveOrDuplicateDialog
          mode="duplicate"
          v-if="treeStore.currentPath"
          :current-path="treeStore.currentPath"
        >
          <Button size="sm" variant="outline">
            <Files class="mr-1 size-4" />
            Duplicate
          </Button>
        </MoveOrDuplicateDialog>
        <Button
          size="sm"
          variant="outline"
          v-if="treeStore.currentPath && entry"
          @click="formStore.openEditForm(editPath)"
        >
          <SquarePen class="mr-1 size-4" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          v-if="treeStore.currentPath"
          @click="isRenameOpen = true"
        >
          <Pencil class="mr-1 size-4" />
          Rename
        </Button>
        <RenameEntryDialog
          v-if="treeStore.currentPath"
          v-model:open="isRenameOpen"
          :current-path="treeStore.currentPath"
        />
        <MoveOrDuplicateDialog
          mode="move"
          v-if="treeStore.currentPath"
          :current-path="treeStore.currentPath"
        >
          <Button size="sm" variant="outline">
            <ArrowRightLeft class="mr-1 size-4" />
            Move
          </Button>
        </MoveOrDuplicateDialog>
        <DeleteConfirmDialog
          v-if="treeStore.currentPath"
          v-model:open="isDeleteOpen"
          :entry-path="treeStore.currentPath"
        >
          <Button
            class="text-destructive hover:text-destructive"
            size="sm"
            variant="outline"
            @click="isDeleteOpen = true"
          >
            <Trash2 class="mr-1 size-4" />
            Delete
          </Button>
        </DeleteConfirmDialog>
      </div>
    </div>
  </TooltipProvider>
</template>
