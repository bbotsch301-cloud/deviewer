"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/lib/store/ui-store";

const GROUPS: Array<{ label: string; items: Array<{ kbd: string; desc: string }> }> = [
  {
    label: "Navigation",
    items: [
      { kbd: "⌘ K", desc: "Open command palette" },
      { kbd: "⌘ B", desc: "Toggle sidebar" },
      { kbd: "⌘ /", desc: "Toggle AI panel" },
      { kbd: "⌘ ,", desc: "Open settings" },
    ],
  },
  {
    label: "Actions",
    items: [
      { kbd: "⌘ R", desc: "Re-run last build" },
      { kbd: "⌘ F", desc: "Find in terminal" },
      { kbd: "Esc", desc: "Close any open panel" },
    ],
  },
  {
    label: "Help",
    items: [
      { kbd: "?", desc: "Open this cheat sheet" },
    ],
  },
];

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move through deviewer at the speed of muscle memory.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <section key={g.label}>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li
                    key={it.desc}
                    className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-3 py-2 text-xs"
                  >
                    <span className="text-foreground">{it.desc}</span>
                    <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                      {it.kbd}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
