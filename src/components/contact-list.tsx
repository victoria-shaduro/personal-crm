"use client";

// Rendered as a Client Component on purpose: the browser receives only the
// contact data, not markup for every row, which keeps a 1000-row list light.
import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import type { ContactListItem } from "@/lib/contacts";
import { cn } from "cn";

export function ContactList({
  contacts,
  highlightedId,
}: {
  contacts: ContactListItem[];
  highlightedId: number | null;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-background">
      {contacts.map((contact) => (
        <ContactRow
          key={contact.id}
          contact={contact}
          highlighted={contact.id === highlightedId}
        />
      ))}
    </ul>
  );
}

function ContactRow({
  contact,
  highlighted,
}: {
  contact: ContactListItem;
  highlighted: boolean;
}) {
  return (
    <li id={`contact-${contact.id}`} className="scroll-mt-24">
      <Link
        href={`/contacts/${contact.id}`}
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
          highlighted && "bg-amber-50 hover:bg-amber-100/70",
        )}
      >
        <ContactAvatar id={contact.id} name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{contact.name}</span>
            {highlighted ? (
              <span className="shrink-0 rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-medium text-amber-900">
                новый
              </span>
            ) : null}
          </div>
          {contact.about ? (
            <div className="truncate text-sm text-muted-foreground">
              {contact.about}
            </div>
          ) : null}
        </div>
        <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
          {contact.phone ? <div>{contact.phone}</div> : null}
          {contact.email ? (
            <div className="max-w-56 truncate">{contact.email}</div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
