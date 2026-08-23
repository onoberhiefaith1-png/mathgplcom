// ResponsivePanel — one mechanism for every side panel in the application.
//
// DESKTOP IS LOCKED: at desktop/tablet widths this renders `children` exactly
// where they already are, with no extra wrapper markup or styling. Only on
// phones (< 768px) does the same panel body move into a bottom sheet so it
// never permanently consumes phone screen width.

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export interface ResponsivePanelProps {
  /** Panel title shown in the phone sheet header. */
  title: string;
  /** Phone sheet visibility. Ignored on tablet/desktop. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The panel body — identical component and data on every device. */
  children: ReactNode;
  /** Height of the phone sheet; the workspace stays visible above it. */
  heightClass?: string;
}

/** True when side panels must move out of the layout into a bottom sheet. */
export function useSheetPanels(): boolean {
  return useBreakpoint() === "phone";
}

export function ResponsivePanel({
  title,
  open = false,
  onOpenChange,
  children,
  heightClass = "h-[68vh]",
}: ResponsivePanelProps) {
  const phone = useSheetPanels();

  if (!phone) return <>{children}</>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`${heightClass} rounded-t-2xl p-0 flex flex-col`}
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-left">
          <SheetTitle className="text-sm font-semibold">{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ResponsivePanel;
