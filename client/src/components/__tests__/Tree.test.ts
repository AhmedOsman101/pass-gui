import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import Tree from "@/components/Tree.vue";
import { useClipboardBuffer } from "@/composables/use-clipboard-buffer";
import { useTreeState } from "@/composables/useTreeState";

const { hotkeyCallbacks } = vi.hoisted(() => ({
  hotkeyCallbacks: new Map<string, () => void>(),
}));

vi.mock("@tanstack/vue-hotkeys", () => ({
  useHotkey: vi.fn((key: string, cb: () => void) => {
    hotkeyCallbacks.set(key, cb);
  }),
}));

vi.mock("@/composables/useTreeState");
vi.mock("@/composables/use-clipboard-buffer");

describe("Tree", () => {
  const mockSelectedPath = ref<string | null>(null);
  const mockFocusedPath = ref<string | null>(null);
  const mockVisibleNodes = ref<
    { path: string; depth: number; isDirectory: boolean; isExpanded: boolean }[]
  >([]);
  const mockFocusNext = vi.fn();
  const mockFocusPrev = vi.fn();
  const mockArrowRight = vi.fn();
  const mockArrowLeft = vi.fn();
  const mockToggleDir = vi.fn();
  const mockToggleSelect = vi.fn();
  const mockFocusSelect = vi.fn();

  const mockBuffer = ref<{ mode: string; path: string } | null>(null);
  const mockCopyEntry = vi.fn();
  const mockCutEntry = vi.fn();
  const mockPasteEntry = vi.fn();

  function mountTree(searchQuery?: string) {
    const props: Record<string, unknown> = {};
    if (searchQuery !== undefined) {
      props.searchQuery = searchQuery;
    }
    return mount(Tree, {
      props,
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });
  }

  beforeEach(() => {
    hotkeyCallbacks.clear();
    vi.clearAllMocks();

    mockSelectedPath.value = null;
    mockVisibleNodes.value = [];

    vi.mocked(useTreeState).mockReturnValue({
      visibleNodes: mockVisibleNodes as any,
      focusedPath: mockFocusedPath,
      selectedPath: mockSelectedPath,
      toggleDir: mockToggleDir,
      toggleSelect: mockToggleSelect,
      focusNext: mockFocusNext,
      focusPrev: mockFocusPrev,
      focusSelect: mockFocusSelect,
      arrowRight: mockArrowRight,
      arrowLeft: mockArrowLeft,
    } as any);

    vi.mocked(useClipboardBuffer).mockReturnValue({
      buffer: mockBuffer as any,
      copyEntry: mockCopyEntry,
      cutEntry: mockCutEntry,
      pasteEntry: mockPasteEntry,
    } as any);
  });

  describe("hotkeys", () => {
    it("F2 opens rename dialog for selected node", async () => {
      mockSelectedPath.value = "Email/work";
      const wrapper = mountTree();
      await wrapper.vm.$nextTick();

      const cb = hotkeyCallbacks.get("F2");
      expect(cb).toBeDefined();
      cb?.();
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as any;
      expect(vm.isRenameOpen).toBe(true);
      expect(vm.renamePath).toBe("Email/work");
    });

    it("Delete opens delete dialog for selected node", async () => {
      mockSelectedPath.value = "Email/work";
      const wrapper = mountTree();
      await wrapper.vm.$nextTick();

      const cb = hotkeyCallbacks.get("Delete");
      expect(cb).toBeDefined();
      cb?.();
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as any;
      expect(vm.isDeleteOpen).toBe(true);
      expect(vm.deletePath).toBe("Email/work");
    });

    it("ArrowDown triggers focusNext", () => {
      mountTree();
      hotkeyCallbacks.get("ArrowDown")?.();
      expect(mockFocusNext).toHaveBeenCalledOnce();
    });

    it("ArrowUp triggers focusPrev", () => {
      mountTree();
      hotkeyCallbacks.get("ArrowUp")?.();
      expect(mockFocusPrev).toHaveBeenCalledOnce();
    });

    it("ArrowRight triggers arrowRight", () => {
      mountTree();
      hotkeyCallbacks.get("ArrowRight")?.();
      expect(mockArrowRight).toHaveBeenCalledOnce();
    });

    it("ArrowLeft triggers arrowLeft", () => {
      mountTree();
      hotkeyCallbacks.get("ArrowLeft")?.();
      expect(mockArrowLeft).toHaveBeenCalledOnce();
    });
  });

  describe("clipboard buffer checks", () => {
    it("isCutDimmed returns true when path matches cut buffer", () => {
      const wrapper = mountTree();
      const vm = wrapper.vm as any;

      mockBuffer.value = { mode: "cut", path: "Email/work" };

      expect(vm.isCutDimmed("Email/work")).toBe(true);
      expect(vm.isCutDimmed("Other/path")).toBe(false);
    });

    it("hasCopyBuffer returns true when path matches any buffer", () => {
      const wrapper = mountTree();
      const vm = wrapper.vm as any;

      mockBuffer.value = { mode: "copy", path: "Email/work" };

      expect(vm.hasCopyBuffer("Email/work")).toBe(true);
    });
  });

  describe("search", () => {
    it("isSearchMatch matches substring case-insensitively", () => {
      const wrapper = mountTree("email");
      const vm = wrapper.vm as any;

      expect(vm.isSearchMatch("Email/work")).toBe(true);
      expect(vm.isSearchMatch("Social/facebook")).toBe(false);
    });
  });

  describe("utility functions", () => {
    it("nodeName extracts final path segment and dirPath extracts parent", () => {
      const wrapper = mountTree();
      const vm = wrapper.vm as any;

      expect(vm.nodeName("a/b/c")).toBe("c");
      expect(vm.dirPath("a/b/c")).toBe("a/b");
      expect(vm.dirPath("root")).toBe("");
    });
  });
});
