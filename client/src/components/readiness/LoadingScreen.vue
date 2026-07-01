<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-4">
    <Skeleton class="h-8 w-48" />
    <Skeleton class="h-4 w-32" />
    <p class="text-sm text-muted-foreground animate-pulse">
      Checking dependencies...
    </p>
  </div>
</template>
