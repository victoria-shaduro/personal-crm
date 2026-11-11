"use client";

import { Trash2Icon } from "lucide-react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useActionState, useRef, useState } from "react";
import { deleteContact } from "@/app/contacts/actions";
import { Button } from "@/components/ui/button";

export function DeleteContact({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteContact.bind(null, id), {});
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={(value) => { if (!pending) setOpen(value); }}>
      <AlertDialog.Trigger render={<Button variant="destructive" className="max-sm:w-11 max-sm:px-0" />}>
        <Trash2Icon aria-hidden />
        <span className="max-sm:sr-only">Удалить контакт</span>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-background/80" />
        <AlertDialog.Popup initialFocus={cancelRef} className="fixed top-1/2 left-1/2 z-50 grid max-h-dvh w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-sm border border-border-strong bg-card p-5 text-foreground sm:p-7">
          <AlertDialog.Title className="break-words font-display text-title font-semibold">
            Удалить контакт «{name}»?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">
            Контакт и все его заметки будут удалены навсегда. Восстановить их не получится.
          </AlertDialog.Description>
          <form action={action} className="grid gap-4">
            {state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
            <div className="flex flex-wrap justify-end gap-3">
              <AlertDialog.Close render={<Button ref={cancelRef} variant="outline" disabled={pending} />}>
                Отмена
              </AlertDialog.Close>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Удаляем…" : "Удалить"}
              </Button>
            </div>
          </form>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
