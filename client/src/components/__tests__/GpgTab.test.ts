import { mount } from "@vue/test-utils";
import { Err, Ok } from "lib-result";
import { afterEach, describe, expect, it, vi } from "vitest";
import GpgTab from "@/components/settings/GpgTab.vue";
import { Gpg } from "@/services/gpg";

vi.mock("@/services/gpg", () => ({
  Gpg: { listSecretKeys: vi.fn().mockResolvedValue(Ok([])) },
}));

function flushPromises() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

const testKey = {
  keyId: "ABC123DEF456",
  userId: "test@test.com",
  userIds: ["test@test.com"],
  algorithm: "RSA",
  creationDate: "2024-01-01",
  expirationDate: null,
};

const stubs = {
  Card: { template: "<div><slot /></div>" },
  CardHeader: { template: "<div><slot /></div>" },
  CardTitle: { template: "<div><slot /></div>" },
  CardDescription: { template: "<div><slot /></div>" },
  CardContent: { template: "<div><slot /></div>" },
  Label: { template: "<label><slot /></label>" },
  Input: { template: "<input />" },
  Button: { template: "<button><slot /></button>" },
  Separator: { template: "<hr />" },
  Select: { template: "<div><slot /></div>" },
  SelectContent: { template: "<div><slot /></div>" },
  SelectGroup: { template: "<div><slot /></div>" },
  SelectItem: { template: "<div><slot /></div>" },
  SelectTrigger: { template: "<button><slot /></button>" },
  SelectValue: { template: "<span><slot /></span>" },
  X: { template: "<span>X</span>" },
};

