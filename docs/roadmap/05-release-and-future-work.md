# 05 Release And Future Work

## Purpose

Finish the app for real use and define what comes after the first reliable
version.

## Goal

Move from a working development build to a distributable desktop app with a
clear post-release path.

## Release Outputs

### 1. Hardening And Verification

Before release, verify:

- critical flows work on a real password store,
- error states are understandable,
- clipboard clearing behaves as intended,
- config creation and persistence behave safely,
- sensitive values are not logged or persisted improperly.

### 2. Packaging

Prepare the app for distribution with a repeatable build path.

This includes:

- production build verification,
- Neutralino packaging checks,
- target-platform sanity checks,
- release notes and installation guidance.

### 3. User Documentation

Keep user-facing docs under `wiki/`.

At minimum, document:

- setup expectations for `pass` and GPG,
- config file behavior,
- store requirements,
- common recovery steps for blocked readiness states.

### 4. Maintenance Baseline

Establish a standard for future work:

- roadmap stays strategic,
- implementation detail lives in `docs/plans/`,
- reusable requirements live in `docs/specs/`.

## Future Work After First Usable Release

These are good next candidates once the core app is stable:

- richer multi-store management flows
- better settings UX
- password generation UX improvements
- rename/move/copy entry workflows
- git-aware store history features
- OTP and other pass ecosystem extensions

## Things To Delay Until The Core App Is Stable

- ambitious component-library work
- broad theming work
- platform-specific extras
- advanced sync and sharing ideas

## Exit Criteria For This File

The first roadmap cycle is complete when:

- backend readiness is stable,
- backend entry operations are stable,
- frontend core flows work against stable contracts,
- the app can be packaged and documented for real use.

## Minimal Shape Example

```text
usable app -> packaged app -> documented app -> next expansion cycle
```
