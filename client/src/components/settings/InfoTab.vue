<script lang="ts" setup>
import { Check, Copy } from "@lucide/vue";
import { onUnmounted, ref } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useNotifyResult } from "@/composables/use-notify-result";
import toml from "@/lib/toml";
import { Clipboard } from "@/services/clipboard";
import type { AppConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";

const props = defineProps<{
  config: ParsedToml<AppConfig>;
  configPath: string;
  gpgInfo: {
    binary: string;
    version: string;
    homeDir: string;
    keyCount: number;
  } | null;
  passInfo: {
    binary: string;
    version: string;
    storeDir: string;
  } | null;
}>();

const copiedInfo = ref(false);
const copiedConfig = ref(false);

let infoTimer: ReturnType<typeof setTimeout> | null = null;
let configTimer: ReturnType<typeof setTimeout> | null = null;

onUnmounted(() => {
  if (infoTimer) clearTimeout(infoTimer);
  if (configTimer) clearTimeout(configTimer);
});

function buildInfoText(): string {
  const lines: string[] = [];
  if (props.passInfo) {
    lines.push(`pass_version: ${props.passInfo.version}`);
    lines.push(`pass_binary: ${props.passInfo.binary}`);
    lines.push(`store_directory: ${props.passInfo.storeDir}`);
  }
  if (props.gpgInfo) {
    lines.push(`gpg_version: ${props.gpgInfo.version}`);
    lines.push(`gpg_binary: ${props.gpgInfo.binary}`);
    lines.push(`gpg_home: ${props.gpgInfo.homeDir}`);
    lines.push(`gpg_secret_keys: ${props.gpgInfo.keyCount}`);
  }
  lines.push(`active_store: ${props.config.data.core.active_store}`);
  lines.push("app_version: 0.0.1");
  lines.push("license: GPL-3.0-or-later");
  lines.push("repository: https://github.com/AhmedOsman101/pass-gui");
  lines.push("author: Ahmad Othman");
  return lines.join("\n");
}

async function copyInfo(): Promise<void> {
  const result = await Clipboard.writeWithTimeout(buildInfoText(), "app-info");
  useNotifyResult(result, {
    ok: "Info copied to clipboard",
    err: "Failed to copy info",
  });
  if (result.isOk()) {
    copiedInfo.value = true;
    if (infoTimer) clearTimeout(infoTimer);
    infoTimer = setTimeout(() => {
      copiedInfo.value = false;
    }, 2000);
  }
}

async function copyConfig(): Promise<void> {
  const serialized = useNotifyResult(toml.stringify(props.config), {
    ok: false,
    err: "Failed to serialize config",
  });
  if (serialized.isError()) return;

  const result = await Clipboard.writeWithTimeout(serialized.ok, "app-config");
  useNotifyResult(result, {
    ok: "Config copied to clipboard",
    err: "Failed to copy config",
  });
  if (result.isOk()) {
    copiedConfig.value = true;
    if (configTimer) clearTimeout(configTimer);
    configTimer = setTimeout(() => {
      copiedConfig.value = false;
    }, 2000);
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>System Info</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">pass</span>
        <span class="font-mono text-sm">
          {{ passInfo?.version || "Unknown" }}
          <Badge class="ml-2 text-xs" variant="secondary">
            {{ passInfo?.binary || "N/A" }}
          </Badge>
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">gpg</span>
        <span class="font-mono text-sm">
          {{ gpgInfo?.version || "Unknown" }}
          <Badge class="ml-2 text-xs" variant="secondary">
            {{ gpgInfo?.binary || "N/A" }}
          </Badge>
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Active Store</span>
        <span class="font-mono text-sm">
          {{ config.data.core.active_store || "N/A" }}
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Store Directory</span>
        <span class="font-mono text-sm">
          {{ passInfo?.storeDir || "N/A" }}
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">GPG Home</span>
        <span class="font-mono text-sm">
          {{ gpgInfo?.homeDir || "N/A" }}
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Secret Keys</span>
        <Badge variant="secondary">{{ gpgInfo?.keyCount ?? 0 }}</Badge>
      </div>
    </CardContent>
  </Card>

  <Card class="mt-4">
    <CardHeader>
      <CardTitle>About</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Version</span>
        <span class="font-mono text-sm">0.0.1</span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">License</span>
        <span class="font-mono text-sm">GPL-3.0-or-later</span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Author</span>
        <span class="font-mono text-sm">Ahmad Othman</span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Repository</span>
        <a
          class="text-primary font-mono text-sm underline-offset-4 hover:underline"
          href="https://github.com/AhmedOsman101/pass-gui"
          rel="noopener noreferrer"
          target="_blank"
        >
          AhmedOsman101/pass-gui
        </a>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-sm">Config File</span>
        <span
          class="text-muted-foreground max-w-[60%] truncate font-mono text-xs"
          :title="configPath"
        >
          {{ configPath }}
        </span>
      </div>
      <Separator />
      <div class="flex gap-2">
        <Button class="flex-1" variant="outline" @click="copyInfo">
          <Check class="mr-2 size-4" v-if="copiedInfo" />
          <Copy class="mr-2 size-4" v-else />
          {{ copiedInfo ? "Copied!" : "Copy Info" }}
        </Button>
        <Button class="flex-1" variant="outline" @click="copyConfig">
          <Check class="mr-2 size-4" v-if="copiedConfig" />
          <Copy class="mr-2 size-4" v-else />
          {{ copiedConfig ? "Copied!" : "Copy Config" }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
