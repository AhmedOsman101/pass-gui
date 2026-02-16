import type { Version } from "@/types";

const PASS_MIN_VERSION: Version = { major: 1, minor: 7, patch: 0 };
const SYSTEM_PASS_PATHS = ["/usr/bin/pass", "/bin/pass"];

export { PASS_MIN_VERSION, SYSTEM_PASS_PATHS };
