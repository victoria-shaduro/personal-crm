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
    <ul className="divide-y divide-border-strong overflow-hidden rounded-sm border border-border-strong bg-card">
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
          "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none sm:gap-4 sm:px-5",
          highlighted && "bg-primary/10 hover:bg-primary/15",
        )}
      >
        <ContactAvatar id={contact.id} name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-xl leading-snug font-semibold">
              {contact.name}
            </span>
            {highlighted ? (
              <span className="shrink-0 rounded-xs bg-primary px-1.5 py-0.5 font-mono text-xs leading-none font-bold tracking-wide text-primary-foreground uppercase">
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
        <div className="hidden shrink-0 text-right font-mono text-xs leading-5 text-mono-foreground sm:block">
          {contact.phone ? <div>{contact.phone}</div> : null}
          {contact.email ? (
            <div className="max-w-56 truncate">{contact.email}</div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
