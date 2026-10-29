import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ContactList } from "@/components/contact-list";
import {
  ContactSearch,
  ContactSearchFallback,
} from "@/components/contact-search";
import { FlashToast } from "@/components/flash-toast";
import { buttonVariants } from "@/components/ui/button";
import { listContacts, parseContactId } from "@/lib/contacts";
import { pluralize } from "@/lib/format";

// The layout's title template skips its own segment, so the name is spelled out
export const metadata: Metadata = {
  title: "Контакты — Узелок",
};

const CONTACT_WORDS = ["контакт", "контакта", "контактов"] as const;

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="grid gap-5">
      {/* Phones: the button goes full width under the heading, as on the landing */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-display font-medium">Контакты</h1>
        <Link
          href="/contacts/new"
          className={buttonVariants({ size: "lg" })}
        >
          <PlusIcon aria-hidden />
          Добавить контакт
        </Link>
      </div>

      <Suspense fallback={<ContactSearchFallback />}>
        <ContactSearch />
      </Suspense>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactListSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ContactListSection({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const addedId = parseContactId(firstParam(params.added));

  const items = await listContacts(query);
  const added = addedId ? items.find((item) => item.id === addedId) : undefined;

  return (
    <section aria-label="Список контактов" className="grid gap-3">
      <p
        className="font-mono text-xs font-medium tracking-wider text-subtle-foreground uppercase"
        aria-live="polite"
      >
        {query
          ? `Найдено: ${items.length}`
          : `Всего ${items.length} ${pluralize(items.length, CONTACT_WORDS)}`}
      </p>

      {items.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <ContactList contacts={items} highlightedId={added?.id ?? null} />
      )}

      {added ? (
        <FlashToast
          message={`Контакт «${added.name}» добавлен`}
          param="added"
          scrollToId={`contact-${added.id}`}
        />
      ) : null}
    </section>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="rounded-sm border border-border-strong bg-card px-6 py-12 text-center">
      {query ? (
        <>
          <p className="font-display text-title font-semibold break-words">
            Никого не нашли по запросу «{query}»
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Проверьте написание или поищите по части имени.
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-title font-semibold">
            Пока нет ни одного контакта
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Добавьте первого человека — нажмите «Добавить контакт».
          </p>
        </>
      )}
    </div>
  );
}

function ContactListSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Загружаем контакты">
      <div className="h-4 w-40 animate-pulse rounded-xs bg-muted" />
      <div className="divide-y divide-border-strong overflow-hidden rounded-sm border border-border-strong bg-card">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
            <div className="size-10 animate-pulse rounded-full bg-muted" />
            <div className="grid flex-1 gap-2">
              <div className="h-5 w-40 animate-pulse rounded-xs bg-muted" />
              <div className="h-3 w-56 animate-pulse rounded-xs bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
