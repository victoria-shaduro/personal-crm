"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { ThreadSearchIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";

const SEARCH_DELAY_MS = 250;

function buildListUrl(query: string): string {
  return query ? `/?q=${encodeURIComponent(query)}` : "/";
}

export function ContactSearch() {
  const router = useRouter();
  const urlQuery = useSearchParams().get("q") ?? "";

  const [value, setValue] = useState(urlQuery);
  // The last query this component sent to the router
  const [requestedQuery, setRequestedQuery] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();

  // The URL changed without us (e.g. a link to "/"): show what the URL says
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== requestedQuery) {
      setValue(urlQuery);
      setRequestedQuery(urlQuery);
    }
  }

  // Search as the user types, after a short pause
  useEffect(() => {
    const query = value.trim();
    if (query === requestedQuery) return;

    const timeout = setTimeout(() => {
      setRequestedQuery(query);
      startTransition(() => {
        router.replace(buildListUrl(query), { scroll: false });
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [value, requestedQuery, router]);

  return (
    <form
      role="search"
      className="relative"
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
  );
}

export function ContactSearchFallback() {
  return (
    <div className="relative">
      <ThreadSearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
      <Input
        disabled
        placeholder="Найти по имени"
        aria-label="Найти контакт по имени"
        className="h-12 bg-card pl-11"
      />
    </div>
  );
}
