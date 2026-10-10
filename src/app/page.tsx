import { PlusIcon } from "lucide-react";
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
import { cn } from "cn";

const CONTACT_WORDS = ["контакт", "контакта", "контактов"] as const;

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
        <Link
          href="/contacts/new"
          className={cn(buttonVariants({ size: "lg" }), "px-3")}
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
      <p className="text-sm text-muted-foreground" aria-live="polite">
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
    <div className="rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      {query ? (
        <>
          <p className="font-medium">Никого не нашли по запросу «{query}»</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Проверьте написание или поищите по части имени.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">Пока нет ни одного контакта</p>
          <p className="mt-1 text-sm text-muted-foreground">
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
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="divide-y overflow-hidden rounded-xl border bg-background">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="size-9 animate-pulse rounded-full bg-muted" />
            <div className="grid flex-1 gap-2">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-56 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
