import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-2 font-mono text-sm font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
