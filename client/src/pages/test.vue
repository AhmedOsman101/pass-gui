<script setup lang="ts">
import { ref } from "vue";
import { StreamBox } from "@/components/ui/stream-box";
import { Button } from "@/components/ui/button";
import { Neu, SECRET_MASK } from "@/services/neutralino";
import toml from "@/lib/toml";

// --- j-toml probe (open question #5) ---
type Case = {
  name: string;
  input: string;
  outcome: string;
};

const cases = ref<Case[]>([]);

function record(name: string, input: object): void {
  const result = toml.stringify(input);
  const outcome = result.isOk() ? `OK →\n${result.ok}` : `ERR → ${result.error.message}`;
  cases.value.push({ name, input: JSON.stringify(input), outcome });
}

function runTomlProbe(): void {
  cases.value = [];
  record("control: plain values", { core: { active_store: "default" } });
  record("section with undefined optional key", { gpg: { opts: [], signing_key: undefined } });
  record("top-level undefined value", { a: "x", b: undefined });
  record("null value", { a: null });
}

runTomlProbe();

// --- Stream box demos (Issue #23) ---
type DemoState = {
  command: string;
  stdout: string;
  stderr: string;
  running: boolean;
  exitCode: number | null;
};

const quickState = ref<DemoState>({
  command: Neu.buildDisplayCommand("echo", ["hello quick"]),
  stdout: "",
  stderr: "",
  running: false,
  exitCode: null,
});

const streamState = ref<DemoState>({
  command: "",
  stdout: "",
  stderr: "",
  running: false,
  exitCode: null,
});

const secretState = ref<DemoState>({
  command: "",
  stdout: "",
  stderr: "",
  running: false,
  exitCode: null,
});

async function runQuick(): Promise<void> {
  quickState.value.running = true;
  quickState.value.stdout = "";
  quickState.value.stderr = "";
  quickState.value.exitCode = null;
  quickState.value.command = Neu.buildDisplayCommand("echo", ["hello quick"]);

  const result = await Neu.exec({ cmd: "echo", args: ["hello quick"] });
  result.match({
    okFn: ok => {
      quickState.value.stdout = ok.stdOut;
      quickState.value.stderr = ok.stdErr;
      quickState.value.exitCode = ok.exitCode;
    },
    errFn: err => {
      quickState.value.stderr = err.message;
      // CommandFailedError carries exitCode
      const ce = err as { exitCode?: number; stdErr?: string; stdOut?: string };
      if (typeof ce.exitCode === "number") {
        quickState.value.exitCode = ce.exitCode;
        quickState.value.stdout = ce.stdOut ?? "";
        quickState.value.stderr = ce.stdErr ?? err.message;
      } else {
        quickState.value.exitCode = 1;
      }
    },
  });
  quickState.value.running = false;
}

async function runStream(): Promise<void> {
  streamState.value.running = true;
  streamState.value.stdout = "";
  streamState.value.stderr = "";
  streamState.value.exitCode = null;

  const isWindows = Neu.OS === "Windows";
  const cmd = isWindows ? "ping" : "sh";
  const args = isWindows
    ? ["-n", "5", "127.0.0.1"]
    : ["-c", 'for i in 1 2 3 4 5; do echo "line $i"; sleep 0.3; done'];
  streamState.value.command = Neu.buildDisplayCommand(cmd, args);

  const result = await Neu.spawn({
    cmd,
    args,
    onStdOut: (chunk: string) => {
      streamState.value.stdout += chunk;
    },
    onStdErr: (chunk: string) => {
      streamState.value.stderr += chunk;
    },
  });

  result.match({
    okFn: (ok: { exitCode: number }) => {
      streamState.value.exitCode = ok.exitCode;
    },
    errFn: (err: Error) => {
      const ce = err as { exitCode?: number; stdOut?: string; stdErr?: string };
      if (typeof ce.exitCode === "number") {
        streamState.value.exitCode = ce.exitCode;
      } else {
        streamState.value.exitCode = 1;
        streamState.value.stderr += `\n${err.message}`;
      }
    },
  });
  streamState.value.running = false;
}

