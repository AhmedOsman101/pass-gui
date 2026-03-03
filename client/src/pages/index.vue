<script setup lang="ts">
import { computedAsync } from "@vueuse/core";
import { gpg } from "@/services/gpg";
import { neu } from "@/services/neutralino";
import { pass } from "@/services/pass";

/**
 * Checks if the 'pass' command exists in the system PATH.
 */
const commandExists = computedAsync(async () => {
  return await neu.commandExists("pass");
});

/**
 * Resolves the full path to the 'pass' binary.
 */
const resolveBinary = computedAsync(async () => {
  return await neu.resolveBinaryPath("pass");
});

/**
 * Validates the pass binary and returns its metadata.
 */
const validatePass = computedAsync(async () => {
  return await pass.validatePassBinary();
});

/**
 * Lists all secret keys available in the GPG keyring.
 */
const secretKeys = computedAsync(async () => {
  return await gpg.listSecretKeys();
});
</script>

<template>
  <main>
    <pre>
commandExists: {{ commandExists?.ok }}
resolveBinary: {{ resolveBinary?.ok }}
validatePass: {{ validatePass?.ok?.path }} - isSystemBinary: {{
        validatePass?.ok?.isSystemBinary
      }}
secretKeys: {{ secretKeys?.ok }}
    </pre>
  </main>
</template>
