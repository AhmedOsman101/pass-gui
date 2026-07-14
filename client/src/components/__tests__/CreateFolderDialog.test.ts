import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CreateFolderDialog from "@/components/CreateFolderDialog.vue";
import { useEntryTreeStore } from "@/stores/entry-tree";

const stubs = {
  Dialog: { template: "<div><slot /></div>" },
  DialogContent: { template: "<div><slot /></div>" },
  DialogHeader: { template: "<div><slot /></div>" },
  DialogFooter: { template: "<div><slot /></div>" },
  DialogDescription: true,
  DialogTitle: true,
  DialogTrigger: { template: "<div><slot /></div>" },
};

const initialState = { "entry-tree": {} };

describe("CreateFolderDialog", () => {
  it("buildFullPath with parentPath", () => {
    const wrapper = mount(CreateFolderDialog, {
      props: { parentPath: "Email" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    vm.folderName = "work";
    expect(vm.buildFullPath()).toBe("Email/work");
  });

  it("buildFullPath without parentPath", () => {
    const wrapper = mount(CreateFolderDialog, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    vm.folderName = "root";
    expect(vm.buildFullPath()).toBe("root");
  });

  it("handleSubmit: empty name shows error", async () => {
    const wrapper = mount(CreateFolderDialog, {
      props: { open: true },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    await vm.handleSubmit();
    expect(vm.formError).toBe("Folder name is required");
  });

  it("handleSubmit: success calls treeStore.createFolder and emits close", async () => {
    const wrapper = mount(CreateFolderDialog, {
      props: { parentPath: "Email", open: true },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    vi.mocked(treeStore.createFolder).mockResolvedValue(null);
    vm.folderName = "newfolder";
    await vm.handleSubmit();
    expect(treeStore.createFolder).toHaveBeenCalledWith("Email/newfolder");
    expect(wrapper.emitted("update:open")).toBeTruthy();
    expect(wrapper.emitted("update:open")![0]).toEqual([false]);
  });

  it("handleSubmit: error from store", async () => {
    const wrapper = mount(CreateFolderDialog, {
      props: { parentPath: "Email", open: true },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    vi.mocked(treeStore.createFolder).mockResolvedValue("Something went wrong");
    vm.folderName = "newfolder";
    await vm.handleSubmit();
    expect(vm.formError).toBe("Something went wrong");
  });
});
