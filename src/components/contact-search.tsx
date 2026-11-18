"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { GroupOptions } from "@/components/group-options";
import { ThreadSearchIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { buildContactListUrl, parseContactGroupFilter } from "@/lib/contact-list-filters";
import type { GroupOption } from "@/lib/groups";

const SEARCH_DELAY_MS = 250;

export function ContactSearch({ groups }: { groups: GroupOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const urlGroup = parseContactGroupFilter(params.get("group"), groups);
  const currentUrl = buildContactListUrl(urlQuery, urlGroup);

  const [value, setValue] = useState(urlQuery);
  const [group, setGroup] = useState(urlGroup);
  const [requestedUrl, setRequestedUrl] = useState(currentUrl);
  const [seenUrl, setSeenUrl] = useState(currentUrl);
  const [isPending, startTransition] = useTransition();

  // The URL changed without us (e.g. a link to "/"): show what the URL says
  if (currentUrl !== seenUrl) {
    setSeenUrl(currentUrl);
    if (currentUrl !== requestedUrl) {
      setValue(urlQuery);
      setGroup(urlGroup);
      setRequestedUrl(currentUrl);
    }
  }

  // Search as the user types, after a short pause
  useEffect(() => {
    const url = buildContactListUrl(value, group);
    if (url === requestedUrl) return;

    const timeout = setTimeout(() => {
      setRequestedUrl(url);
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [value, group, requestedUrl, router]);

  function changeGroup(valueFromSelect: string) {
    const nextGroup = parseContactGroupFilter(valueFromSelect, groups);
    const url = buildContactListUrl(value, nextGroup);
    setGroup(nextGroup);
    if (url === requestedUrl) return;

    setRequestedUrl(url);
    startTransition(() => router.replace(url, { scroll: false }));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <form
        role="search"
        className="relative sm:col-span-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <ThreadSearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
        <Input
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Найти по имени"
          aria-label="Найти контакт по имени"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 bg-card pr-12 pl-11"
        />
        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
          {isPending ? (
            <Loader2Icon
              aria-label="Ищем…"
              className="mr-2.5 size-5 animate-spin text-muted-foreground"
            />
          ) : value ? (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setValue("")}
              className="flex size-10 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>
      </form>
      <NativeSelect
        aria-label="Фильтр по группе"
        className="h-12 bg-card"
        value={group ?? ""}
        onChange={(event) => changeGroup(event.currentTarget.value)}
      >
        <option value="">Все контакты</option>
        <option value="ungrouped">Без группы</option>
        <GroupOptions groups={groups} />
      </NativeSelect>
    </div>
  );
}

export function ContactSearchFallback() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="relative sm:col-span-2">
        <ThreadSearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
        <Input
          disabled
          placeholder="Найти по имени"
          aria-label="Найти контакт по имени"
          className="h-12 bg-card pl-11"
        />
      </div>
      <NativeSelect disabled aria-label="Фильтр по группе" className="h-12 bg-card">
        <option>Все контакты</option>
      </NativeSelect>
    </div>
  );
}
