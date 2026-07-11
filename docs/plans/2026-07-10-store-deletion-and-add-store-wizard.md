# Store Deletion & Add Store Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a delete button with confirmation dialog for each store (including default), and replace the 2-input "Add Store" form with a multi-step wizard that creates the store directory and runs `pass init`.

**Architecture:** Two independent features sharing the `StoresTab.vue` component. Feature 1 (deletion) uses a reusable `StoreDeleteDialog.vue` wrapping `AlertDialog`. Feature 2 (wizard) introduces `AddStoreWizard.vue` — a multi-step `Dialog` with internal state machine (name -> path -> GPG key -> confirm/create). Both features emit `updateStores` + `save` to the parent. The wizard calls `pass init` with scoped `PASSWORD_STORE_DIR` via the existing `PassService.exec()`.

**Tech Stack:** Vue 3.5 Composition API, shadcn-vue AlertDialog/Dialog, lib-result, NeutralinoJS OS dialogs, `pass init` CLI, Zod validation.

## Global Constraints

- Biome 2.5.0: 2 spaces, 80 char width, double quotes in JSX/HTML, semicolons always, `noVar: on`
- Vue files: `<script setup lang="ts">`, Composition API only
- All async operations return `Result<T>` via lib-result — no bare throws
- NeutralinoJS `os.showFolderDialog()` for native path selection
- Config updates go through `Config.save()` or `Config.setValue()` — never raw file writes
- Existing `DeleteConfirmDialog.vue` pattern (AlertDialog) for confirmation dialogs
- `pass init` requires `PASSWORD_STORE_DIR` env var pointing to the target store path

---

## Feature 1: Store Deletion with Confirmation

### Task 1: Create StoreDeleteDialog Component

**Files:**

- Create: `client/src/components/StoreDeleteDialog.vue`
- Reference: `client/src/components/DeleteConfirmDialog.vue` (pattern)

**Interfaces:**

- Consumes: `storeName: string`, `storePath: string`, `open: boolean` (v-model)
- Produces: emits `update:open` (boolean), `deleted` (storeName: string)

- [ ] **Step 1: Create the component file**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const props = defineProps<{
  storeName: string;
  storePath: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  deleted: [storeName: string];
}>();

const isDeleting = ref(false);

