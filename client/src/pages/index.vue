<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import EntryDetail from "@/components/EntryDetail.vue";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
</script>

<template>
  <SidebarProvider>
    <ResizablePanelGroup direction="horizontal" class="h-screen">
      <ResizablePanel :default-size="20" :min-size="15" :max-size="40">
        <AppSidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel :default-size="80">
        <main class="h-full overflow-auto">
          <EntryDetail />
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  </SidebarProvider>
</template>
