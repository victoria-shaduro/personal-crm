import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updateContact } from "@/app/contacts/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContact, parseContactId } from "@/lib/contacts";

export const metadata: Metadata = {
  title: "Изменить контакт",
};

export default function EditContactPage({
  params,
}: PageProps<"/contacts/[id]/edit">) {
  return (
    <Suspense fallback={<EditFormSkeleton />}>
      <EditContact params={params} />
    </Suspense>
  );
}

async function EditContact({ params }: Pick<PageProps<"/contacts/[id]/edit">, "params">) {
  const id = parseContactId((await params).id);
  if (!id) notFound();

  const contact = await getContact(id);
  if (!contact) notFound();

  return (
    <div className="grid gap-5">
      <BackLink href={`/contacts/${contact.id}`}>{contact.name}</BackLink>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold tracking-tight">
              Изменить контакт
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm
            action={updateContact.bind(null, contact.id)}
            initialValues={{
              name: contact.name,
              about: contact.about ?? "",
              howWeMet: contact.howWeMet ?? "",
              phone: contact.phone ?? "",
              email: contact.email ?? "",
            }}
            submitLabel="Сохранить"
            cancelHref={`/contacts/${contact.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EditFormSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Загружаем контакт">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="grid gap-5 rounded-xl bg-background p-4 ring-1 ring-foreground/10">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
