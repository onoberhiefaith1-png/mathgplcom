// SmartboardRoot — the DOM node that owns the 70% Smartboard pane.
// Chrome/portals published here so `position: fixed` / `createPortal` targets
// stay scoped to the resized Smartboard container and don't leak to the
// browser viewport when the Presenter Preview is open.

import { createContext, useContext } from "react";

export const SmartboardRootContext = createContext<HTMLElement | null>(null);

export const useSmartboardRoot = (): HTMLElement | null =>
  useContext(SmartboardRootContext);
