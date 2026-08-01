import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Sharp-cornered, hairline-bordered button. No radius, no shadow.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:bg-muted",
        ghost:   "bg-transparent text-ink hairline hover:bg-bone",
        danger:  "bg-transparent text-st-down border border-st-down/40 hover:bg-st-down-wash",
        text:    "bg-transparent text-ink hover:text-pulse underline-offset-4 hover:underline px-0",
      },
      size: {
        sm:   "h-8 px-3 text-xs",
        md:   "h-10 px-4",
        lg:   "h-12 px-6",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
