"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState, useEffect, useId } from "react";
import { toast } from "sonner";

import { markContacted } from "@/app/contacts/actions";
import { Button } from "@/components/ui/button";
import type { MarkContactedState } from "@/lib/contact-form";

export function MarkContactedButton({ id, name }: { id: number; name: string }) {
  const [state, action, pending] = useActionState<MarkContactedState, FormData>(async (previous, formData) => {
    try {
      return await markContacted(id, previous, formData);
    } catch {
      return { error: "Не получилось отметить общение. Попробуйте ещё раз." };
    }
  }, {});
  const errorId = useId();
  useEffect(() => {
    if (state.savedAt) toast.success("Общение отмечено", { id: `contacted-${id}-${state.savedAt}` });
  }, [id, state.savedAt]);
  return (
    <form action={action} className="grid shrink-0 gap-2">
      <Button type="submit" variant="outline" disabled={pending}
        aria-label={`Отметить общение с ${name}`} title="Связались"
        aria-describedby={state.error ? errorId : undefined}
        aria-busy={pending}
        className="size-11 border-thread-olive p-0 text-thread-olive">
        {pending ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : <CheckIcon aria-hidden />}
      </Button>
      {state.error ? <p id={errorId} role="alert" className="max-w-48 text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
