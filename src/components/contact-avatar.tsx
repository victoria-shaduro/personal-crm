import { cn } from "cn";

import { getInitials } from "@/lib/format";

const PALETTE = [
  "bg-rose-100 text-rose-800",
  "bg-amber-100 text-amber-800",
  "bg-lime-100 text-lime-800",
  "bg-emerald-100 text-emerald-800",
  "bg-cyan-100 text-cyan-800",
  "bg-sky-100 text-sky-800",
  "bg-indigo-100 text-indigo-800",
  "bg-violet-100 text-violet-800",
  "bg-fuchsia-100 text-fuchsia-800",
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
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none",
        PALETTE[id % PALETTE.length],
        size === "lg" ? "size-14 text-lg" : "size-9 text-sm",
      )}
    >
      {getInitials(name)}
    </span>
  );
}
