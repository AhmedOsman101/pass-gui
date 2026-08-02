# Entry Raw Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a whole-entry raw editor while retaining structured password, OTP, metadata, and notes editing.

**Architecture:** Keep `EntryForm` as the UI owner of one canonical draft: secret, optional first OTP URI, metadata pairs, and notes. Add a small pure entry-content utility that parses raw text into that draft and serializes it in a stable order. `parsePassShowOutput()` gains a first-OTP guard so a standalone `otpauth://...` never becomes accidental `otpauth` metadata.

**Tech Stack:** Vue 3.5 Composition API, TypeScript, Pinia, Vitest, Biome, Mask.

## Global Constraints

- Preserve existing structured create/edit controls; raw mode is additive.
- Raw line 1 is required and is the password/secret.
- First standalone `otpauth://...` line maps to structured OTP; later OTP URI lines remain Notes.
- Later `key: value` lines map to metadata; all remaining lines map to Notes.
- No new dependency, abstraction layer, OTP generation, QR rendering, or multi-OTP form controls.
- User explicitly deferred new automated tests; do not add or modify tests unless implementation forces it.
- Use `mask` commands only for project verification; never call `pnpm` directly.

---

### Task 1: Add raw entry-content conversion utility

**Files:**

- Create: `client/src/lib/entry-content.ts`
- Modify: `client/src/lib/parse-pass-show.ts:32-48`
- Test: No test changes — explicitly deferred by user.

**Interfaces:**

- Produces `EntryDraft`, `parseEntryContent(raw: string): EntryDraft`, and `serializeEntryContent(draft: EntryDraft): string` for `EntryForm`.
- Keeps `parsePassShowOutput()` public return type unchanged.

- [ ] **Step 1: Add canonical draft type and parser/serializer**

Create `client/src/lib/entry-content.ts`:

```ts
export type MetadataEntry = { key: string; value: string };

export type EntryDraft = {
  secret: string;
  otpUri: string;
  metadata: MetadataEntry[];
  notes: string;
};

export function parseEntryContent(raw: string): EntryDraft {
  const [secret = "", ...lines] = raw.split("\n");
  const metadata: MetadataEntry[] = [];
  const notes: string[] = [];
  let otpUri = "";

  for (const line of lines) {
    if (!otpUri && line.startsWith("otpauth://")) {
      otpUri = line;
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (key && value) {
        metadata.push({ key, value });
        continue;
      }
    }
    notes.push(line);
  }

  return { secret, otpUri, metadata, notes: notes.join("\n") };
}

export function serializeEntryContent(draft: EntryDraft): string {
  return [
    draft.secret,
    draft.otpUri,
    ...draft.metadata
      .filter(({ key }) => key.trim())
      .map(({ key, value }) => `${key}: ${value}`),
    draft.notes,
  ]
    .filter((line, index) => index === 0 || line.length > 0)
    .join("\n");
}
```

- [ ] **Step 2: Guard standalone OTP lines in displayed-entry parser**

In `client/src/lib/parse-pass-show.ts`, add a local guard before generic colon parsing. Preserve the first OTP URI in `other` so existing `EntryDetail` continues showing it; later OTP URIs also fall through to `other`.

```ts
let hasOtpUri = false;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i] as string;
  if (!hasOtpUri && line.startsWith("otpauth://")) {
    hasOtpUri = true;
    other.push(line);
    continue;
  }
  // existing key:value / other parsing
}
```

- [ ] **Step 3: Commit utility and parser guard** (use conventional-commits skill)

```bash
git add client/src/lib/entry-content.ts client/src/lib/parse-pass-show.ts
```

### Task 2: Add form/raw mode to EntryForm

**Files:**

- Modify: `client/src/components/EntryForm.vue:1-330`
- Test: No test changes — explicitly deferred by user.

**Interfaces:**

- Consumes `EntryDraft`, `parseEntryContent`, and `serializeEntryContent` from `@/lib/entry-content`.
- Produces existing `treeStore.insertEntry(path, content)` / `treeStore.editEntry(path, content)` calls with serialized canonical content.

- [ ] **Step 1: Replace independent content refs with canonical draft refs**

At the top of `EntryForm.vue`, import the utility and add mode state:

```ts
import {
  parseEntryContent,
  serializeEntryContent,
  type MetadataEntry,
} from "@/lib/entry-content";

const editorMode = ref<"form" | "raw">("form");
const secret = ref("");
const otpUri = ref("");
const metadata = ref<MetadataEntry[]>([]);
const notes = ref("");
const rawContent = ref("");
```

When editing, initialize the canonical draft from `treeStore.currentEntry.raw`; when creating, preserve current password generation behavior and initialize empty OTP, metadata, and notes.

- [ ] **Step 2: Add deterministic mode conversion actions**

Add these functions before `buildContent()`:

```ts
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

function buildContent(): string {
  return serializeEntryContent({
    secret: secret.value,
    otpUri: otpUri.value,
    metadata: metadata.value,
    notes: notes.value,
  });
}
```

Before raw-mode submit validation, parse `rawContent` into the canonical refs exactly as `toFormMode()` does, without changing `editorMode`. Validate `secret.value` after that conversion.

- [ ] **Step 3: Render mode control and raw editor**

Add two compact, mutually exclusive buttons next to the form header:

```vue
<div class="flex items-center gap-1 rounded-md border p-1">
  <Button type="button" size="sm" :variant="editorMode === 'form' ? 'secondary' : 'ghost'" @click="toFormMode">
    Form
  </Button>
  <Button type="button" size="sm" :variant="editorMode === 'raw' ? 'secondary' : 'ghost'" @click="toRawMode">
    Raw
  </Button>
</div>
```

Wrap existing password and metadata fields in `v-if="editorMode === 'form'"`. In that branch, add:

```vue
<div class="space-y-2">
  <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">OTP URI</label>
  <textarea v-model="otpUri" rows="2" placeholder="otpauth://totp/..." class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y" />
</div>
<div class="space-y-2">
  <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
  <textarea v-model="notes" rows="4" placeholder="Any lines that are not key: value pairs" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y" />
</div>
```

Add raw branch:

```vue
<div v-else class="space-y-2">
  <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entry content</label>
  <textarea v-model="rawContent" rows="14" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y" />
  <p class="text-xs text-muted-foreground">
    First line is required password. Later <code>key: value</code> lines are metadata; first <code>otpauth://...</code> line is OTP; other lines are notes.
  </p>
</div>
```

- [ ] **Step 4: Verify form behavior and UI type safety**

Run: `mask typecheck`

Expected: typecheck succeeds.

- [ ] **Step 5: Run UI lint + format and diff gate**

Run: `mask format && git diff --check`

Expected: lint succeeds or reports only pre-existing unrelated findings; diff check succeeds.

- [ ] **Step 6: Run Impeccable detector once on completed UI**

Run:

```bash
node /home/othman/dotfiles/Configs/agents/.agents/skills/frontend/impeccable/scripts/detect.mjs --json client/src/components/EntryForm.vue
```

Expected: inspect every reported finding; fix only valid in-scope UI defects, then rerun `mask typecheck && mask test` once.

- [ ] **Step 7: Commit EntryForm raw mode**

```bash
git add client/src/components/EntryForm.vue
```
