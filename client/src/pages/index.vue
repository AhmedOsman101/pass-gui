<script lang="ts" setup>
import AppSidebar from "@/components/AppSidebar.vue";
import EntryDetail from "@/components/EntryDetail.vue";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarProvider } from "@/components/ui/sidebar";
</script>

<template>
  <SidebarProvider>
    <ResizablePanelGroup class="h-screen" direction="horizontal">
      <ResizablePanel :default-size="22" :min-size="12">
        <div class="h-screen overflow-hidden">
          <AppSidebar />
        </div>
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
