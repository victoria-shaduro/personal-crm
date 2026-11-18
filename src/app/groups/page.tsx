import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { GroupForm } from "@/components/group-form";
import { Card, CardContent } from "@/components/ui/card";
import { listGroups } from "@/lib/groups";

export const metadata: Metadata = { title: "Группы" };

export default function GroupsPage() {
  return (
    <div className="grid gap-5">
      <BackLink href="/">Все контакты</BackLink>
      <h1 className="font-display text-display font-medium">Группы</h1>
      <Card>
        <CardContent><GroupForm /></CardContent>
      </Card>
      <Suspense fallback={<p aria-busy="true">Загружаем группы…</p>}>
        <GroupList />
      </Suspense>
    </div>
  );
}

async function GroupList() {
  await connection();
  const groups = await listGroups();
  if (!groups.length) return <p className="text-sm text-muted-foreground">Пока нет групп.</p>;

  return (
    <ul aria-label="Список групп" className="divide-y divide-border-strong rounded-sm border border-border-strong bg-card">
      {groups.map(({ id, name }) => (
        <li key={id} className="px-4 py-3 wrap-anywhere">{name}</li>
      ))}
    </ul>
  );
}
