import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";

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

describe("RenameEntryDialog", () => {
  it("currentName extracts last path segment", () => {
    const wrapper = mount(RenameEntryDialog, {
      props: { currentPath: "Email/work" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    expect(vm.currentName).toBe("work");
  });

  it("parentDir extracts parent path", () => {
    const wrapper = mount(RenameEntryDialog, {
      props: { currentPath: "Email/work" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    expect(vm.parentDir).toBe("Email");
  });

  it("parentDir returns empty for top-level entry", () => {
    const wrapper = mount(RenameEntryDialog, {
      props: { currentPath: "root" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    expect(vm.parentDir).toBe("");
  });

  it("buildNewPath with parent path", () => {
    const wrapper = mount(RenameEntryDialog, {
      props: { currentPath: "Email/work" },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    vm.newName = "personal";
    expect(vm.buildNewPath()).toBe("Email/personal");
  });

  it("handleSubmit: empty name shows error", async () => {
    const wrapper = mount(RenameEntryDialog, {
      props: { currentPath: "Email/work", open: true },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    vm.newName = "";
    await vm.handleSubmit();
    expect(vm.formError).toBe("Name is required");
  });

  it("handleSubmit: same name shows same-name error", async () => {
    const wrapper = mount(RenameEntryDialog, {
      props: { currentPath: "Email/work", open: true },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
        stubs,
      },
    });
    const vm = wrapper.vm as any;
    await vm.handleSubmit();
    expect(vm.formError).toContain("same as current name");
  });
});
