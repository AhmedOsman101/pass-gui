import type {
  ConfigStatus,
  OnboardingStep,
  OnboardingStepId,
  StepMachineResult,
} from "@/types/onboarding";
import type { ReadinessSnapshot, ReadinessState } from "@/types/readiness";

/**
 * Pure onboarding step machine.
 *
 * Maps `(ReadinessSnapshot, ConfigStatus)` to the fixed five-step plan
 * (Binaries → Config → Keys → Store → Done) with per-step status. Reacts
 * to snapshots only — detection stays in `Readiness`. No services, no
 * Neutralino, no components: data in, data out.
 */

/**
 * Readiness states each step resolves. Anything else (READY,
 * STORE_EMPTY) means "no blocker" for that step.
 */
const STEP_STATES: Record<OnboardingStepId, ReadonlySet<ReadinessState>> = {
  binaries: new Set<ReadinessState>(["NEED_PASS", "NEED_TREE", "NEED_GPG"]),
  config: new Set<ReadinessState>([]),
  // Keys fires only on GPG_NO_KEYS; otherwise key selection happens
  // during store init.
  keys: new Set<ReadinessState>(["GPG_NO_KEYS"]),
  store: new Set<ReadinessState>([
    "STORE_NOT_FOUND",
    "STORE_NO_GPG_ID",
    "STORE_GPG_ID_EMPTY",
    "STORE_GPG_ID_KEY_MISSING",
    "STORE_SCAN_FAILED",
  ]),
  done: new Set<ReadinessState>([]),
};

const STEP_META: Record<
  OnboardingStepId,
  { label: string; description: string }
> = {
  binaries: {
    label: "Binaries",
    description: "Install pass, tree, and GnuPG.",
  },
  config: {
    label: "Config",
    description: "Validate the pass-gui configuration file.",
  },
  keys: {
    label: "Keys",
    description: "Create or select a GPG key for encryption.",
  },
  store: {
    label: "Store",
    description: "Set up or repair the active password store.",
  },
  done: {
    label: "Done",
    description: "Everything is ready — enter the app.",
  },
};

const STEP_ORDER: readonly OnboardingStepId[] = [
  "binaries",
  "config",
  "keys",
  "store",
  "done",
];

/**
 * Computes onboarding steps from a readiness snapshot plus config
 * status. Pure: same inputs → same outputs.
 *
 * Per-step status:
 * - `done`:    blocker resolved (snapshot/config moved past it)
 * - `current`: first unresolved step — the active blocker
 * - `pending`: after the current step
 * - `skipped`: Keys when the keyring is non-empty (handled during
 *   store init instead)
 *
 * `currentStepId` is `"done"` when nothing blocks.
 */
function computeSteps(
  snapshot: ReadinessSnapshot | null,
  configStatus: ConfigStatus
): StepMachineResult {
  const state: ReadinessState = snapshot?.state ?? "NEED_PASS";

  const resolved: Record<OnboardingStepId, boolean> = {
    binaries: !STEP_STATES.binaries.has(state),
    config:
      configStatus.exists &&
      configStatus.schemaValid &&
      configStatus.contentValid !== false,
    keys: !STEP_STATES.keys.has(state),
    store: !STEP_STATES.store.has(state),
    done: state === "READY" || state === "STORE_EMPTY",
  };

  const steps: OnboardingStep[] = STEP_ORDER.map(id => ({
    id,
    ...STEP_META[id],
    status: "pending",
  }));

  let currentStepId: OnboardingStepId = "done";
  let currentFound = false;
  for (const step of steps) {
    if (!resolved[step.id] && !currentFound) {
      step.status = "current";
      currentStepId = step.id;
      currentFound = true;
    } else if (step.id === "keys" && resolved.keys) {
      step.status = "skipped";
    } else {
      step.status = currentFound ? "pending" : "done";
    }
  }

  return { steps, currentStepId };
}

export { computeSteps };
