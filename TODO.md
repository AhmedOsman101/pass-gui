# pass-gui

## 1. Dependency Layer (Hard Gate Before UI)

### 1.1 Validate `pass`

- [x] Resolve binary path (`which` / `where`)
- [x] Run `pass --version`
- [x] Enforce minimum supported version
- [x] Detect if binary is alias/wrapper and log real path
- [x] Diagnose and report pass readiness via readiness snapshot granular states
- [ ] Provide onboarding flow if `pass` doesn't exist

### 1.2 Validate GPG Backend

- [x] Resolve `gpg` binary
- [x] Run `gpg --version`
- [x] Run `gpg --list-secret-keys`
- [x] Ensure at least one secret key exists
- [x] Detect and support custom `GNUPGHOME` (env var and per-store override)
- [x] Resolve effective GNUPGHOME: per-store -> env -> gpg compiled-in default
- [ ] Handle Windows-specific GPG installations
- [ ] Provide onboarding flow if no keys exist

## 2. Store Resolution

- [x] Determine store path resolution order:
  - `$PASSWORD_STORE_DIR`
  - `$HOME/.password-store`

- [x] Normalize path (cross-platform)
- [x] Persist last selected store (config-level, not OS-level)
- [ ] Support per-session override

## 3. Store Validation

### 3.1 Structural Validation

- [x] Check path exists
- [x] Check path is a directory
- [x] Check `.gpg-id` exists at root
- [x] Ensure `.gpg-id` is not empty

### 3.2 Cryptographic Validation

- [x] Parse `.gpg-id` (filter comments, extract recipient IDs)
- [x] Verify each key ID exists in GPG keyring (suffix match for short IDs, exact for fingerprints)
- [x] Detect unknown/removed recipients

### 3.3 Behavioral Validation

- [x] Attempt a safe read operation (`pass ls`) via `validateStoreBehaviorally()`
- [x] Fail and report behavioral check failure on non-zero exit

## 4. Readiness State Machine

- [x] `NEED_PASS` — pass binary missing or too old
- [x] `NEED_TREE` — tree binary missing
- [x] `NEED_GPG` — gpg binary missing
- [x] `GPG_NO_KEYS` — no secret keys in keyring
- [x] `STORE_NOT_FOUND` — store path doesn't exist
- [x] `STORE_NO_GPG_ID` — store has no `.gpg-id` file
- [x] `STORE_GPG_ID_EMPTY` — `.gpg-id` file is empty
- [x] `STORE_GPG_ID_KEY_MISSING` — recipient key not in keyring
- [x] `STORE_EMPTY` — store exists but has no entries
- [x] `READY` — all checks passed
- [x] Centralized orchestrator (`ReadinessService.check()`) + `ReadinessStore`
- [x] UI reacts strictly to state: `ReadinessGate` renders loading/blocked/ready
- [x] `IssueCard` maps all 10 states to title/description/recovery actions

## 5. Listing Passwords

- [x] Handle empty store (walkStore returns `Ok([])`)
- [x] Filesystem traversal as canonical source (deterministic, no Unicode parsing issues)
- [ ] Cache results in memory
- [x] Refresh mechanism — entry operations reload tree after mutations
- [ ] Watch filesystem for changes

## 6. Multiple Store Support

### 6.1 Store Switching

- [ ] Session-scoped `PASSWORD_STORE_DIR`
- [ ] Never modify global environment
- [ ] Maintain active store in memory
- [ ] Validate store before activation

### 6.2 Creating a New Store

- [ ] Ensure directory exists or create it
- [ ] Refuse non-empty invalid directories
- [ ] Run `pass init <key-id>` with scoped env
- [ ] Validate store after init
- [ ] Support multi-recipient `.gpg-id`

### 6.3 Advanced

- [ ] Allow per-store custom `GNUPGHOME`
- [ ] Allow store rename / removal (safe)

## 7. Command Execution Abstraction

