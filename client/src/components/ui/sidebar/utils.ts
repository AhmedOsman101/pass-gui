import { createContext } from "reka-ui";
import type { ComputedRef, Ref } from "vue";

/**
 * Sidebar component constants and context provider.
 * Defines dimensions, keyboard shortcuts, and shared state management.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "16rem";
export const SIDEBAR_WIDTH_MOBILE = "18rem";
export const SIDEBAR_WIDTH_ICON = "3rem";
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";

/**
 * Provides sidebar context for state management across sidebar components.
 * Exposes state (expanded/collapsed), mobile detection, and toggle functions.
 */
export const [useSidebar, provideSidebarContext] = createContext<{
  state: ComputedRef<"expanded" | "collapsed">;
  open: Ref<boolean>;
  setOpen: (value: boolean) => void;
  isMobile: Ref<boolean>;
  openMobile: Ref<boolean>;
  setOpenMobile: (value: boolean) => void;
  toggleSidebar: () => void;
}>("Sidebar");
