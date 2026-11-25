"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitEmail } from "./actions";

export default function LoginPage() {
  const [message, action, pending] = useActionState(submitEmail, "");
  return <section className="mx-auto grid max-w-sm gap-6">
    <h1 className="font-display text-display">Вход</h1>
    <form action={action} noValidate className="grid gap-3">
      <Label htmlFor="email">Почта</Label>
      <Input id="email" name="email" type="email" autoComplete="email" aria-describedby="login-message" />
      <p id="login-message" role="status">{message}</p>
      <Button type="submit" disabled={pending}>Получить ссылку</Button>
    </form>
  </section>;
}