async function runSecretStream(): Promise<void> {
  secretState.value.running = true;
  secretState.value.stdout = "";
  secretState.value.stderr = "";
  secretState.value.exitCode = null;

  // Secret via stdin — must not appear in display command
  const secret = "s3cret-passphrase-do-not-log";
  const isWindows = Neu.OS === "Windows";
  const cmd = isWindows ? "more" : "cat";
  // Display shows mask, real stdin is secret
  secretState.value.command = `${Neu.buildDisplayCommand(cmd, [])} < ${SECRET_MASK}`;

  const result = await Neu.spawn({
    cmd,
    args: [],
    stdin: secret,
    onStdOut: (chunk: string) => {
      secretState.value.stdout += chunk;
    },
    onStdErr: (chunk: string) => {
      secretState.value.stderr += chunk;
    },
  });

  result.match({
    okFn: (ok: { exitCode: number }) => {
      secretState.value.exitCode = ok.exitCode;
      // Verify secret not leaked into box: it should be via stdin only
      // If the command echoes stdin, output will contain secret, but box display does not
    },
    errFn: (err: Error) => {
      const ce = err as { exitCode?: number };
      secretState.value.exitCode = typeof ce.exitCode === "number" ? ce.exitCode : 1;
      secretState.value.stderr += `\n${err.message}`;
    },
  });
  secretState.value.running = false;
}
</script>

<template>
  <main class="p-6 space-y-8 max-w-3xl mx-auto">
    <h1 class="text-2xl font-semibold">Test Page</h1>

    <!-- Stream box demos — Issue #23 -->
    <section class="space-y-4">
      <h2 class="text-lg font-medium">Stream Box — dual execution path (Issue #23)</h2>
      <p class="text-sm text-muted-foreground">
        Quick via <code class="font-mono bg-muted px-1 rounded">Neu.exec</code> (no streaming), long via
        <code class="font-mono bg-muted px-1 rounded">Neu.spawn</code> (live chunks), secrets via stdin
        masked as <code class="font-mono bg-muted px-1 rounded">{{ SECRET_MASK }}</code>.
        Box collapsed by default, expandable, reusable.
      </p>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium">1. Quick command (no streaming)</h3>
          <Button size="sm" :disabled="quickState.running" @click="runQuick">
            {{ quickState.running ? "Running..." : "Run echo" }}
          </Button>
        </div>
        <StreamBox
          :command="quickState.command"
          :stdout="quickState.stdout"
          :stderr="quickState.stderr"
          :running="quickState.running"
          :exit-code="quickState.exitCode"
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium">2. Long operation (streamed)</h3>
          <Button size="sm" :disabled="streamState.running" @click="runStream">
            {{ streamState.running ? "Running..." : "Run loop" }}
          </Button>
        </div>
        <StreamBox
          :command="streamState.command || Neu.buildDisplayCommand('sh', ['-c', 'for i in 1 2 3 4 5; do echo line $i; sleep 0.3; done'])"
          :stdout="streamState.stdout"
          :stderr="streamState.stderr"
          :running="streamState.running"
          :exit-code="streamState.exitCode"
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium">3. Secret via stdin (masked)</h3>
          <Button size="sm" :disabled="secretState.running" @click="runSecretStream">
            {{ secretState.running ? "Running..." : "Run cat with secret" }}
          </Button>
        </div>
        <StreamBox
          :command="secretState.command || `${Neu.buildDisplayCommand('cat', [])} < ${SECRET_MASK}`"
          :stdout="secretState.stdout"
          :stderr="secretState.stderr"
          :running="secretState.running"
          :exit-code="secretState.exitCode"
        />
        <p class="text-xs text-muted-foreground">
          Real passphrase is sent via stdin, never in the command line. Box only shows
          <code class="font-mono">{{ SECRET_MASK }}</code>.
        </p>
      </div>
    </section>

    <!-- j-toml probe -->
    <section class="space-y-3 border-t pt-6">
      <h2 class="text-sm font-medium">j-toml stringify vs undefined/null — open question #5</h2>
      <div v-for="(testCase, index) in cases" :key="index" class="space-y-1">
        <p class="font-medium text-sm">{{ index + 1 }}. {{ testCase.name }}</p>
        <p class="text-xs text-muted-foreground font-mono">input: {{ testCase.input }}</p>
        <pre class="text-xs bg-muted rounded p-2 whitespace-pre-wrap">{{ testCase.outcome }}</pre>
      </div>
    </section>
  </main>
</template>
