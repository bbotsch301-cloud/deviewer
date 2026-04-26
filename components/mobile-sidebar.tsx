"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";
import { useUIStore } from "@/lib/store/ui-store";

interface Props {
  onOpenAddRepo: () => void;
}

export function MobileSidebar({ onOpenAddRepo }: Props) {
  const open = useUIStore((s) => s.mobileSidebarOpen);
  const setOpen = useUIStore((s) => s.setMobileSidebarOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>Projects</SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-56px)]">
          <Sidebar onOpenAddRepo={onOpenAddRepo} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
