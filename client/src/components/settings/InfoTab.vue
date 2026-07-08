<script setup lang="ts">
import { Copy, Check } from "@lucide/vue";
import { ref } from "vue";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Config } from "@/services/config";
import toml from "@/lib/toml";
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
  lines.push(`app_version: 0.0.1`);
  lines.push(`license: GPL-3.0-or-later`);
  lines.push(`repository: https://github.com/AhmedOsman101/pass-gui`);
  lines.push(`author: Ahmad Othman`);
  return lines.join("\n");
}

async function copyInfo(): Promise<void> {
  try {
    await navigator.clipboard.writeText(buildInfoText());
    copiedInfo.value = true;
    toast.success("Info copied to clipboard");
    setTimeout(() => {
      copiedInfo.value = false;
    }, 2000);
  } catch {
    toast.error("Failed to copy info");
  }
}

async function copyConfig(): Promise<void> {
  const result = toml.stringify(props.config);
  if (result.isError()) {
    toast.error("Failed to serialize config");
    return;
  }
  try {
    await navigator.clipboard.writeText(result.ok);
    copiedConfig.value = true;
    toast.success("Config copied to clipboard");
    setTimeout(() => {
      copiedConfig.value = false;
    }, 2000);
  } catch {
    toast.error("Failed to copy config");
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
        <span class="text-sm text-muted-foreground">pass</span>
        <span class="text-sm font-mono">
          {{ passInfo?.version || "Unknown" }}
          <Badge variant="secondary" class="ml-2 text-xs">
            {{ passInfo?.binary || "N/A" }}
          </Badge>
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">gpg</span>
        <span class="text-sm font-mono">
          {{ gpgInfo?.version || "Unknown" }}
          <Badge variant="secondary" class="ml-2 text-xs">
            {{ gpgInfo?.binary || "N/A" }}
          </Badge>
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Active Store</span>
        <span class="text-sm font-mono">
          {{ config.data.core.active_store || "N/A" }}
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Store Directory</span>
        <span class="text-sm font-mono">
          {{ passInfo?.storeDir || "N/A" }}
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">GPG Home</span>
        <span class="text-sm font-mono">
          {{ gpgInfo?.homeDir || "N/A" }}
        </span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Secret Keys</span>
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
        <span class="text-sm text-muted-foreground">Version</span>
        <span class="text-sm font-mono">0.0.1</span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">License</span>
        <span class="text-sm font-mono">GPL-3.0-or-later</span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Author</span>
        <span class="text-sm font-mono">Ahmad Othman</span>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Repository</span>
        <a
          href="https://github.com/AhmedOsman101/pass-gui"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-mono text-primary underline-offset-4 hover:underline"
        >
          AhmedOsman101/pass-gui
        </a>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Config File</span>
        <span
          class="max-w-[60%] truncate font-mono text-xs text-muted-foreground"
          :title="configPath"
        >
          {{ configPath }}
        </span>
      </div>
      <Separator />
      <div class="flex gap-2">
        <Button variant="outline" class="flex-1" @click="copyInfo">
          <Check v-if="copiedInfo" class="size-4 mr-2" />
          <Copy v-else class="size-4 mr-2" />
          {{ copiedInfo ? "Copied!" : "Copy Info" }}
        </Button>
        <Button variant="outline" class="flex-1" @click="copyConfig">
          <Check v-if="copiedConfig" class="size-4 mr-2" />
          <Copy v-else class="size-4 mr-2" />
          {{ copiedConfig ? "Copied!" : "Copy Config" }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
