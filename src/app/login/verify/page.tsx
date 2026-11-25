"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";

export default function VerifyPage() {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const reloadLink = () => { if (location.hash) location.reload(); };
    window.addEventListener("hashchange", reloadLink);
    const cleanup = () => window.removeEventListener("hashchange", reloadLink);
    if (started.current) return cleanup;
    started.current = true;
    const token = location.hash.slice(1);
    history.replaceState(null, "", location.pathname);
    fetch("/login/consume", { method: "POST", body: token }).then(response => {
      if (response.ok) location.replace("/");
      else setFailed(true);
    }).catch(() => setFailed(true));
    return cleanup;
  }, []);
  return failed ? <section className="grid justify-items-start gap-4">
    <h1 className="font-display text-title">Ссылка устарела, запроси новую</h1>
    <Link href="/login" className={buttonVariants()}>На страницу входа</Link>
  </section> : <p role="status">Проверяем ссылку…</p>;
}
