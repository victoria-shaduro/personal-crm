"use client";

import { useActionState, useEffect, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NoteFormState } from "@/lib/contact-form";

type NoteFormProps = {
  action: (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;
};

function submitOnModEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

export function NoteForm({ action }: NoteFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (state.savedAt) {
      toast.success("Заметка сохранена", { id: `note-saved-${state.savedAt}` });
    }
  }, [state.savedAt]);

  return (
    <form action={formAction} className="grid gap-3">
      <Label htmlFor="note-body" className="sr-only">
        Новая заметка
      </Label>
      <Textarea
        id="note-body"
        name="body"
        // Keeps the text after a failed save; a successful save clears the field
        defaultValue={state.body}
        placeholder="О чём поговорили, о чём договорились…"
        rows={3}
        className="min-h-24 bg-card"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "note-body-error" : undefined}
        onKeyDown={submitOnModEnter}
      />
      {state.error ? (
        <p id="note-body-error" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        <span className="hidden font-mono text-xs text-subtle-foreground sm:inline">
          Ctrl/⌘ + Enter — сохранить
        </span>
        <Button type="submit" size="lg" disabled={pending} className="max-sm:w-full">
          {pending ? "Сохраняем…" : "Добавить заметку"}
        </Button>
      </div>
    </form>
  );
}
