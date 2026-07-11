import { defineStore } from "pinia";
import { computed, ref } from "vue";

type FormMode = "create" | "edit";

/**
 * Manages the entry create/edit form state.
 *
 * This store owns only the form's mode, target path, and optional
 * preset password. The actual CRUD operations are owned by the
 * tree store (`useEntryTreeStore`).
 */
const useEntryFormStore = defineStore("entry-form", () => {
  const formMode = ref<FormMode | null>(null);
  const formPath = ref<string | null>(null);
  const formPresetPassword = ref<string | null>(null);

  const isFormOpen = computed(() => formMode.value !== null);

  function openCreateForm(presetPassword?: string): void {
    formMode.value = "create";
    formPath.value = null;
    formPresetPassword.value = presetPassword ?? null;
  }

  function openEditForm(path: string): void {
    formMode.value = "edit";
    formPath.value = path;
    formPresetPassword.value = null;
  }

  function closeForm(): void {
    formMode.value = null;
    formPath.value = null;
    formPresetPassword.value = null;
  }

  return {
    formMode,
    formPath,
    formPresetPassword,
    isFormOpen,
    openCreateForm,
    openEditForm,
    closeForm,
  };
});

export { useEntryFormStore };
