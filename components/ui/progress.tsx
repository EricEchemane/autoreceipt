import * as React from "react"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number
}) {
  return (
    <div
      data-slot="progress"
      className={cn(
        "bg-muted relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <div
        className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export { Progress }
