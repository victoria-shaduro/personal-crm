import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function ContactNotFound() {
  return (
    <div className="rounded-sm border border-border-strong bg-card px-6 py-16 text-center">
      <h1 className="font-display text-title font-semibold">Контакт не найден</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Возможно, ссылка устарела или в ней опечатка.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        К списку контактов
      </Link>
    </div>
  );
}
