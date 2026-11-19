<script lang="ts" setup>
import { Skeleton } from "@/components/ui/skeleton";
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <Skeleton class="h-8 w-48" />
    <Skeleton class="h-4 w-32" />
    <p class="text-muted-foreground animate-pulse text-sm">
      Checking dependencies...
    </p>
  </div>
</template>
