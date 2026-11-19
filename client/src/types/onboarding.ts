/**
 * Shape of the config checks consumed by the onboarding step machine.
 *
 * `contentValid` is `null` when the config is missing or could not be
 * read, parsed, or schema-validated; otherwise it is the result of the
 * content checks, where `false` means a blocking active-store GNUPGHOME
 * problem. The step machine treats `null` as "unknown, not blocking".
 */
type ConfigStatus = {
  exists: boolean;
  schemaValid: boolean;
  contentValid: boolean | null;
};

/**
 * Fixed onboarding step order (decision: Binaries → Config → Keys →
 * Store → Done). The step machine never reorders these.
 */
type OnboardingStepId = "binaries" | "config" | "keys" | "store" | "done";

/**
 * Per-step status rendered by the fixed progress rail.
 * - `done`: resolved (snapshot moved past it / config valid)
 * - `current`: first unresolved step — the active blocker
 * - `pending`: not reached yet
 * - `skipped`: not applicable (Keys when the keyring is non-empty —
 *   key selection is handled during store init instead)
 */
type StepStatus = "done" | "current" | "pending" | "skipped";

/**
 * One rail entry: identity + display text + derived status.
 */
type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  description: string;
  status: StepStatus;
};

/**
 * Output of the pure step machine (`computeSteps`).
 */
type StepMachineResult = {
  steps: OnboardingStep[];
  /** First unresolved step, or `"done"` when everything is resolved. */
  currentStepId: OnboardingStepId;
};

export type {
  ConfigStatus,
  OnboardingStep,
  OnboardingStepId,
  StepMachineResult,
  StepStatus,
};
