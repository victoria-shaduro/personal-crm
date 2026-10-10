const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const pluralRules = new Intl.PluralRules("ru-RU");

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

// pluralize(5, ["контакт", "контакта", "контактов"]) -> "контактов"
export function pluralize(
  count: number,
  [one, few, many]: readonly [string, string, string],
): string {
  const rule = pluralRules.select(count);
  if (rule === "one") return one;
  if (rule === "few") return few;
  return many;
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join("").toUpperCase() || "?";
}

// Telephone links need digits only, keeping a leading "+"
export function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
