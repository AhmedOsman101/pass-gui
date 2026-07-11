# 05: Define Pinia store and composable test patterns

Type: research
Status: open
Blocked by:

## Question

How should the 5 Pinia stores and 4 composables be tested?

Key questions:

1. **`@pinia/testing`** — How does it work with Pinia 3's setup stores? Can we inject a mocked service layer?
2. **Service injection** — Stores import services directly (`import { Pass } from "@/services/pass"`). Can `vi.mock` handle this? Do we need to mock at the service module level?
3. **EntryTree store** — This is the largest store (212L) with CRUD operations, search, sort. How do we test tree mutations? Mock the `Entries` service?
4. **Clipboard store** (109L) — Timer-based with drift correction. How to test `setTimeout`/`clearTimeout` interactions with fake timers?
5. **ActiveStore store** (126L) — Config + Pass service orchestration. Integration-style test?
6. **Composables** — `useTreeState` (148L, complex keyboard nav + tree state). How to test composables in isolation vs coupled to EntryTree store?
7. **`usePasswordGenerator`** — Depends on crypto.getRandomValues. Mock the crypto API?

## Deliverables

Test pattern templates for each store/composable type in the strategy doc:
- Setup store test (ActiveStore)
- Store with service mocks (EntryTree)
- Timer-based store (Clipboard)
- Composable with store coupling (useTreeState)
- Crypto-dependent composable (usePasswordGenerator)

Include code examples where needed.
