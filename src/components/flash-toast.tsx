"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type FlashToastProps = {
  message: string;
  // Query parameter that triggered the toast; removed so a reload doesn't repeat it
  param: string;
  // Element to bring into view, e.g. a freshly added contact in the list
  scrollToId?: string;
};

export function FlashToast({ message, param, scrollToId }: FlashToastProps) {
  useEffect(() => {
    toast.success(message, { id: `flash-${param}` });

    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState(null, "", url);
    }

    if (!scrollToId) return;
    // Wait until the router has finished its own scroll after navigation
    const timeout = window.setTimeout(() => {
      document.getElementById(scrollToId)?.scrollIntoView({ block: "center" });
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [message, param, scrollToId]);

  return null;
}
