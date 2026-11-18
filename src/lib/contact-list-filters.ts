import { parseGroupId } from "@/lib/group-form";
import type { GroupOption } from "@/lib/groups";

export type ContactGroupFilter = number | "ungrouped" | null;

export function parseContactGroupFilter(
  value: string | null,
  groups: GroupOption[],
): ContactGroupFilter {
  if (value === "ungrouped") return value;
  if (!value) return null;

  const id = parseGroupId(value);
  return groups.some((group) => group.id === id) ? id : null;
}

export function buildContactListUrl(query: string, group: ContactGroupFilter): string {
  const params = new URLSearchParams();
  const search = query.trim();
  if (search) params.set("q", search);
  if (group !== null) params.set("group", String(group));
  const searchString = params.toString();
  return searchString ? `/?${searchString}` : "/";
}
