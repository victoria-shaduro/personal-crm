"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContactField,
  ContactFormState,
  ContactFormValues,
} from "@/lib/contact-form";

const EMPTY_VALUES: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
};

type ContactFormProps = {
  action: (
    state: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
  initialValues?: ContactFormValues;
  submitLabel: string;
  cancelHref: string;
  autoFocusName?: boolean;
};

export function ContactForm({
  action,
  initialValues = EMPTY_VALUES,
  submitLabel,
  cancelHref,
  autoFocusName = false,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

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
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
          className="h-9"
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
          className="h-9"
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
            className="h-9"
          />
        </FormField>

        <FormField field="email" label="Почта" error={state.errors?.email}>
          <Input
            {...fieldProps("email")}
            type="email"
            inputMode="email"
            placeholder="name@example.com"
            autoComplete="off"
            className="h-9"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" size="lg" disabled={pending} className="px-4">
          {pending ? "Сохраняем…" : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
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
  field: ContactField;
  label: string;
  required?: boolean;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
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
