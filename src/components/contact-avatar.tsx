import { cn } from "cn";

import { getInitials } from "@/lib/format";

// The three landing threads; the lavender one is the landing's contact card avatar
const PALETTE = [
  "border-thread-olive bg-thread-olive/15 text-foreground",
  "border-thread-peach bg-thread-peach/15 text-foreground",
  "border-thread-lavender bg-avatar text-avatar-foreground",
] as const;

export function ContactAvatar({
  id,
  name,
  size = "md",
}: {
  id: number;
  name: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 font-mono font-bold select-none",
        PALETTE[id % PALETTE.length],
        size === "lg" ? "size-14 text-base sm:size-15 sm:text-lg" : "size-10 text-sm",
      )}
    >
      {getInitials(name)}
    </span>
  );
}
