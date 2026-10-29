"use client"

import * as React from "react"
import { cn } from "cn"

// Same as the landing's small uppercase labels ("Заметки" in the contact card)
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1 font-mono text-xs leading-none font-medium tracking-wider text-muted-foreground uppercase select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
