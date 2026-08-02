# Entry Raw Mode Design

## Goal

Let users create and edit `pass` entries as whole text files without removing
the existing structured form.

## UI

`EntryForm` provides a mode toggle:

- **Form mode:** password, one OTP URI textarea, repeatable metadata fields,
  and a Notes textarea.
- **Raw mode:** one full-entry textarea and concise format help:
  - line 1 is required and is the password/secret;
  - later `key: value` lines become metadata;
  - one `otpauth://...` line becomes the OTP URI;
  - every other later line becomes Notes.

Raw text uses the existing technical monospace styling. Form controls retain
the existing component vocabulary and form layout; no visual redesign.

## Canonical Draft and Mode Switching

The form owns one canonical draft: secret, optional OTP URI, metadata entries,
and notes. Raw mode is a full-text view of that draft.

- Form to raw serializes in this exact order: secret, OTP URI if present,
  non-empty `key: value` metadata entries, then notes lines.
- Raw to form parses the raw content into the canonical draft.
- Mode switches preserve the user's content. Non-metadata lines remain in
  Notes; they are never discarded.
- The first `otpauth://...` line must be recognized before generic colon-pair
  parsing so its colon does not turn it into metadata. Later OTP URI lines are
  Notes, like any other non-pair line.
- One OTP URI is exposed in Form mode. Extra OTP URI lines remain preserved in
  Notes; they are not errors and do not replace the first OTP URI.

## Validation and Save

- Both modes require a non-empty first line/password.
- Structured mode retains duplicate-metadata validation.
- Raw mode validates the required first line.
- Save always serializes the canonical draft and keeps existing
  `insertEntry()` / `editEntry()` behavior.
- Existing files with metadata, standalone notes, and standalone OTP URI lines
  must round-trip through edit mode without changing their meaning.

## Parser and Display

`parsePassShowOutput()` must identify standalone `otpauth://...` lines before
checking for `key: value` pairs. Since `EntryDetail` currently displays parsed
metadata and other lines, the standalone OTP URI remains visible as an
unstructured line. This feature does not add OTP generation, QR rendering, or
multiple OTP support.

## Deferred Tests

The user explicitly deferred new automated tests for this feature. Existing
tests remain untouched unless an implementation change requires adjustment.
