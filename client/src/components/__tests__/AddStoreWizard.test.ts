import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddStoreWizard from "@/components/settings/AddStoreWizard.vue";
import { Config } from "@/services/config";
import { Fs } from "@/services/filesystem";
import { Gpg } from "@/services/gpg";
import { Pass } from "@/services/pass";
import { StoreValidation } from "@/services/store-validation";
import { Ok, Err } from "lib-result";

vi.mock("@/services/gpg", () => ({
  Gpg: { listSecretKeys: vi.fn() },
}));
vi.mock("@/services/pass", () => ({
  Pass: { setStorePath: vi.fn(), exec: vi.fn() },
}));
vi.mock("@/services/config", () => ({
  Config: { load: vi.fn(), save: vi.fn() },
}));
vi.mock("@/services/filesystem", () => ({
  Fs: { mkdir: vi.fn() },
}));
vi.mock("@/services/dialog", () => ({
  Dialog: { showFolderDialog: vi.fn() },
}));
vi.mock("@/services/store-validation", () => ({
  StoreValidation: { validate: vi.fn() },
}));

function flushPromises() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

const stubs = {
  Dialog: { template: "<div><slot /></div>" },
  DialogContent: { template: "<div><slot /></div>" },
  DialogHeader: { template: "<div><slot /></div>" },
  DialogFooter: { template: "<div><slot /></div>" },
  DialogDescription: true,
  DialogTitle: true,
  Select: { template: "<div><slot /></div>" },
  SelectTrigger: { template: "<button><slot /></button>" },
  SelectContent: { template: "<div><slot /></div>" },
  SelectGroup: { template: "<div><slot /></div>" },
  SelectItem: { template: "<div><slot :value /></div>" },
  SelectValue: { template: "<span><slot /></span>" },
};

const testKey = {
  keyId: "ABC123DEF456",
  userId: "test@test.com",
  userIds: ["test@test.com"],
  algorithm: "RSA",
  creationDate: "2024-01-01",
  expirationDate: null,
};

function mountWizard(props: Record<string, unknown> = {}) {
  return mount(AddStoreWizard, {
    props: {
      stores: {},
      activeStore: "default",
      open: true,
      ...props,
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs,
    },
  });
}

describe("AddStoreWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("name validation: empty name blocks advance", () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    expect(vm.canAdvanceName).toBe(false);
  });

  it("name validation: duplicate name error", () => {
    const wrapper = mountWizard({ stores: { existing: { path: "/a" } } });
    const vm = wrapper.vm as any;

    vm.storeName = "existing";

    expect(vm.nameError).toContain("already exists");
  });

  it("name validation: invalid characters", () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.storeName = "bad name!";

    expect(vm.nameError).toContain(
      "letters, numbers, hyphens, and underscores",
    );
  });

  it("path validation: duplicate path error", async () => {
    const wrapper = mountWizard({
      stores: { existing: { path: "/a" } },
    });
    const vm = wrapper.vm as any;

    vm.storeName = "valid-name";
    await vm.advanceStep();
    expect(vm.step).toBe("path");

    vm.storePath = "/a";

    expect(vm.pathError).toContain("already exists");
  });

  it("step advancement: name→path→gpg when guards pass", async () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.storeName = "valid-name";
    await vm.advanceStep();
    expect(vm.step).toBe("path");

    vm.storePath = "/valid/path";
    vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([testKey]));
    vi.mocked(StoreValidation.validate).mockResolvedValue(
      Ok({ exists: false, initialized: false }),
    );
    await vm.advanceStep();
    expect(vm.step).toBe("gpg");
  });

  it("step back: goBack moves gpg→path→name", async () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.step = "gpg";
    await wrapper.vm.$nextTick();

    vm.goBack();
    expect(vm.step).toBe("path");

    vm.goBack();
    expect(vm.step).toBe("name");
  });

  it("createStore full flow: mkdir → pass init → config save → emit", async () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.storeName = "test-store";
    vm.storePath = "/tmp/test-store";
    vm.selectedKeyId = "ABC123";
    vm.isExistingStore = false;

    vi.mocked(Fs.mkdir).mockResolvedValue(Ok(undefined as any));
    vi.mocked(Pass.exec).mockResolvedValue(Ok({} as any));
    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: { stores: {} },
        _raw: { stores: {} },
      } as any),
    );
    vi.mocked(Config.save).mockResolvedValue(Ok(undefined as any));

    await vm.createStore();
    await flushPromises();

    expect(Fs.mkdir).toHaveBeenCalledWith("/tmp/test-store");
    expect(Pass.exec).toHaveBeenCalledWith(["init", "ABC123"]);
    expect(Config.save).toHaveBeenCalled();
    expect(wrapper.emitted("created")?.[0]).toEqual([
      { name: "test-store", path: "/tmp/test-store" },
    ]);
  });

  it("createStore with existing store: skips mkdir and pass init", async () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.storeName = "existing-store";
    vm.storePath = "/tmp/existing";
    vm.selectedKeyId = "ABC123";
    vm.isExistingStore = true;

    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: { stores: {} },
        _raw: { stores: {} },
      } as any),
    );
    vi.mocked(Config.save).mockResolvedValue(Ok(undefined as any));

    await vm.createStore();
    await flushPromises();

    expect(Fs.mkdir).not.toHaveBeenCalled();
    expect(Pass.exec).not.toHaveBeenCalled();
    expect(wrapper.emitted("created")?.[0]).toEqual([
      { name: "existing-store", path: "/tmp/existing" },
    ]);
  });

  it("createStore error handling: mkdir failure", async () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.storeName = "test-store";
    vm.storePath = "/tmp/test-store";
    vm.selectedKeyId = "ABC123";
    vm.isExistingStore = false;

    vi.mocked(Fs.mkdir).mockResolvedValue(Err(Error("permission denied")));

    await vm.createStore();
    await flushPromises();

    expect(vm.creationError).toContain("Failed to create directory");
    expect(vm.step).toBe("gpg");
  });

  it("createStore error handling: pass init failure", async () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.storeName = "test-store";
    vm.storePath = "/tmp/test-store";
    vm.selectedKeyId = "ABC123";
    vm.isExistingStore = false;

    vi.mocked(Fs.mkdir).mockResolvedValue(Ok(undefined as any));
    vi.mocked(Pass.exec).mockResolvedValue(Err(Error("gpg failed")));

    await vm.createStore();
    await flushPromises();

    expect(vm.creationError).toContain("pass init failed");
  });

  it("GPG key loading on dialog open", async () => {
    vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([testKey]));

    const wrapper = mountWizard({ open: false });
    const vm = wrapper.vm as any;

    expect(Gpg.listSecretKeys).not.toHaveBeenCalled();

    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(Gpg.listSecretKeys).toHaveBeenCalled();
    expect(vm.secretKeys).toEqual([testKey]);
  });

  it("wizard reset", () => {
    const wrapper = mountWizard();
    const vm = wrapper.vm as any;

    vm.step = "gpg";
    vm.storeName = "test";
    vm.storePath = "/test";
    vm.selectedKeyId = "ABC123";
    vm.creationError = "some error";
    vm.isExistingStore = true;

    vm.resetWizard();

    expect(vm.step).toBe("name");
    expect(vm.storeName).toBe("");
    expect(vm.storePath).toBe("");
    expect(vm.selectedKeyId).toBe("");
    expect(vm.creationError).toBe("");
    expect(vm.isExistingStore).toBe(false);
  });
});