function handleDelete(): void {
  isDeleting.value = true;
  emit("deleted", props.storeName);
  isDeleting.value = false;
  emit("update:open", false);
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogTrigger v-if="!open" as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Store</AlertDialogTitle>
        <AlertDialogDescription>
          Delete store <code class="font-mono">{{ storeName }}</code> at
          <code class="font-mono">{{ storePath }}</code
          >? This will remove it from the config but will NOT delete the
          directory on disk.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          :disabled="isDeleting"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="handleDelete"
        >
          {{ isDeleting ? "Deleting..." : "Delete" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
```

- [ ] **Step 2: Verify component compiles**

Run: `pnpm --filter client typecheck`
Expected: PASS (no type errors in new file)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/StoreDeleteDialog.vue
git commit -m "feat: add StoreDeleteDialog component"
```

---

### Task 2: Wire StoreDeleteDialog into StoresTab

**Files:**

- Modify: `client/src/components/settings/StoresTab.vue` (lines 1-126 script, 171-219 template)

**Interfaces:**

- Consumes: `StoreDeleteDialog.vue` from Task 1
- Produces: updated `deleteStore()` function emits `deleted` event

- [ ] **Step 1: Add import and state to StoresTab script**

Add to imports (after line 2):

```typescript
import StoreDeleteDialog from "@/components/StoreDeleteDialog.vue";
```

Add state refs (after line 47):

```typescript
const deleteDialogOpen = ref(false);
const deleteTarget = ref<{ name: string; path: string } | null>(null);
```

- [ ] **Step 2: Replace deleteStore function**

Replace the existing `deleteStore` function (lines 92-99) with:

```typescript
function promptDeleteStore(name: string): void {
  const store = props.stores[name];
  if (!store) return;
  deleteTarget.value = { name, path: store.path };
  deleteDialogOpen.value = true;
}

function confirmDeleteStore(name: string): void {
  const updated = { ...props.stores };
  delete updated[name];
  emit("updateStores", updated);
  emit("save");
}
```

- [ ] **Step 3: Update template — delete button**

Replace the delete button (lines 210-218) with:

```vue
<Button
  v-if="store.name !== activeStore"
  variant="ghost"
  size="icon"
  class="size-8 text-destructive"
  @click="promptDeleteStore(store.name)"
>
  <Trash2 class="size-4" />
</Button>
```

Key change: removed `store.name !== 'default'` guard — default store CAN be deleted.

- [ ] **Step 4: Add dialog to template**

Add before the closing `</CardContent>` (after the save button div, before `</CardContent>` on line 309):

```vue
<StoreDeleteDialog
  v-if="deleteTarget"
  :store-name="deleteTarget.name"
  :store-path="deleteTarget.path"
  v-model:open="deleteDialogOpen"
  @deleted="confirmDeleteStore"
/>
```

- [ ] **Step 5: Remove old inline "Add New Store" form**

Remove lines 270-301 (the entire "Add New Store" `<div class="flex flex-col gap-3">` block). This will be replaced by the wizard in Task 4.

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter client typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/components/settings/StoresTab.vue
git commit -m "feat: add store deletion with confirmation dialog"
```

---

## Feature 2: Add Store Wizard

### Task 3: Create AddStoreWizard Component

**Files:**

- Create: `client/src/components/settings/AddStoreWizard.vue`

**Interfaces:**

- Consumes: `stores: Record<string, StoreConfig>`, `activeStore: string`
- Produces: emits `created` with `{ name: string, path: string, gnupgHome?: string }`
- Uses: `Gpg.listSecretKeys()` for key selection, `Dialog.showFolderDialog()` for path, `Pass.exec(["init", ...])` for store creation, `Config` for config updates

- [ ] **Step 1: Create the wizard component**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { toast } from "sonner";
import {
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog as NeuDialog } from "@/services/dialog";
import { Gpg } from "@/services/gpg";
import { Pass } from "@/services/pass";
import { Config } from "@/services/config";
import { Fs } from "@/services/filesystem";
import type { StoreConfig } from "@/types/config";
import type { SecretKey } from "@/types";

const props = defineProps<{
  stores: Record<string, StoreConfig>;
  activeStore: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

// Wizard state
type WizardStep = "name" | "path" | "gpg" | "creating";
const step = ref<WizardStep>("name");
const storeName = ref("");
const storePath = ref("");
const selectedKeyId = ref("");
const secretKeys = ref<SecretKey[]>([]);
const isLoadingKeys = ref(true);
const isCreating = ref(false);
const creationError = ref("");

// Validation
const nameError = computed(() => {
  const name = storeName.value.trim();
  if (!name) return "";
  if (props.stores[name]) return "A store with this name already exists";
  if (!/^[a-zA-Z0-9_-]+$/.test(name))
    return "Name can only contain letters, numbers, hyphens, and underscores";
  return "";
});

const pathError = computed(() => {
  const path = storePath.value.trim();
  if (!path) return "";
  const existing = Object.values(props.stores).find(s => s.path === path);
  if (existing) return "A store with this path already exists";
  return "";
});

const canAdvanceName = computed(
  () => storeName.value.trim() !== "" && !nameError.value
);
const canAdvancePath = computed(
  () => storePath.value.trim() !== "" && !pathError.value
);
const canCreate = computed(
  () => selectedKeyId.value !== "" && !isCreating.value
);

// Load GPG keys on open
onMounted(async () => {
  if (!props.open) return;
  await loadKeys();
});

async function loadKeys(): Promise<void> {
  isLoadingKeys.value = true;
  const result = await Gpg.listSecretKeys();
  if (result.isOk()) {
    secretKeys.value = result.ok;
  } else {
    toast.error("Failed to load GPG keys");
  }
  isLoadingKeys.value = false;
}

function keyLabel(key: SecretKey): string {
  const uid = key.userIds?.[0] ?? key.userId ?? "Unknown";
  const shortId = key.keyId.slice(-8);
  return `${uid} (${shortId})`;
}

async function pickFolder(): Promise<void> {
  const result = await NeuDialog.showFolderDialog("Select store directory");
  if (result.isOk() && result.ok) {
    storePath.value = result.ok;
  }
}

function advanceStep(): void {
  switch (step.value) {
    case "name":
      if (canAdvanceName.value) step.value = "path";
      break;
    case "path":
      if (canAdvancePath.value) step.value = "gpg";
      break;
  }
}

function goBack(): void {
  switch (step.value) {
    case "path":
      step.value = "name";
      break;
    case "gpg":
      step.value = "path";
      break;
  }
}

async function createStore(): Promise<void> {
  if (!canCreate.value) return;
  step.value = "creating";
  isCreating.value = true;
  creationError.value = "";

  const name = storeName.value.trim();
  const path = storePath.value.trim();
  const gpgKeyId = selectedKeyId.value;

  // 1. Create directory (Fs.mkdir uses std::filesystem::create_directories — recursive)
  const mkdirResult = await Fs.mkdir(path);
  if (mkdirResult.isError()) {
    creationError.value = `Failed to create directory: ${mkdirResult.error.message}`;
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  // 2. Run pass init with scoped PASSWORD_STORE_DIR
  Pass.setStorePath(path);
  const initResult = await Pass.exec(["init", gpgKeyId]);
  if (initResult.isError()) {
    creationError.value = `pass init failed: ${initResult.error.message}`;
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  // 3. Restore previous store path
  const previousPath = props.stores[props.activeStore]?.path;
  if (previousPath) {
    Pass.setStorePath(previousPath);
  }

  // 4. Update config
  const configResult = await Config.load();
  if (configResult.isError()) {
    creationError.value = "Failed to load config for update";
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  const newStores = { ...configResult.ok.data.stores, [name]: { path } };
  const raw = configResult.ok._raw as Record<string, unknown>;
  (raw.stores as Record<string, unknown>) = newStores;
  const saveResult = await Config.save(configResult.ok);
  if (saveResult.isError()) {
    creationError.value = "Failed to save config";
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  // 5. Reset and close
  isCreating.value = false;
  toast.success(`Store "${name}" created`);
  emit("created");
  emit("update:open", false);
  resetWizard();
}

function resetWizard(): void {
  step.value = "name";
  storeName.value = "";
  storePath.value = "";
  selectedKeyId.value = "";
  creationError.value = "";
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add New Store</DialogTitle>
        <DialogDescription>
          Create a new password store with a GPG key for encryption.
        </DialogDescription>
      </DialogHeader>

      <!-- Step indicators -->
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge :variant="step === 'name' ? 'default' : 'outline'"
          >1. Name</Badge
        >
        <ChevronRight class="size-3" />
        <Badge :variant="step === 'path' ? 'default' : 'outline'"
          >2. Path</Badge
        >
        <ChevronRight class="size-3" />
        <Badge
          :variant="
            step === 'gpg' || step === 'creating' ? 'default' : 'outline'
          "
          >3. GPG Key</Badge
        >
      </div>

      <Separator />

      <!-- Step: Name -->
      <div v-if="step === 'name'" class="flex flex-col gap-3">
        <Label for="store-name">Store Name</Label>
        <Input
          id="store-name"
          v-model="storeName"
          placeholder="my-store"
          autofocus
          @keydown.enter="advanceStep"
        />
        <p v-if="nameError" class="text-xs text-destructive">{{ nameError }}</p>
        <p v-else class="text-xs text-muted-foreground">
          A unique identifier for this store (letters, numbers, hyphens,
          underscores).
        </p>
      </div>

      <!-- Step: Path -->
      <div v-else-if="step === 'path'" class="flex flex-col gap-3">
        <Label for="store-path">Store Directory</Label>
        <div class="flex gap-2">
          <Input
            id="store-path"
            v-model="storePath"
            placeholder="/home/user/.password-store"
            class="flex-1 font-mono"
            autofocus
            @keydown.enter="advanceStep"
          />
          <Button
            variant="outline"
            size="icon"
            class="size-9 shrink-0"
            @click="pickFolder"
          >
            <FolderOpen class="size-4" />
          </Button>
        </div>
        <p v-if="pathError" class="text-xs text-destructive">{{ pathError }}</p>
        <p v-else class="text-xs text-muted-foreground">
          The directory will be created if it doesn't exist.
        </p>
      </div>

      <!-- Step: GPG Key -->
      <div v-else-if="step === 'gpg'" class="flex flex-col gap-3">
        <Label>Encryption Key</Label>
        <div v-if="isLoadingKeys" class="flex items-center gap-2 py-4">
          <Loader2 class="size-4 animate-spin" />
          <span class="text-sm text-muted-foreground">Loading GPG keys...</span>
        </div>
        <div
          v-else-if="secretKeys.length === 0"
          class="py-4 text-sm text-muted-foreground"
        >
          No GPG secret keys found. Create one with
          <code class="font-mono">gpg --gen-key</code> first.
        </div>
        <Select v-else v-model="selectedKeyId">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Select a GPG key" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="key in secretKeys"
                :key="key.keyId"
                :value="key.keyId"
              >
                {{ keyLabel(key) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          This key will encrypt all passwords in the new store.
        </p>
      </div>

      <!-- Step: Creating -->
      <div
        v-else-if="step === 'creating'"
        class="flex flex-col items-center gap-3 py-6"
      >
        <Loader2 class="size-8 animate-spin text-muted-foreground" />
        <span class="text-sm text-muted-foreground">Creating store...</span>
        <p v-if="creationError" class="text-xs text-destructive">
          {{ creationError }}
        </p>
      </div>

      <DialogFooter>
        <Button
          v-if="step !== 'creating'"
          variant="outline"
          @click="step === 'name' ? emit('update:open', false) : goBack()"
        >
          {{ step === "name" ? "Cancel" : "Back" }}
        </Button>
        <Button
          v-if="step === 'name' || step === 'path'"
          :disabled="step === 'name' ? !canAdvanceName : !canAdvancePath"
          @click="advanceStep"
        >
          Next
        </Button>
        <Button
          v-else-if="step === 'gpg'"
          :disabled="!canCreate"
          @click="createStore"
        >
          Create Store
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter client typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/settings/AddStoreWizard.vue
git commit -m "feat: add AddStoreWizard component with pass init"
```

---

### Task 4: Wire AddStoreWizard into StoresTab

**Files:**

- Modify: `client/src/components/settings/StoresTab.vue`

**Interfaces:**

- Consumes: `AddStoreWizard.vue` from Task 3
- Produces: emits `created` triggers config reload in parent

- [ ] **Step 1: Add import and state**

Add to imports (after `StoreDeleteDialog` import):

```typescript
import AddStoreWizard from "@/components/settings/AddStoreWizard.vue";
```

Add state (after `deleteTarget` ref):

```typescript
const wizardOpen = ref(false);
```

- [ ] **Step 2: Add wizard handler**

```typescript
function handleStoreCreated(): void {
  emit("save");
}
```

- [ ] **Step 3: Add "Add Store" button to template**

Replace the removed "Add New Store" section (removed in Task 2, Step 5) with:

```vue
<div class="flex justify-end">
  <Button @click="wizardOpen = true">
    <Plus class="size-4 mr-1" />
    Add Store
  </Button>
</div>
```

- [ ] **Step 4: Add wizard dialog to template**

Add alongside `StoreDeleteDialog`:

```vue
<AddStoreWizard
  :stores="stores"
  :active-store="activeStore"
  v-model:open="wizardOpen"
  @created="handleStoreCreated"
/>
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter client typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/components/settings/StoresTab.vue
git commit -m "feat: wire AddStoreWizard into StoresTab"
```

---

### Task 5: Add Wizard Props to StoresTab and Update Settings Page

**Files:**

- Modify: `client/src/components/settings/StoresTab.vue` (props)
- Modify: `client/src/pages/settings.vue` (storesForm passthrough)

**Interfaces:**

- Consumes: `stores` prop already exists on StoresTab
- Produces: wizard receives stores for validation

- [ ] **Step 1: Verify StoresTab already receives `stores` prop**

The `stores` prop is already defined on line 30: `stores: Record<string, StoreConfig>`. The wizard receives it as `:stores="stores"`. No changes needed to props.

- [ ] **Step 2: Verify settings.vue passes storesForm**

Line 225: `v-model:stores="storesForm"` — already wired. No changes needed.

- [ ] **Step 3: Verify everything compiles together**

Run: `pnpm --filter client typecheck`
Expected: PASS

- [ ] **Step 4: Commit (no-op if no changes)**

```bash
git status
# If no changes, skip commit
```

---

### Task 6: Integration Testing — Manual Verification

**Files:**

- None (manual testing)

- [ ] **Step 1: Start dev server**

Run: `pnpm --filter client dev`

- [ ] **Step 2: Test store deletion**

1. Navigate to Settings -> Stores
2. Verify delete button (trash icon) appears for ALL stores including "default"
3. Verify delete button is HIDDEN for the active store
4. Click delete on a non-active store -> verify confirmation dialog appears
5. Click Cancel -> verify store is NOT deleted
6. Click Delete -> verify store is removed from the list
7. Click Save -> verify config file is updated

- [ ] **Step 3: Test Add Store wizard**

1. Click "Add Store" button -> verify wizard dialog opens
2. Verify step indicator shows "1. Name" highlighted
3. Leave name empty -> verify "Next" is disabled
4. Enter a name -> verify "Next" is enabled
5. Enter duplicate name -> verify error message appears
6. Click Next -> verify step advances to "Path"
7. Verify folder picker button works (opens native dialog)
8. Enter duplicate path -> verify error message
9. Click Next -> verify step advances to "GPG Key"
10. Verify GPG keys are loaded and displayed
11. Select a key -> verify "Create Store" is enabled
12. Click "Create Store" -> verify loading state, then success toast
13. Verify new store appears in the store list
14. Verify `.gpg-id` file exists in the created directory
15. Verify config file contains the new store

- [ ] **Step 4: Test wizard back navigation**

1. Open wizard, advance to step 2
2. Click "Back" -> verify returns to step 1 with name preserved
3. Advance to step 3, click "Back" -> verify returns to step 2 with path preserved

- [ ] **Step 5: Test edge cases**

1. Try creating a store with a path that doesn't exist as parent -> verify directory is created
2. Try creating a store while `pass` is not installed -> verify error message in wizard
3. Cancel wizard mid-creation -> verify no partial state left

---

## File Summary

| File                                                | Action    | Purpose                                                           |
| --------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `client/src/components/StoreDeleteDialog.vue`       | Create    | Confirmation dialog for store deletion                            |
| `client/src/components/settings/AddStoreWizard.vue` | Create    | Multi-step wizard for adding stores                               |
| `client/src/components/settings/StoresTab.vue`      | Modify    | Wire dialog + wizard, remove old add form, allow default deletion |
| `client/src/pages/settings.vue`                     | No change | Already passes correct props                                      |

## Dependency Order

```
Task 1 (StoreDeleteDialog)  ──┐
                               ├── Task 2 (Wire into StoresTab) ── Task 5 (Verify wiring)
Task 3 (AddStoreWizard)    ──┘         │
                                        └── Task 6 (Integration test)
```

Tasks 1 and 3 are independent and can run in parallel. Task 2 depends on Task 1. Task 4 depends on Task 3. Task 5 verifies the final wiring. Task 6 is manual QA.