- [x] Central wrapper for executing `pass`
- [x] Central wrapper for executing `gpg` (GpgService)
- [x] Scoped environment injection — `pass.exec()` sets both `PASSWORD_STORE_DIR` + `GNUPGHOME` (reads `gpg.homeDir`). Caller envs merge on top.
- [x] `pass.setStorePath(path)` — override store at runtime
- [x] `gpg.setHome(home)` — override GNUPGHOME at runtime
- [ ] Timeout handling
- [x] Structured error parsing
- [x] Log stdout/stderr safely
- [x] Prevent shell injection vulnerabilities

## 8. Entry Operations (Core Features)

- [x] Show entry (`pass show`) — via `EntriesService.show()` -> `parsePassShowOutput()`
- [x] Insert entry (`pass insert`) — via `EntriesService.insert()` with `-m` flag + stdin
- [x] Generate entry (`pass generate`) — supports memorable (EFF wordlist) and standard
- [x] Edit entry — via show-then-reinsert pattern (pass edit spawns $EDITOR, incompatible with NeutralinoJS)
- [x] Remove entry (`pass rm`) — via `EntriesService.remove()` with `-f` flag
- [x] Rename/move entry (`pass mv`) — via `EntriesService.move()`
- [x] Copy/duplicate entry — via `EntriesService.copy()`
- [x] Copy password to clipboard (timed clear) — via `ClipboardService` + `ClipboardStore` timer
- [ ] Generate QR code image for password (future)

## 9. Security Hardening

- [ ] Clear sensitive data from memory after use
- [ ] Avoid logging passwords accidentally
- [x] Secure clipboard handling — via `ClipboardService` with config-backed clear timeout
- [x] Prevent command injection
- [x] Disable shell interpolation
- [x] Validate user input paths
- [ ] Handle GPG agent correctly
- [ ] Support passphrase prompts via agent

## 10. Frontend & UI

- [x] ReadinessGate renders loading/blocked/ready based on ReadinessStore
- [x] `BlockedScreen` + `IssueCard` display readiness issues with recovery actions
- [x] `index.vue` is the main page: sidebar (AppSidebar) + detail panel (EntryDetail), resizable
- [x] AppSidebar: sort dropdown, debounced search, New/Generate buttons, entry tree
- [x] Tree.vue: flat renderer with TransitionGroup animation, arrow nav, context menus, cut dim, copy pulse
- [x] EntryDetail: masked password toggle, copy button, metadata display, remove action
- [x] Insert/Generate/Rename/Edit/Delete/Move/Duplicate dialogs with backend integration
- [x] ClipboardToast: clipboard status indicator with countdown timer
- [x] ModeToggle: dark/light mode
- [ ] SearchBar — inlined in AppSidebar without clear-button or result count indicator
- [ ] Settings page — config editing (general, generation, clipboard, GPG info)

## 11. Extensions & Compatibility

- [ ] Detect `.extensions` directory
- [ ] Allow extension execution
- [ ] Support common extensions (e.g., OTP)

## 12. Error Handling & Diagnostics

- [ ] Structured error categories
- [x] User-friendly error mapping — IssueCard maps 10 readiness codes to titles/descriptions/recovery actions
- [ ] Developer debug mode
- [ ] Logging system (without leaking secrets)

## 13. Configuration

- [x] Design configuration file format (TOML)
- [x] Implement config file read/write with comment preservation
- [ ] Migrate runtime preferences to config file (e.g., sort mode, search history)
- [x] Define configuration schema (store paths, GNUPGHOME overrides, preferences)
- [x] Store custom GNUPGHOME per password store
- [x] Zod schemas for per-section and cross-field validation

## 14. Documentation

- [x] Document configuration file format
- [x] Document TOML comment preservation limitations:
  - [x] Full-line comments may be lost when file is modified via the app
  - [x] Commented-out configuration keys are not preserved
  - [x] Inline comments (after key/value pairs or table headers) are preserved
