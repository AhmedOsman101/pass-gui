<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle, Info } from "@lucide/vue";
import type { ReadinessIssue } from "@/types/readiness";

const props = defineProps<{
  issue: ReadinessIssue;
}>();

/**
 * Maps issue codes to human-readable titles and descriptions.
 * Each blocked state gets actionable recovery guidance —
 * never raw error codes in the UI.
 */
const issueDisplay: Record<
  string,
  { title: string; description: string; action?: string }
> = {
  PASS_BINARY_MISSING: {
    title: "pass not found",
    description:
      "The pass password manager is not installed or not in your PATH.",
    action: "Install pass: https://www.passwordstore.org/",
  },
  PASS_VERSION_TOO_OLD: {
    title: "pass version too old",
    description: "Your version of pass is below the minimum required.",
    action: "Update pass to the latest version.",
  },
  TREE_BINARY_MISSING: {
    title: "tree not found",
    description: "The tree utility is required for directory listing on Linux/macOS.",
    action: "Install tree via your package manager.",
  },
  GPG_BINARY_MISSING: {
    title: "GPG not found",
    description:
      "GnuPG is not installed or not in your PATH.",
    action: "Install GnuPG: https://gnupg.org/",
  },
  GPG_NO_SECRET_KEYS: {
    title: "No GPG keys",
    description:
      "No secret keys found in your GPG keyring. You need at least one key to encrypt passwords.",
    action: "Generate a key: gpg --gen-key",
  },
  GPG_VERSION_TOO_OLD: {
    title: "GPG version too old",
    description: "Your version of GnuPG is below the minimum required.",
    action: "Update GnuPG to the latest version.",
  },
  STORE_DIR_NOT_FOUND: {
    title: "Store not found",
    description: "The configured password store directory does not exist.",
    action: "Check your config or create the directory.",
  },
  STORE_DIR_NOT_DIRECTORY: {
    title: "Store path is not a directory",
    description: "The configured store path exists but is not a directory.",
    action: "Check your config for the correct store path.",
  },
  STORE_GPG_ID_MISSING: {
    title: "Store not initialized",
    description: "No .gpg-id file found in the store directory.",
    action: "Initialize the store: pass init <key-id>",
  },
  STORE_GPG_ID_EMPTY: {
    title: "Store .gpg-id is empty",
    description: "The .gpg-id file exists but contains no key IDs.",
    action: "Add a key ID to .gpg-id or reinitialize: pass init <key-id>",
  },
  STORE_GPG_ID_PARSE_ERROR: {
    title: "Cannot parse .gpg-id",
    description: "The .gpg-id file could not be parsed.",
    action: "Check the file format — one key ID per line.",
  },
  STORE_RECIPIENT_UNKNOWN: {
    title: "Unknown key in .gpg-id",
    description: "A key ID in .gpg-id was not found in your GPG keyring.",
    action: "Import the key or remove it from .gpg-id.",
  },
  STORE_BEHAVIORAL_CHECK_FAILED: {
    title: "Store behavioral check failed",
    description: "pass could not read the store directory.",
    action: "Check file permissions and GPG key availability.",
  },
  STORE_NO_ENTRIES: {
    title: "Store is empty",
    description: "The store exists but has no password entries yet.",
    action: "Create your first entry.",
  },
  STORE_SCAN_FAILED: {
    title: "Store could not be scanned",
    description:
      "The store directory could not be read to check for entries.",
    action: "Check file permissions, then retry.",
  },
};

const display = computed(() => {
  const base = issueDisplay[props.issue.code] ?? {
    title: props.issue.code,
    description: "An unknown issue occurred.",
  };
  return base;
});

const isBlocking = computed(() => props.issue.severity === "blocking");
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-4 flex items-start gap-3',
      isBlocking
        ? 'border-destructive/50 bg-destructive/5'
        : 'border-muted bg-muted/50',
    ]"
  >
    <div :class="['mt-0.5 shrink-0', isBlocking ? 'text-destructive' : 'text-muted-foreground']">
      <AlertTriangle v-if="isBlocking" :size="18" />
      <Info v-else :size="18" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium">{{ display.title }}</p>
      <p class="text-sm text-muted-foreground mt-1">{{ display.description }}</p>
      <p v-if="display.action" class="text-sm text-muted-foreground mt-2 italic">
        {{ display.action }}
      </p>
    </div>
  </div>
</template>
