# Product

<!-- impeccable:product-schema 1 -->

## Platform

desktop adaptive

## Users

Primary users are individuals who use UNIX tooling and want a visual interface for managing their `pass` password-store entries. The product should also support beginners who value local ownership of their data but may not know GNU Privacy Guard or `pass`, while retaining workflows advanced users expect.

## Product Purpose

Pass GUI is a desktop GUI wrapper for the `pass` UNIX password manager. It lets users visually browse, create, edit, generate, organize, and manage password-store entries without giving up local encrypted ownership. Success means users can manage their password store comfortably through a GUI while preserving the underlying `pass` model and data.

## Positioning

A beginner-friendly visual layer over the existing `pass` and GnuPG ecosystem, preserving local ownership and UNIX-compatible password-store data rather than replacing it with a hosted vault. Users may choose it alongside QtPass as a serious desktop GUI option.

## Operating Context

Users work with a local password store on a desktop operating system. Advanced users may rely on existing `pass` conventions and command-line workflows; beginner users need discoverable guidance without being forced into a hosted service. Future Git support may enable users to self-host and access their encrypted password store anywhere they have Git access.

## Capabilities and Constraints

Current application evidence shows a Neutralino desktop shell with a Vue client, password-store entry and folder management, entry editing and detail views, password generation, clipboard operations, store setup and settings, and readiness checks for required dependencies. Preserve compatibility with the underlying `pass` data model and local encrypted storage. Future Git support is an open product direction, not a current capability.

## Brand Commitments

Product name: Pass GUI. Existing product description: user-friendly desktop GUI application for the GNU Pass password manager. Beginner-friendly, local-first, and useful for advanced users.

## Evidence on Hand

- Existing implementation under `client/src/`.
- Neutralino desktop configuration in `neutralino.config.json`.
- Existing UI components for entries, folders, generation, stores, settings, clipboard, and readiness flows.
- No evidence supplied for testimonials, customer claims, benchmarks, pricing, or hosted-service functionality; future work must not fabricate these.

## Product Principles

- Keep encrypted password data under the user's control.
- Preserve compatibility with `pass` and UNIX workflows.
- Make essential workflows clear to beginners.
- Keep advanced workflows available without unnecessary friction.
- Prefer local operation; treat self-hosted Git access as a future extension.
