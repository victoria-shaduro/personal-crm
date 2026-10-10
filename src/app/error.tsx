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
    <div className="rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">Не получилось загрузить данные</h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Скорее всего, не запущена база данных. Откройте Docker Desktop, подождите
        минуту и попробуйте ещё раз.
      </p>
      <Button variant="outline" className="mt-6" onClick={() => retry()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
