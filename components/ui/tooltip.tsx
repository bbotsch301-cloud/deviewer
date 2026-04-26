"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 flex items-center gap-2 overflow-hidden rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg shadow-black/30 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

/**
 * Wrap any element with a labelled tooltip + optional keyboard-shortcut hint
 * (Figma-style). `kbd` shows in dim small caps to the right of the label.
 */
export function Hint({
  label,
  kbd,
  side = "bottom",
  children,
}: {
  label: string;
  kbd?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <span>{label}</span>
        {kbd && (
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {kbd}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
