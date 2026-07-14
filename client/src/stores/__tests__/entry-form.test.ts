import { createTestingPinia } from "@pinia/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEntryFormStore } from "@/stores/entry-form";

describe("entry-form store", () => {
  beforeEach(() => {
    createTestingPinia({ stubActions: false, createSpy: vi.fn });
  });

  it("has null initial state", () => {
    const store = useEntryFormStore();
    expect(store.formMode).toBeNull();
    expect(store.formPath).toBeNull();
    expect(store.formPresetPassword).toBeNull();
  });

  it("isFormOpen is false initially", () => {
    const store = useEntryFormStore();
    expect(store.isFormOpen).toBe(false);
  });

  it("openCreateForm sets create mode", () => {
    const store = useEntryFormStore();
    store.openCreateForm();
    expect(store.formMode).toBe("create");
    expect(store.formPath).toBeNull();
    expect(store.formPresetPassword).toBeNull();
    expect(store.isFormOpen).toBe(true);
  });

  it("openCreateForm with presetPassword sets formPresetPassword", () => {
    const store = useEntryFormStore();
    store.openCreateForm("my-pass");
    expect(store.formMode).toBe("create");
    expect(store.formPresetPassword).toBe("my-pass");
  });

  it("openCreateForm clears formPath to null", () => {
    const store = useEntryFormStore();
    store.formPath = "some/old/path";
    store.openCreateForm();
    expect(store.formPath).toBeNull();
  });

  it("openEditForm sets edit mode with path", () => {
    const store = useEntryFormStore();
    store.openEditForm("Email/work");
    expect(store.formMode).toBe("edit");
    expect(store.formPath).toBe("Email/work");
    expect(store.formPresetPassword).toBeNull();
  });

  it("openEditForm resets formPresetPassword to null", () => {
    const store = useEntryFormStore();
    store.formPresetPassword = "old-pass";
    store.openEditForm("some/path");
    expect(store.formPresetPassword).toBeNull();
  });

  it("openEditForm sets isFormOpen to true", () => {
    const store = useEntryFormStore();
    store.openEditForm("any/path");
    expect(store.isFormOpen).toBe(true);
  });

  it("closeForm resets all state to null", () => {
    const store = useEntryFormStore();
    store.openEditForm("Email/work");
    store.closeForm();
    expect(store.formMode).toBeNull();
    expect(store.formPath).toBeNull();
    expect(store.formPresetPassword).toBeNull();
    expect(store.isFormOpen).toBe(false);
  });

  it("isFormOpen reflects formMode non-null", () => {
    const store = useEntryFormStore();
    expect(store.isFormOpen).toBe(false);
    store.formMode = "create";
    expect(store.isFormOpen).toBe(true);
    store.formMode = "edit";
    expect(store.isFormOpen).toBe(true);
    store.formMode = null;
    expect(store.isFormOpen).toBe(false);
  });
});
