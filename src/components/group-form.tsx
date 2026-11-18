"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

import { createGroup } from "@/app/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3" noValidate>
      <Label htmlFor="group-name">Название группы</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="group-name"
          name="name"
          autoComplete="off"
          required
          readOnly={pending}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "group-name-error" : undefined}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Добавляем…" : "Добавить группу"}
        </Button>
      </div>
      {state.error ? (
        <p id="group-name-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state.savedAt ? (
        <p role="status" className="text-sm text-muted-foreground">Группа добавлена.</p>
      ) : null}
    </form>
  );
}
