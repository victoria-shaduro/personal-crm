"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useId,
  type FormEvent,
  type ReactNode,
} from "react";

import { GroupOptions } from "@/components/group-options";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContactField,
  ContactFormState,
  ContactFormValues,
} from "@/lib/contact-form";
import type { GroupOption } from "@/lib/groups";

const EMPTY_VALUES: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
};

const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "UTC" });
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  monthFormat.format(new Date(Date.UTC(2000, index, 1))),
);

type ContactFormProps = {
  action: (
    state: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
  initialValues?: ContactFormValues;
  groups: GroupOption[];
  initialGroupId?: number | null;
  submitLabel: string;
  cancelHref: string;
  autoFocusName?: boolean;
};

export function ContactForm({
  action,
  initialValues = EMPTY_VALUES,
  groups,
  initialGroupId,
  submitLabel,
  cancelHref,
  autoFocusName = false,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const groupInputId = useId();
  const birthdayId = useId();
  const birthdayFeedbackId = `${birthdayId}-feedback`;
  const birthdayError = state.errors?.birthday?.[0];

  // Submitting manually (instead of <form action>) skips React's automatic form
  // reset, so a failed save keeps everything the user typed in the fields
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const fieldProps = (field: ContactField) => {
    const error = state.errors?.[field]?.[0];
    return {
      id: field,
      name: field,
      defaultValue: initialValues[field],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${field}-error` : undefined,
    };
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      {state.message ? (
        <p
          role="alert"
          className="border-l-3 border-destructive bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      ) : null}

      <FormField field="name" label="Имя" required error={state.errors?.name}>
        <Input
          {...fieldProps("name")}
          placeholder="Например, Анна Смирнова"
          autoComplete="off"
          autoFocus={autoFocusName}
        />
      </FormField>

      <FormField
        field="about"
        label="Кто это"
        error={state.errors?.about}
      >
        <Input
          {...fieldProps("about")}
          placeholder="Например, дизайнер, подруга сестры"
          autoComplete="off"
        />
      </FormField>

      <FormField
        field="howWeMet"
        label="Откуда знакомы"
        error={state.errors?.howWeMet}
      >
        <Textarea
          {...fieldProps("howWeMet")}
          placeholder="Например, вместе работали в 2021 году"
          rows={2}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField field="phone" label="Телефон" error={state.errors?.phone}>
          <Input
            {...fieldProps("phone")}
            type="tel"
            inputMode="tel"
            placeholder="+7 900 123-45-67"
            autoComplete="off"
          />
        </FormField>

        <FormField field="email" label="Почта" error={state.errors?.email}>
          <Input
            {...fieldProps("email")}
            type="email"
            inputMode="email"
            placeholder="name@example.com"
            autoComplete="off"
          />
        </FormField>
      </div>

      <fieldset aria-describedby={birthdayFeedbackId} className="grid min-w-0 gap-2.5">
        <legend className="mb-2.5 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Дата рождения
        </legend>
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <FormField field={`${birthdayId}-day`} label="День">
            <Input
              id={`${birthdayId}-day`}
              name="birthDay"
              inputMode="numeric"
              defaultValue={initialValues.birthDay}
              aria-invalid={birthdayError ? true : undefined}
            />
          </FormField>
          <div className="col-span-2 min-w-0">
            <FormField field={`${birthdayId}-month`} label="Месяц">
              <NativeSelect
                id={`${birthdayId}-month`}
                name="birthMonth"
                defaultValue={initialValues.birthMonth}
                aria-invalid={birthdayError ? true : undefined}
              >
                <option value="">—</option>
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField field={`${birthdayId}-year`} label="Год">
            <Input
              id={`${birthdayId}-year`}
              name="birthYear"
              inputMode="numeric"
              defaultValue={initialValues.birthYear}
              aria-invalid={birthdayError ? true : undefined}
            />
          </FormField>
        </div>
        {birthdayError ? (
          <p id={birthdayFeedbackId} role="alert" className="text-sm text-destructive">
            {birthdayError}
          </p>
        ) : (
          <p id={birthdayFeedbackId} className="text-sm text-muted-foreground">Год можно не указывать.</p>
        )}
      </fieldset>

      <FormField field={groupInputId} label="Группа" error={state.errors?.groupId}>
        <NativeSelect
          id={groupInputId}
          name="groupId"
          defaultValue={initialGroupId ?? ""}
          aria-invalid={state.errors?.groupId ? true : undefined}
          aria-describedby={state.errors?.groupId ? `${groupInputId}-error` : undefined}
        >
          <option value="">Без группы</option>
          <GroupOptions groups={groups} />
        </NativeSelect>
      </FormField>

      <div className="flex flex-wrap items-center gap-1 pt-1">
        <Button type="submit" size="lg" disabled={pending} className="max-sm:w-full">
          {pending ? "Сохраняем…" : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className={buttonVariants({
            variant: "ghost",
            size: "lg",
            className: "max-sm:w-full",
          })}
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}

function FormField({
  field,
  label,
  required = false,
  error,
  children,
}: {
  field: string;
  label: string;
  required?: boolean;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <Label htmlFor={field}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error?.[0] ? (
        <p id={`${field}-error`} className="text-sm text-destructive">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}
