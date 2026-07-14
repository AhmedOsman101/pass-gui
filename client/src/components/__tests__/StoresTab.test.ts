import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import StoresTab from "@/components/settings/StoresTab.vue";
import type { AppConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";

const stubs = {
  Card: { template: "<div><slot /></div>" },
  CardHeader: { template: "<div><slot /></div>" },
  CardContent: { template: "<div><slot /></div>" },
  CardTitle: true,
  CardDescription: true,
  Select: { template: "<div><slot /></div>" },
  SelectTrigger: { template: "<button><slot /></button>" },
  SelectContent: { template: "<div><slot /></div>" },
  SelectGroup: { template: "<div><slot /></div>" },
  SelectItem: { template: "<div><slot /></div>" },
  SelectValue: { template: "<span><slot /></span>" },
  Badge: { template: "<span><slot /></span>" },
  Separator: { template: "<hr />" },
  Input: { template: "<input />" },
  AddStoreWizard: { template: "<div />" },
  StoreDeleteDialog: { template: "<div />" },
};

const baseConfig = {
  data: {},
  _raw: {},
} as unknown as ParsedToml<AppConfig>;

const baseStores: Record<string, { path: string }> = {
  work: { path: "/b/work" },
  default: { path: "/a/default" },
  personal: { path: "/c/personal" },
};

function mountStoresTab(props: Record<string, unknown> = {}) {
  return mount(StoresTab, {
    props: {
      stores: baseStores,
      activeStore: "work",
      isSaving: false,
      config: baseConfig,
      ...props,
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs,
    },
  });
}

function emittedStores(
  wrapper: ReturnType<typeof mountStoresTab>
): Record<string, any> {
  return wrapper.emitted("updateStores")![0]![0] as Record<string, any>;
}

describe("StoresTab", () => {
  it("storeEntries sorts active store first, then alphabetical", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    const entries = vm.storeEntries;
    expect(entries[0].name).toBe("work");
    expect(entries[1].name).toBe("default");
    expect(entries[2].name).toBe("personal");
  });

  it("isPathUnique: returns false when path exists under different name", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    expect(vm.isPathUnique("/a/default")).toBe(false);
  });

  it("isPathUnique: returns true when same name checks itself", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    expect(vm.isPathUnique("/a/default", "default")).toBe(true);
  });

  it("isPathUnique: returns true for unique path", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    expect(vm.isPathUnique("/new/path")).toBe(true);
  });

  it("saveEditStore: empty path guard (returns early without emit)", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    vm.editingStore = "work";
    vm.editStoreForm.path = "";
    vm.saveEditStore();

    expect(wrapper.emitted("save")).toBeFalsy();
  });

  it("saveEditStore: valid edit emits updateStores and save", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    vm.startEditStore("work");
    expect(vm.editingStore).toBe("work");
    expect(vm.editStoreForm.path).toBe("/b/work");

    vm.editStoreForm.path = "/new/work";
    vm.editStoreForm.gnupgHome = "/custom/gnupg";
    vm.saveEditStore();

    const emitted = emittedStores(wrapper);
    expect(emitted.work.path).toBe("/new/work");
    expect(emitted.work.gnupg_home).toBe("/custom/gnupg");
    expect(wrapper.emitted("save")).toBeTruthy();
  });

  it("saveEditStore: emits updateStores without gnupgHome when empty", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    vm.startEditStore("default");
    vm.editStoreForm.path = "/new/default";
    vm.saveEditStore();

    const emitted = emittedStores(wrapper);
    expect(emitted.default.path).toBe("/new/default");
    expect(emitted.default.gnupg_home).toBeUndefined();
    expect(wrapper.emitted("save")).toBeTruthy();
  });

  it("confirmDeleteStore removes store and emits save", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    vm.confirmDeleteStore("personal");

    const emitted = emittedStores(wrapper);
    expect(emitted.personal).toBeUndefined();
    expect(wrapper.emitted("save")).toBeTruthy();
  });

  it("findStoreByPath: finds store name from path", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    expect(vm.findStoreByPath("/a/default")).toBe("default");
    expect(vm.findStoreByPath("/nonexistent")).toBeUndefined();
  });

  it("promptDeleteStore sets delete target and opens dialog", () => {
    const wrapper = mountStoresTab();
    const vm = wrapper.vm as any;

    vm.promptDeleteStore("personal");

    expect(vm.deleteTarget).toEqual({
      name: "personal",
      path: "/c/personal",
    });
    expect(vm.deleteDialogOpen).toBe(true);
  });
});
