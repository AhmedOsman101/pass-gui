# 01: Investigate @neutralinojs/lib API surface for mock design

Type: research
Status: open
Blocked by:

## Question

What exactly does `@neutralinojs/lib` export, and what's the minimum mock surface needed to support testing all services?

The mock strategy is decided: `vi.mock("@neutralinojs/lib")`. But we need to know:

1. Which named exports are used by the service layer? (`os`, `filesystem`, `clipboard`, `events`, `debug`, etc.)
2. What are the exact function signatures for each used export?
3. Are there any exports that return complex types (e.g., `ExecCommandResult`) that need to be replicated?
4. Can we create a reusable mock factory (e.g., `createMockNeuLib()`) that all test files share?

## Deliverables

A markdown document (`.scratch/test-strategy/mock-surface.md`) listing:
- Every `@neutralinojs/lib` import used across the service layer
- Function signatures with types
- Recommended mock factory structure
- Any gotchas (e.g., exports that have side effects on import)
