# pass-gui

## 1. Dependency Layer (Hard Gate Before UI)

### 1.1 Validate `pass`

- [x] Resolve binary path (`which` / `where`)
- [x] Run `pass --version`
- [x] Enforce minimum supported version
- [x] Detect if binary is alias/wrapper and log real path
- [ ] Provide onboarding flow if `pass` doesn't exist

### 1.2 Validate GPG Backend

- [x] Resolve `gpg` binary
- [x] Run `gpg --version`
- [x] Run `gpg --list-secret-keys`
- [ ] Ensure at least one secret key exists
- [ ] Detect and support custom `GNUPGHOME`
- [ ] Handle Windows-specific GPG installations
- [ ] Provide onboarding flow if no keys exist

## 2. Store Resolution

- [x] Determine store path resolution order:
  - `$PASSWORD_STORE_DIR`
  - `$HOME/.password-store`

- [x] Normalize path (cross-platform)
- [ ] Support per-session override
- [ ] Persist last selected store (app-level, not OS-level)

## 3. Store Validation

### 3.1 Structural Validation

- [x] Check path exists
- [x] Check path is a directory
- [x] Check `.gpg-id` exists at root
- [ ] Ensure `.gpg-id` is not empty

### 3.2 Cryptographic Validation

- [ ] Parse `.gpg-id`
- [ ] Verify each key ID exists in GPG keyring
- [ ] Detect corrupted or mismatched key IDs

### 3.3 Behavioral Validation

- [ ] Attempt a safe read operation (`pass ls`)
- [ ] Fail if `pass` exits non-zero

## 4. App State Machine (Core Architecture)

Replace vague "states" with deterministic ones:

- [ ] `DEPENDENCIES_MISSING`
- [ ] `GPG_NOT_INITIALIZED`
- [ ] `STORE_NOT_FOUND`
- [ ] `STORE_INVALID`
- [ ] `READY`

Also:

- [ ] Centralized state manager
- [ ] UI reacts strictly to state changes
- [ ] No UI logic outside state transitions

## 5. Listing Passwords

- [ ] Use `pass ls` as canonical source
- [ ] Parse tree output safely
- [ ] Handle empty store
- [ ] Cache results in memory
- [ ] Implement refresh mechanism
- [ ] Watch filesystem for changes
- [ ] Avoid manual filesystem traversal

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

You need this even if it's not obvious yet.

- [x] Central wrapper for executing `pass`
- [ ] Central wrapper for executing `gpg`
- [x] Scoped environment injection
- [ ] Timeout handling
- [x] Structured error parsing
- [x] Log stdout/stderr safely
- [x] Prevent shell injection vulnerabilities

## 8. Entry Operations (Core Features)

- [ ] Show entry (`pass show`)
- [ ] Insert entry (`pass insert`)
- [ ] Generate entry (`pass generate`)
- [ ] Edit entry (`pass edit`)
- [ ] Remove entry (`pass rm`)
- [ ] Rename entry (`pass mv`)
- [ ] Copy password to clipboard (securely, timed clear)
- [ ] Generate QR code image for password (future feature - display as image in UI)

## 9. Security Hardening

This is missing entirely from your list and it matters.

- [ ] Clear sensitive data from memory after use
- [ ] Avoid logging passwords accidentally
- [ ] Secure clipboard handling
- [x] Prevent command injection
- [x] Disable shell interpolation
- [x] Validate user input paths
- [ ] Handle GPG agent correctly
- [ ] Support passphrase prompts via agent

## 10. Extensions & Compatibility

`pass` supports extensions. If you want long-term parity:

- [ ] Detect `.extensions` directory
- [ ] Allow extension execution
- [ ] Support common extensions (e.g., OTP)

## 11. Error Handling & Diagnostics

- [ ] Structured error categories
- [ ] User-friendly error mapping
- [ ] Developer debug mode
- [ ] Logging system (without leaking secrets)

## 12. Configuration

- [x] Design configuration file format (TOML)
- [x] Implement config file read/write
- [ ] Migrate runtime preferences to config file
- [x] Define configuration schema (store paths, GNUPGHOME overrides, preferences)
- [x] Store custom GNUPGHOME per password store
