import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-linear-to-r from-primary to-primary/85 text-primary-foreground shadow-sm",
        secondary:
          "border-transparent bg-linear-to-r from-amber-500/20 to-orange-500/15 text-amber-800 shadow-sm dark:text-amber-200",
        outline:
          "border-border/80 bg-background/85 text-foreground shadow-[0_8px_20px_-18px_rgba(15,23,42,0.6)] backdrop-blur-sm",
        success:
          "border-transparent bg-linear-to-r from-emerald-500/20 to-teal-500/16 text-emerald-800 shadow-sm dark:text-emerald-200",
        warning:
          "border-transparent bg-linear-to-r from-amber-500/24 to-yellow-500/18 text-amber-800 shadow-sm dark:text-amber-200",
        destructive:
          "border-transparent bg-linear-to-r from-red-500/20 to-rose-500/16 text-red-800 shadow-sm dark:text-red-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
