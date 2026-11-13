import { cn } from "cn";
import Link from "next/link";

import { MarkContactedButton } from "@/components/mark-contacted-button";
import type { KeepInTouchListItem } from "@/lib/contacts";
import { formatPlannedContactDate } from "@/lib/format";

export function KeepInTouchList({ contacts }: { contacts: KeepInTouchListItem[] }) {
  if (contacts.length === 0) {
    return <p className="rounded-sm border border-border-strong bg-card px-4 py-8 text-center text-sm text-muted-foreground">Пока нет запланированных контактов</p>;
  }
  return (
    <ul className="divide-y divide-border-strong rounded-sm border border-border-strong bg-card">
      {contacts.map((contact) => (
        <li key={contact.id} id={`keep-in-touch-${contact.id}`} className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <Link href={`/contacts/${contact.id}`} className={cn(
            "grid min-w-0 flex-1 gap-1 rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring",
            contact.overdue ? "text-thread-peach" : "text-mono-foreground",
          )}>
            <span className="font-display text-xl font-semibold break-words">{contact.name}</span>
            {contact.nextContactAt ? <time dateTime={contact.nextContactAt.toISOString()} className="font-mono text-xs">
              {formatPlannedContactDate(contact.nextContactAt)}
            </time> : null}
            <span className="sr-only">{contact.overdue ? "Пора связаться" : "Запланировано"}</span>
          </Link>
          <MarkContactedButton id={contact.id} name={contact.name} />
        </li>
      ))}
    </ul>
  );
}
