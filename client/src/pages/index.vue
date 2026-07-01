<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import EntryDetail from "@/components/EntryDetail.vue";
import { SidebarProvider } from "@/components/ui/sidebar";
</script>

<template>
  <SidebarProvider>
    <div class="flex h-screen">
      <AppSidebar />
      <main class="flex-1 overflow-auto">
        <EntryDetail />
      </main>
    </div>
  </SidebarProvider>
</template>
