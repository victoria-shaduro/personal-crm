"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Select } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";

import { updateKeepInTouch } from "@/app/contacts/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { KeepInTouchFormState } from "@/lib/contact-form";

const FREQUENCY_OPTIONS = [
  { value: "", label: "Не задано" },
  { value: "7", label: "Раз в неделю" },
  { value: "30", label: "Раз в месяц" },
  { value: "90", label: "Раз в квартал" },
  { value: "365", label: "Раз в год" },
];

export function KeepInTouchForm({ id, intervalDays }: { id: number; intervalDays: number | null }) {
  const [state, action, pending] = useActionState<KeepInTouchFormState, FormData>(async (previous, formData) => {
    try {
      return await updateKeepInTouch(id, previous, formData);
    } catch {
      return { error: "Не получилось сохранить частоту. Попробуйте ещё раз." };
    }
  }, {});
  const [value, setValue] = useState(String(intervalDays ?? ""));
  const fieldId = useId();
  useEffect(() => {
    if (state.savedAt) toast.success("Частота сохранена", { id: `schedule-${state.savedAt}` });
  }, [state.savedAt]);
  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="mt-5 grid gap-3">
      <Label htmlFor={fieldId}>Частота общения</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select.Root name="intervalDays" value={value} items={FREQUENCY_OPTIONS}
          onValueChange={(nextValue) => setValue(nextValue ?? "")} disabled={pending}>
          <Select.Trigger id={fieldId}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? `${fieldId}-error` : undefined}
            className="flex h-11 min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-xs border border-input bg-surface-inset px-3 text-left text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive">
            <Select.Value />
            <Select.Icon><ChevronDownIcon aria-hidden className="size-4 text-subtle-foreground" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} className="z-50 outline-none">
              <Select.Popup className="max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) overflow-y-auto rounded-xs border border-border-strong bg-popover p-1 text-popover-foreground outline-none">
                <Select.List>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <Select.Item key={option.value} value={option.value}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xs px-3 py-2 font-sans text-sm outline-none data-highlighted:bg-thread-lavender/15 data-[selected]:text-thread-olive">
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        <Select.ItemIndicator><CheckIcon aria-hidden className="size-4" /></Select.ItemIndicator>
                      </span>
                      <Select.ItemText>{option.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Сохраняем…" : intervalDays === null ? "Задать частоту" : "Изменить частоту"}
        </Button>
      </div>
      {state.error ? <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
