import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { useEntryTreeStore } from "@/stores/entry-tree";
import { useEntryFormStore } from "@/stores/entry-form";
import EntryForm from "@/components/EntryForm.vue";

function flushPromises() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("EntryForm", () => {
  function mountForm(
    initialState: Record<string, Record<string, unknown>> = {},
  ) {
    return mount(EntryForm, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              "entry-form": {
                formMode: "create",
                formPath: null,
                formPresetPassword: null,
                ...((initialState["entry-form"] as Record<string, unknown>) ??
                  {}),
              },
              "entry-tree": {
                currentEntry: null,
                ...((initialState["entry-tree"] as Record<string, unknown>) ??
                  {}),
              },
            },
          }),
        ],
      },
    });
  }

  it("handleSubmit: empty path shows error", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    vm.secret = "test-password";

    await wrapper.find("form").trigger("submit");

    expect(wrapper.text()).toContain("Path is required");
  });

  it("handleSubmit: empty secret shows error", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    vm.path = "test/path";
    vm.secret = "";

    await wrapper.find("form").trigger("submit");

    expect(wrapper.text()).toContain("Password is required");
  });

  it("handleSubmit: duplicate metadata keys shows error with key names", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    vm.secret = "test-password";
    vm.path = "test/path";
    vm.metadata.push({ key: "url", value: "example.com" });
    vm.metadata.push({ key: "url", value: "other.com" });

    await wrapper.find("form").trigger("submit");

    expect(wrapper.text()).toContain("Duplicate metadata keys");
    expect(wrapper.text()).toContain("url");
  });

  it("handleSubmit: success in create mode calls treeStore.insertEntry", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    const formStore = useEntryFormStore();
    vm.secret = "test-password";
    vm.path = "test/path";

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(treeStore.insertEntry).toHaveBeenCalledWith(
      "test/path",
      "test-password",
    );
    expect(formStore.closeForm).toHaveBeenCalled();
  });

  it("handleSubmit: success in edit mode calls treeStore.editEntry", async () => {
    const wrapper = mountForm({
      "entry-form": { formMode: "edit" },
      "entry-tree": {
        currentEntry: {
          path: "existing/path",
          secret: "old-pass",
          metadata: {},
        },
      },
    });
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    const formStore = useEntryFormStore();
    vm.secret = "new-password";

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(treeStore.editEntry).toHaveBeenCalledWith(
      "existing/path",
      "new-password",
    );
    expect(formStore.closeForm).toHaveBeenCalled();
  });

  it("handleSubmit: error from store displays error string", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    vm.secret = "test-password";
    vm.path = "test/path";
    vi.mocked(treeStore.insertEntry).mockResolvedValue("Some error occurred");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Some error occurred");
  });

  it("buildContent: secret only (no metadata) produces correct content", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    vm.secret = "my-secret";
    vm.path = "test/path";

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(treeStore.insertEntry).toHaveBeenCalledWith(
      "test/path",
      "my-secret",
    );
  });

  it("buildContent: secret with metadata produces correct content", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    const treeStore = useEntryTreeStore();
    vm.secret = "my-secret";
    vm.path = "test/path";
    vm.metadata.push({ key: "url", value: "example.com" });

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(treeStore.insertEntry).toHaveBeenCalledWith(
      "test/path",
      "my-secret\nurl: example.com",
    );
  });

  it("secret visibility toggle", async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;
    vm.secret = "test-password";

    expect(vm.isSecretVisible).toBe(true);

    const buttons = wrapper.findAll("button");
    const toggleBtn = buttons.filter(
      (b) => b.attributes("type") === "button" && b.text().trim() === "",
    )[0]!;
    await toggleBtn.trigger("click");

    expect(vm.isSecretVisible).toBe(false);

    await toggleBtn.trigger("click");

    expect(vm.isSecretVisible).toBe(true);
  });

  it("duplicateKeys computed detects duplicates", () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as any;

    expect(vm.hasDuplicateKeys).toBe(false);

    vm.metadata.push({ key: "url", value: "example.com" });
    vm.metadata.push({ key: "url", value: "other.com" });

    expect(vm.hasDuplicateKeys).toBe(true);
    expect([...vm.duplicateKeys]).toEqual(["url"]);

    vm.removeMetadata(1);

    expect(vm.hasDuplicateKeys).toBe(false);
  });
});
