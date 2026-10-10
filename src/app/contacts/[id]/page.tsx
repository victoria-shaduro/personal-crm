import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { addNote } from "@/app/contacts/actions";
import { BackLink } from "@/components/back-link";
import { ContactAvatar } from "@/components/contact-avatar";
import { FlashToast } from "@/components/flash-toast";
import { NoteForm } from "@/components/note-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getContact, getContactNotes, parseContactId } from "@/lib/contacts";
import { formatDate, formatDateTime, toTelHref } from "@/lib/format";
import { cn } from "cn";

export async function generateMetadata({
  params,
}: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const id = parseContactId((await params).id);
  const contact = id ? await getContact(id) : null;
  return { title: contact?.name ?? "Контакт не найден" };
}

export default function ContactPage({
  params,
  searchParams,
}: PageProps<"/contacts/[id]">) {
  return (
    <div className="grid gap-5">
      <BackLink href="/">Все контакты</BackLink>
      <Suspense fallback={<ContactSkeleton />}>
        <ContactDetails params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ContactDetails({
  params,
  searchParams,
}: PageProps<"/contacts/[id]">) {
  const id = parseContactId((await params).id);
  if (!id) notFound();

  const contact = await getContact(id);
  if (!contact) notFound();

  const [contactNotes, { saved }] = await Promise.all([
    getContactNotes(contact.id),
    searchParams,
  ]);

  return (
    <>
      <Card>
        <CardHeader className="gap-x-4">
          <div className="flex min-w-0 items-center gap-4">
            <ContactAvatar id={contact.id} name={contact.name} size="lg" />
            <div className="grid min-w-0 gap-1">
              <CardTitle>
                <h1 className="text-xl font-semibold tracking-tight break-words">
                  {contact.name}
                </h1>
              </CardTitle>
              {contact.about ? (
                <CardDescription className="text-base">
                  {contact.about}
                </CardDescription>
              ) : null}
            </div>
          </div>
          <CardAction>
            <Link
              href={`/contacts/${contact.id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }), "px-3")}
            >
              <PencilIcon aria-hidden />
              {/* Icon-only on phones so the name has room */}
              <span className="max-sm:sr-only">Изменить</span>
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-2">
            <Detail label="Телефон">
              {contact.phone ? (
                <a
                  href={toTelHref(contact.phone)}
                  className="underline-offset-4 hover:underline"
                >
                  {contact.phone}
                </a>
              ) : null}
            </Detail>
            <Detail label="Почта">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="break-all underline-offset-4 hover:underline"
                >
                  {contact.email}
                </a>
              ) : null}
            </Detail>
            <Detail label="Откуда знакомы" className="sm:col-span-2">
              {contact.howWeMet}
            </Detail>
            <Detail label="В контактах с">{formatDate(contact.createdAt)}</Detail>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="notes-heading" className="grid gap-4">
        <h2 id="notes-heading" className="text-lg font-semibold tracking-tight">
          Заметки
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {contactNotes.length}
          </span>
        </h2>

        <NoteForm action={addNote.bind(null, contact.id)} />

        {contactNotes.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            Заметок пока нет. Запишите, о чём говорили и о чём договорились.
          </p>
        ) : (
          <ol className="grid gap-3">
            {contactNotes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl border bg-background px-4 py-3"
              >
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {note.body}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {saved ? <FlashToast message="Изменения сохранены" param="saved" /> : null}
    </>
  );
}

function Detail({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">
        {children ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Загружаем контакт">
      <div className="rounded-xl bg-background p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-4">
          <div className="size-14 animate-pulse rounded-full bg-muted" />
          <div className="grid gap-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-9 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
