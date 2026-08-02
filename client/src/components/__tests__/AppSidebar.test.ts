import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import AppSidebar from "@/components/AppSidebar.vue";
import { useClipboardBuffer } from "@/composables/use-clipboard-buffer";
import { Pass } from "@/services/pass";
import { Watcher } from "@/services/watcher";
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntryTreeStore } from "@/stores/entry-tree";

const { hotkeyCallbacks } = vi.hoisted(() => ({
  hotkeyCallbacks: new Map<string, () => void>(),
}));

vi.mock("@tanstack/vue-hotkeys", () => ({
  useHotkey: vi.fn((key: string, cb: () => void) => {
    hotkeyCallbacks.set(key, cb);
  }),
}));

vi.mock("@/services/watcher", () => ({
  Watcher: {
    watch: vi.fn(),
    unwatch: vi.fn(),
    hasChanged: vi.fn(),
  },
}));

vi.mock("@/services/pass", () => ({
  Pass: {
    storePath: "",
  },
}));

vi.mock("@/composables/use-clipboard-buffer");

const defaultInitialState = {
  "active-store": { storePath: "/home/user/.password-store" },
  "entry-tree": {
    selectedPath: "Email/work",
    currentPath: "Email/work",
    tree: [
      {
        path: "Email",
        type: "DIRECTORY",
        children: [{ path: "Email/work", type: "FILE" }],
      },
    ],
    sortMode: "alphabetical",
    hasEntries: true,
    isLoadingTree: false,
  },
};

function mountSidebar(
  initialState: Record<string, Record<string, unknown>> = defaultInitialState
) {
  return mount(AppSidebar, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState,
        }),
      ],
      stubs: {
        RouterLink: {
          template: "<a><slot /></a>",
        },
        Tree: true,
        Sidebar: {
          template: "<div><slot /></div>",
        },
        PasswordGenerator: {
          template: "<div><slot /></div>",
        },
      },
    },
  });
}

describe("AppSidebar", () => {
  let mockBuffer: ReturnType<typeof ref>;
  let mockCopyEntry: ReturnType<typeof vi.fn>;
  let mockCutEntry: ReturnType<typeof vi.fn>;
  let mockPasteEntry: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    hotkeyCallbacks.clear();

    mockBuffer = ref<{ mode: string; path: string } | null>(null);
    mockCopyEntry = vi.fn();
    mockCutEntry = vi.fn();
    mockPasteEntry = vi.fn();

    vi.mocked(useClipboardBuffer).mockReturnValue({
      buffer: mockBuffer as any,
      copyEntry: mockCopyEntry as any,
      cutEntry: mockCutEntry as any,
      pasteEntry: mockPasteEntry as any,
    });

    Pass.storePath = "";
  });

  it("searchQuery updates and debouncedSearch is 300ms delayed", async () => {
    vi.useFakeTimers();
    const wrapper = mountSidebar();
    const vm = wrapper.vm as any;

    const input = wrapper.find("input[type='text']");
    await input.setValue("test");
    await wrapper.vm.$nextTick();

    expect(vm.debouncedSearch).toBe("");

    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();

    expect(vm.debouncedSearch).toBe("test");

    vi.useRealTimers();
  });

  it("Watcher.watch called with correct args when Pass.storePath is set", () => {
    Pass.storePath = "/home/user/.password-store";

    mountSidebar();

    expect(Watcher.watch).toHaveBeenCalledWith(
      "store",
      "/home/user/.password-store",
      ".gpg-id"
    );
  });

  it("treeStore.refresh called when Watcher.hasChanged returns true", () => {
    vi.useFakeTimers();
    mountSidebar();
    const treeStore = useEntryTreeStore();

    vi.mocked(Watcher.hasChanged).mockReturnValue(true);
    vi.advanceTimersByTime(2000);

    expect(treeStore.refresh).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("interval cleared and Watcher.unwatch called on unmount", () => {
    const wrapper = mountSidebar();

    wrapper.unmount();

    expect(Watcher.unwatch).toHaveBeenCalledWith("store");
  });

  it("Mod+C calls clipboard.copyEntry with selected path and node type", () => {
    mountSidebar({
      ...defaultInitialState,
      "entry-tree": {
        ...defaultInitialState["entry-tree"],
        selectedPath: "Email",
      },
    });

    const cb = hotkeyCallbacks.get("Mod+C");
    expect(cb).toBeDefined();
    cb?.();

    expect(mockCopyEntry).toHaveBeenCalledWith("Email", "DIRECTORY");
  });

  it("Mod+X calls clipboard.cutEntry with sidebar selection", () => {
    mountSidebar({
      ...defaultInitialState,
      "entry-tree": {
        ...defaultInitialState["entry-tree"],
        selectedPath: "Email",
      },
    });

    const cb = hotkeyCallbacks.get("Mod+X");
    expect(cb).toBeDefined();
    cb?.();

    expect(mockCutEntry).toHaveBeenCalledWith("Email", "DIRECTORY");
  });

  it("Mod+V pastes into parent directory for selected files", () => {
    mountSidebar();

    mockBuffer.value = { mode: "copy", path: "Email/work" };

    const cb = hotkeyCallbacks.get("Mod+V");
    expect(cb).toBeDefined();
    cb?.();

    expect(mockPasteEntry).toHaveBeenCalledWith("Email");
  });

  it("findNode finds node by path in nested tree", () => {
    const wrapper = mountSidebar();
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();

    const found = vm.findNode(treeStore.tree, "Email/work");
    expect(found).toBeDefined();
    expect(found.path).toBe("Email/work");

    const notFound = vm.findNode(treeStore.tree, "nonexistent");
    expect(notFound).toBeUndefined();
  });

  it("mounts without error when hasEntries is true", () => {
    expect(() => mountSidebar()).not.toThrow();
  });

  it("watch activeStore.hasStore → treeStore.loadTree()", async () => {
    const wrapper = mountSidebar({
      "active-store": { storePath: null },
      "entry-tree": {
        selectedPath: null,
        currentPath: null,
        tree: [],
        sortMode: "alphabetical",
        hasEntries: false,
        isLoadingTree: false,
      },
    });

    const treeStore = useEntryTreeStore();
    expect(treeStore.loadTree).not.toHaveBeenCalled();

    const activeStore = useActiveStoreStore();
    activeStore.storePath = "/some/path";
    await wrapper.vm.$nextTick();

    expect(treeStore.loadTree).toHaveBeenCalled();
  });

  it("Pass.storePath watch triggers startStoreWatcher", async () => {
    Pass.storePath = "";
    const wrapper = mountSidebar();

    expect(Watcher.watch).not.toHaveBeenCalled();

    Pass.storePath = "/new/path";
    await (wrapper.vm as any).startStoreWatcher();

    expect(Watcher.watch).toHaveBeenCalledWith("store", "/new/path", ".gpg-id");
  });
});
