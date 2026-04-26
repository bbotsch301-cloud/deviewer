"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indeterminate?: boolean;
  }
>(({ className, value, indeterminate, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-1 w-full overflow-hidden rounded-full bg-muted",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full bg-primary transition-transform duration-300",
        indeterminate &&
          "absolute inset-y-0 w-1/3 animate-[shimmer_1.6s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-primary to-transparent",
      )}
      style={
        indeterminate
          ? undefined
          : { transform: `translateX(-${100 - (value ?? 0)}%)` }
      }
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
