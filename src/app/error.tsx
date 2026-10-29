"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-sm border border-border-strong bg-card px-6 py-16 text-center">
      <h1 className="font-display text-title font-semibold">Не получилось загрузить данные</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Скорее всего, не запущена база данных. Откройте Docker Desktop, подождите
        минуту и попробуйте ещё раз.
      </p>
      <Button variant="outline" className="mt-6" onClick={() => retry()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
