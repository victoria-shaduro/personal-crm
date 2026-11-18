import type { GroupOption } from "@/lib/groups";

export function GroupOptions({ groups }: { groups: GroupOption[] }) {
  if (groups.length === 0) return null;

  return (
    <optgroup label="Группы">
      {groups.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
    </optgroup>
  );
}