describe("GpgTab", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function mountGpgTab(props: Record<string, unknown> = {}) {
    const wrapper = mount(GpgTab, {
      props: {
        opts: [],
        signingKey: "",
        recipientKey: "",
        isSaving: false,
        ...props,
      },
      global: { stubs },
    });
    return { wrapper };
  }

  it("renders card with title and description labels", () => {
    const { wrapper } = mountGpgTab();
    expect(wrapper.text()).toContain("GPG");
    expect(wrapper.text()).toContain("GPG options passed to pass.");
    expect(wrapper.text()).toContain("Extra GPG Options");
    expect(wrapper.text()).toContain("Signing Key");
    expect(wrapper.text()).toContain("Recipient Key");
  });

  it("loads secret keys from Gpg.listSecretKeys on mount", async () => {
    vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([testKey]));
    const { wrapper } = mountGpgTab();
    await flushPromises();
    expect(Gpg.listSecretKeys).toHaveBeenCalledTimes(1);
    const vm = wrapper.vm as any;
    expect(vm.secretKeys).toEqual([testKey]);
  });

  it("displays error when Gpg.listSecretKeys fails", async () => {
    vi.mocked(Gpg.listSecretKeys).mockResolvedValue(
      Err(Error("gpg not found"))
    );
    const { wrapper } = mountGpgTab();
    await flushPromises();
    const vm = wrapper.vm as any;
    expect(vm.secretKeysError).toBe("gpg not found");
  });

  it("adds single and comma-separated tags to opts", () => {
    const { wrapper } = mountGpgTab();
    const vm = wrapper.vm as any;

    vm.tagInput = "test-tag";
    vm.addTag();
    expect(wrapper.emitted("update:opts")![0]).toEqual([["test-tag"]]);

    wrapper.setProps({ opts: ["test-tag"] });
    vm.tagInput = "a,b,c";
    vm.addTag();
    expect(wrapper.emitted("update:opts")![1]).toEqual([
      ["test-tag", "a", "b", "c"],
    ]);
  });

  it("skips duplicates when adding tags", () => {
    const { wrapper } = mountGpgTab();
    const vm = wrapper.vm as any;

    vm.tagInput = "tag1";
    vm.addTag();
    expect(wrapper.emitted("update:opts")![0]).toEqual([["tag1"]]);

    wrapper.setProps({ opts: ["tag1"] });
    vm.tagInput = "tag1";
    vm.addTag();
    const emitted = wrapper.emitted("update:opts")!;
    expect(emitted.at(-1)).toEqual([["tag1"]]);

    wrapper.setProps({ opts: ["tag1"] });
    vm.tagInput = "tag2";
    vm.addTag();
    expect(wrapper.emitted("update:opts")![2]).toEqual([["tag1", "tag2"]]);
  });

  it("removes tag by index from opts", () => {
    const { wrapper } = mountGpgTab({ opts: ["a", "b", "c"] });
    const vm = wrapper.vm as any;
    vm.removeTag(1);
    expect(wrapper.emitted("update:opts")![0]).toEqual([["a", "c"]]);
  });

  it("edits tag in place with start, commit, and cancel", () => {
    const { wrapper } = mountGpgTab({ opts: ["original"] });
    const vm = wrapper.vm as any;

    vm.startEditTag(0);
    expect(vm.editingTagIndex).toBe(0);
    expect(vm.editingTagValue).toBe("original");

    vm.editingTagValue = "edited";
    vm.commitEditTag();
    expect(wrapper.emitted("update:opts")![0]).toEqual([["edited"]]);
    expect(vm.editingTagIndex).toBeNull();

    vm.startEditTag(0);
    vm.editingTagValue = "changed";
    vm.cancelEditTag();
    expect(vm.editingTagIndex).toBeNull();
  });

  it("handleSigningKeyChange switches between select and custom modes", () => {
    const { wrapper } = mountGpgTab({ signingKey: "existing-key" });
    const vm = wrapper.vm as any;

    expect(vm.signingKeyMode).toBe("select");

    vm.handleSigningKeyChange("__custom__");
    expect(vm.signingKeyMode).toBe("custom");
    expect(wrapper.emitted("update:signingKey")![0]).toEqual([""]);

    vm.handleSigningKeyChange(testKey.keyId);
    expect(vm.signingKeyMode).toBe("select");
    expect(wrapper.emitted("update:signingKey")![1]).toEqual([testKey.keyId]);

    vm.handleSigningKeyChange("__none__");
    expect(vm.signingKeyMode).toBe("select");
    expect(wrapper.emitted("update:signingKey")![2]).toEqual([""]);
  });

  it("handleRecipientKeyChange switches between select and custom modes", () => {
    const { wrapper } = mountGpgTab({ recipientKey: "existing-key" });
    const vm = wrapper.vm as any;

    expect(vm.recipientKeyMode).toBe("select");

    vm.handleRecipientKeyChange("__custom__");
    expect(vm.recipientKeyMode).toBe("custom");
    expect(wrapper.emitted("update:recipientKey")![0]).toEqual([""]);

    vm.handleRecipientKeyChange(testKey.keyId);
    expect(vm.recipientKeyMode).toBe("select");
    expect(wrapper.emitted("update:recipientKey")![1]).toEqual([testKey.keyId]);

    vm.handleRecipientKeyChange("__none__");
    expect(vm.recipientKeyMode).toBe("select");
    expect(wrapper.emitted("update:recipientKey")![2]).toEqual([""]);
  });

  it("keyboard interactions: Enter to add, Backspace to remove last", () => {
    const { wrapper } = mountGpgTab();
    const vm = wrapper.vm as any;
    const input = wrapper.find('input[placeholder="Type and press comma..."]');

    vm.tagInput = "k1";
    input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:opts")![0]).toEqual([["k1"]]);

    wrapper.setProps({ opts: ["k1"] });
    vm.tagInput = "";
    input.trigger("keydown", { key: "Backspace" });
    expect(wrapper.emitted("update:opts")![1]).toEqual([[]]);
  });

  it("keyboard comma triggers addTag", () => {
    const { wrapper } = mountGpgTab();
    const vm = wrapper.vm as any;
    const input = wrapper.find('input[placeholder="Type and press comma..."]');

    vm.tagInput = "comma-tag";
    input.trigger("keydown", { key: "," });
    expect(wrapper.emitted("update:opts")![0]).toEqual([["comma-tag"]]);
  });
});
