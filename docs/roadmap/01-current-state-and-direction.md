# 01 Current State And Direction

## Purpose

Establish the real starting point for the project and define the rules for
everything that follows.

## Current State

The repo is no longer a blank scaffold.

- Neutralino, Vue, Pinia, TypeScript, and workspace wiring are already in
  place.
- Config loading, validation, default generation, and comment-aware TOML
  writing are implemented.
- The project already models multiple stores in config.
- Core service work has started for `pass`, `gpg`, filesystem access, and
  Neutralino command execution.
- Frontend state and screens are still minimal.

## What Changed From The Old Vision

The older roadmap assumed:

- setup and frontend scaffolding were still the main work,
- backend work had barely started,
- multi-store support was a later enhancement.

That is no longer true.

The new roadmap treats the app as a backend-first desktop client whose UI
should only expand after the runtime model is trustworthy.

## Guiding Principles

### 1. Backend Before UI

Do not build major screens on top of unstable service behavior.

The backend should first answer:

- Is the environment usable?
- Which store is active?
- Why is the app blocked, if it is blocked?
- Which operations are safe to expose?

### 2. Readiness Before Features

Before implementing entry listing, viewing, insertion, or deletion, the app
needs a deterministic readiness layer that validates dependencies, GPG state,
and the active store.

### 3. Config Is A Product Surface

Configuration is not a side detail. It already shapes store selection,
generation defaults, clipboard behavior, GPG behavior, and future runtime
decisions. Keep it validated and user-readable.

### 4. Stable Contracts Before Components

Pinia stores and UI components should consume explicit backend contracts,
not invent behavior ad hoc.

### 5. Security And Error Clarity

User-facing errors should be direct and actionable. Sensitive data must stay
out of logs and long-lived state.

## Sequential Path

Follow the roadmap in this order:

1. Finish backend foundation and readiness.
2. Build backend entry operations and state contracts.
3. Build frontend flows against those contracts.
4. Package, polish, and document the app.
5. Expand into richer post-MVP capabilities.

## Exit Criteria For This File

Do not move on until these statements are accepted as the project direction:

- The roadmap is backend first.
- Readiness is the next major implementation phase.
- Frontend work follows stable backend contracts, not the reverse.
- Old bootstrap/setup documents are historical, not authoritative.

## Minimal Shape Example

The desired layering is:

```text
config -> readiness -> entry operations -> state contract -> UI
```
