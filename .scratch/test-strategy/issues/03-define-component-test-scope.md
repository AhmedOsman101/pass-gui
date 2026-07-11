# 03: Define component test scope and patterns

Type: grilling
Status: open
Blocked by:

## Question

Which Vue components warrant tests, and what should those tests validate?

The app has ~20 custom components + ~50 shadcn-vue UI components. Not all need tests. Need to:

1. Identify components with non-trivial logic:
   - **EntryForm** (330L) — form validation, multi-field interaction, password generator integration
   - **Tree** (271L) — keyboard navigation, context menus, sort/search filtering, expand/collapse
   - **AppSidebar** (247L) — search, sort, store watcher, hotkeys, new/generate buttons
   - **AddStoreWizard** (370L) — multi-step wizard, store creation logic
   - **GpgTab** (270L) — GPG key display
   - **StoresTab** (308L) — store management
   - **EntryDetail** (299L) — secret show/hide, copy, metadata display
2. For each, define what behavior to test (NOT rendering/styling — that's integration/visual territory):
   - Input validation
   - State transitions
   - Callback propagation
   - Error display
3. Decide how to test:
   - Vue Test Utils for component-level behavior
   - Mock stores + services via `vi.mock`
   - What NOT to test (shadcn-vue wrappers, pure presentational components, dialog passthroughs)

## Deliverables

A scoped list in the Test Strategy Document specifying:
- Which components get tests (and which don't)
- What behaviors are tested per component
- The test pattern (Vue Test Utils harness + mocking setup)
