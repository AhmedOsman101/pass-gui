import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MoveOrDuplicateDialog from "@/components/MoveOrDuplicateDialog.vue";
import { useEntryTreeStore } from "@/stores/entry-tree";

const stubs = {
  Dialog: { template: "<div><slot /></div>" },
  DialogContent: { template: "<div><slot /></div>" },
  DialogHeader: { template: "<div><slot /></div>" },
  DialogFooter: { template: "<div><slot /></div>" },
  DialogDescription: true,
  DialogTitle: true,
  DialogTrigger: { template: "<div><slot /></div>" },
  DirectoryTree: true,
};

const initialState = { "entry-tree": { tree: [] } };

describe("MoveOrDuplicateDialog", () => {
  it("dialogTitle shows correct title per mode", () => {
    const wrapperMove = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "move" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    expect((wrapperMove.vm as any).dialogTitle).toBe("Move Entry");

    const wrapperDup = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "duplicate" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    expect((wrapperDup.vm as any).dialogTitle).toBe("Duplicate Entry");
  });

  it("actionVerb/submitLabel/submittingLabel per mode", () => {
    const wrapperMove = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "move" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vmMove = wrapperMove.vm as any;
    expect(vmMove.actionVerb).toBe("Move");
    expect(vmMove.submitLabel).toBe("Move");
    expect(vmMove.submittingLabel).toBe("Moving...");

    const wrapperDup = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "duplicate" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vmDup = wrapperDup.vm as any;
    expect(vmDup.actionVerb).toBe("Copy");
    expect(vmDup.submitLabel).toBe("Duplicate");
    expect(vmDup.submittingLabel).toBe("Copying...");
  });

  it("buildFullDestination with selectedFolder", () => {
    const wrapper = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "move" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    vm.selectedFolder = "Email";
    vm.newPath = "work";
    expect(vm.buildFullDestination()).toBe("Email/work");
  });

  it("handleSubmit: empty name shows error", async () => {
    const wrapper = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "move" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    await vm.handleSubmit();
    expect(vm.formError).toBe("Name is required");
  });

  it("handleSubmit: same path guard", async () => {
    const wrapper = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "move" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    vm.selectedFolder = "Email";
    vm.newPath = "work";
    await vm.handleSubmit();
    expect(vm.formError).toContain("same as current path");
  });

  it("handleSubmit: move mode calls treeStore.moveEntry", async () => {
    const wrapper = mount(MoveOrDuplicateDialog, {
      props: { currentPath: "Email/work", mode: "move" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    vi.mocked(treeStore.moveEntry).mockResolvedValue(null);
    vm.newPath = "newfolder";
    await vm.handleSubmit();
    expect(treeStore.moveEntry).toHaveBeenCalledWith("Email/work", "newfolder");
  });
});
