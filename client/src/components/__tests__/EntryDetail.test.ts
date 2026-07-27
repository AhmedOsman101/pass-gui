import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import EntryDetail from "@/components/EntryDetail.vue";
import { useClipboardStore } from "@/stores/clipboard";
import { useEntryFormStore } from "@/stores/entry-form";
import { useEntryTreeStore } from "@/stores/entry-tree";

vi.mock("sonner", () => ({ toast: vi.fn() }));

const defaultEntry = {
  path: "Email/work",
  secret: "supersecret123",
  metadata: { username: "user@example.com", URL: "https://example.com" },
  other: ["note line 1"],
  raw: "",
};

const stubs = {
  EntryForm: true,
  DeleteConfirmDialog: true,
  RenameEntryDialog: true,
  MoveOrDuplicateDialog: { template: "<div><slot /></div>" },
  PasswordGenerator: true,
};

function mountEntryDetail(
  overrides: Record<string, Record<string, unknown>> = {}
) {
  const entryTreeOverrides = (overrides["entry-tree"] ?? {}) as Record<
    string,
    unknown
  >;
  const clipboardOverrides = (overrides.clipboard ?? {}) as Record<
    string,
    unknown
  >;
  const entryFormOverrides = (overrides["entry-form"] ?? {}) as Record<
    string,
    unknown
  >;

  return mount(EntryDetail, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            "entry-tree": {
              currentEntry: defaultEntry,
              currentPath: "Email/work",
              tree: [],
              ...entryTreeOverrides,
            },
            clipboard: {
              ...clipboardOverrides,
            },
            "entry-form": {
              ...entryFormOverrides,
            },
          },
        }),
      ],
      stubs,
    },
  });
}

describe("EntryDetail", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggleSecret flips isSecretVisible", () => {
    const wrapper = mountEntryDetail();
    const vm = wrapper.vm as any;

    expect(vm.isSecretVisible).toBe(false);

    vm.toggleSecret();
    expect(vm.isSecretVisible).toBe(true);

    vm.toggleSecret();
    expect(vm.isSecretVisible).toBe(false);
  });

  it("copySecret calls clipboard.copy with entry secret and path", async () => {
    const wrapper = mountEntryDetail();
    const clipboardStore = useClipboardStore();
    vi.mocked(clipboardStore.copy).mockResolvedValue({
      timerSeconds: 5,
    } as any);

    await (wrapper.vm as any).copySecret();

    expect(clipboardStore.copy).toHaveBeenCalledWith(
      "supersecret123",
      "Email/work"
    );
  });

  it("copies metadata with its field label", async () => {
    const wrapper = mountEntryDetail();
    const clipboardStore = useClipboardStore();
    vi.mocked(clipboardStore.copy).mockResolvedValue({
      timerSeconds: 5,
    } as any);

    await wrapper.get('button[aria-label="Copy Username"]').trigger("click");

    expect(clipboardStore.copy).toHaveBeenCalledWith(
      "user@example.com",
      "Email/work"
    );
    expect(toast).toHaveBeenCalledWith(
      "Username copied",
      expect.objectContaining({ description: "Clears in 5s" })
    );
  });

  it("Skeleton: showSkeleton false immediately, becomes true after 500ms if entry not loaded", async () => {
    vi.useFakeTimers();
    const wrapper = mountEntryDetail({
      "entry-tree": { currentEntry: null, currentPath: null },
    });
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();

    expect(vm.showSkeleton).toBe(false);

    treeStore.currentPath = "Email/work";
    await wrapper.vm.$nextTick();

    expect(vm.showSkeleton).toBe(false);

    vi.advanceTimersByTime(500);

    expect(vm.showSkeleton).toBe(true);
  });

  it("Skeleton: cleared when currentEntry arrives matching currentPath", async () => {
    vi.useFakeTimers();
    const wrapper = mountEntryDetail({
      "entry-tree": { currentEntry: null, currentPath: null },
    });
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();

    treeStore.currentPath = "Email/work";
    await wrapper.vm.$nextTick();
    vi.advanceTimersByTime(500);
    expect(vm.showSkeleton).toBe(true);

    treeStore.currentEntry = {
      path: "Email/work",
      secret: "test",
      metadata: {},
      other: [],
      raw: "",
    };
    await wrapper.vm.$nextTick();

    expect(vm.showSkeleton).toBe(false);
  });

  it("getLabel: friendly name mapping", () => {
    const wrapper = mountEntryDetail();
    const vm = wrapper.vm as any;

    expect(vm.getLabel("username")).toBe("Username");
    expect(vm.getLabel("URL")).toBe("Website");
    expect(vm.getLabel("unknown")).toBe("unknown");
  });

  it("metadataEntries produces entries from entry.metadata", () => {
    const wrapper = mountEntryDetail();
    const vm = wrapper.vm as any;

    expect(vm.metadataEntries).toEqual([
      ["username", "user@example.com"],
      ["URL", "https://example.com"],
    ]);
  });

  it("Entry form shown when formStore.isFormOpen is true", async () => {
    const wrapper = mountEntryDetail();
    const formStore = useEntryFormStore();

    expect(formStore.isFormOpen).toBe(false);

    formStore.$patch({ formMode: "create" });
    await wrapper.vm.$nextTick();

    expect(formStore.isFormOpen).toBe(true);
    expect(wrapper.findComponent({ name: "EntryForm" }).exists()).toBe(true);
  });

  it("Empty state shown when no currentEntry", async () => {
    const wrapper = mountEntryDetail();
    const treeStore = useEntryTreeStore();

    expect(wrapper.text()).not.toContain("No entry selected");

    treeStore.currentEntry = null;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No entry selected");
  });

  it("Secret hidden by default (isSecretVisible starts false)", () => {
    const wrapper = mountEntryDetail();
    const vm = wrapper.vm as any;

    expect(vm.isSecretVisible).toBe(false);
    expect(wrapper.text()).toContain("••••••••••••••••");
  });

  it("labels compact secret controls and announces visibility changes", async () => {
    const wrapper = mountEntryDetail();

    const revealButton = wrapper.get('button[aria-label="Show password"]');
    expect(wrapper.get('[role="status"]').text()).toBe("Password hidden");

    await revealButton.trigger("click");

    wrapper.get('button[aria-label="Hide password"]');
    expect(wrapper.get('[role="status"]').text()).toBe("Password shown");
    wrapper.get('button[aria-label="Copy password"]');
    wrapper.get('button[aria-label="Copy Username"]');
    wrapper.get('button[aria-label="Close entry"]');
  });
});
