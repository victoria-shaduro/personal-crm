import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ContactList } from "@/components/contact-list";
import {
  ContactSearch,
  ContactSearchFallback,
} from "@/components/contact-search";
import { FlashToast } from "@/components/flash-toast";
import { KeepInTouchList } from "@/components/keep-in-touch-list";
import { buttonVariants } from "@/components/ui/button";
import { parseContactGroupFilter } from "@/lib/contact-list-filters";
import { listContacts, listKeepInTouchContacts, parseContactId } from "@/lib/contacts";
import { pluralize } from "@/lib/format";
import { listGroups } from "@/lib/groups";

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-display font-medium">Контакты</h1>
        <div className="flex flex-wrap gap-2 max-sm:[&>a]:grow">
          <Link href="/groups" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Группы
          </Link>
          <Link href="/contacts/new" className={buttonVariants({ size: "lg" })}>
            <PlusIcon aria-hidden />
            Добавить контакт
          </Link>
        </div>
      </div>

      <section aria-labelledby="keep-in-touch-heading" className="grid gap-4">
        <h2 id="keep-in-touch-heading" className="font-display text-title font-semibold">Пора связаться</h2>
        <Suspense fallback={<p aria-busy="true" className="text-sm text-muted-foreground">Загружаем запланированные контакты…</p>}>
          <KeepInTouchSection />
        </Suspense>
      </section>

      <Suspense fallback={<><ContactSearchFallback /><ContactListSkeleton /></>}>
        <ContactListSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function KeepInTouchSection() {
  await connection();
  const contacts = await listKeepInTouchContacts();
  return <KeepInTouchList contacts={contacts} />;
}

async function ContactListSection({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const groups = await listGroups();
  const query = firstParam(params.q).trim();
  const group = parseContactGroupFilter(firstParam(params.group), groups);
  const groupName = groups.find(({ id }) => id === group)?.name;
  const addedId = parseContactId(firstParam(params.added));

  const items = await listContacts(query, group);
  const added = addedId ? items.find((item) => item.id === addedId) : undefined;

  return (
    <>
      <ContactSearch groups={groups} />
      <section aria-label="Список контактов" className="grid gap-3">
        <p
          className="font-mono text-xs font-medium tracking-wider text-subtle-foreground uppercase"
          aria-live="polite"
        >
          {query || group !== null
            ? `Найдено: ${items.length}`
            : `Всего ${items.length} ${pluralize(items.length, CONTACT_WORDS)}`}
        </p>

        {items.length === 0 ? (
          <EmptyState query={query} groupName={groupName} ungrouped={group === "ungrouped"} />
        ) : (
          <ContactList contacts={items} highlightedId={added?.id ?? null} />
        )}

        {firstParam(params.deleted) === "1" ? (
          <FlashToast message="Контакт удалён" param="deleted" />
        ) : null}

        {added ? (
          <FlashToast
            message={`Контакт «${added.name}» добавлен`}
            param="added"
            scrollToId={`contact-${added.id}`}
          />
        ) : null}
      </section>
    </>
  );
}

function EmptyState({ query, groupName, ungrouped }: {
  query: string;
  groupName?: string;
  ungrouped: boolean;
}) {
  const filter = groupName ? `в группе «${groupName}»` : ungrouped ? "среди контактов без группы" : "";
  return (
    <div className="rounded-sm border border-border-strong bg-card px-6 py-12 text-center">
      {query ? (
        <>
          <p className="font-display text-title font-semibold wrap-anywhere">
            Никого не нашли {filter ? `${filter} ` : ""}по запросу «{query}»
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Проверьте написание или поищите по части имени.
          </p>
        </>
      ) : groupName || ungrouped ? (
        <p className="font-display text-title font-semibold wrap-anywhere">
          {groupName ? `В группе «${groupName}» пока нет контактов` : "Контактов без группы пока нет"}
        </p>
      ) : (
        <>
          <p className="font-display text-title font-semibold">
            Пока нет ни одного контакта
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Добавь первый контакт
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
