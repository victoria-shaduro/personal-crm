import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { createContact } from "@/app/contacts/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listGroups } from "@/lib/groups";

export const metadata: Metadata = {
  title: "Новый контакт",
};

export default function NewContactPage() {
  return (
    <div className="grid gap-5">
      <BackLink href="/">Все контакты</BackLink>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Новый контакт</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p aria-busy="true">Загружаем форму…</p>}>
            <NewContactForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function NewContactForm() {
  await connection();

  return (
    <ContactForm
      action={createContact}
      groups={await listGroups()}
      submitLabel="Добавить контакт"
      cancelHref="/"
      autoFocusName
    />
  );
}
