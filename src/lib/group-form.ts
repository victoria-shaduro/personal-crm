import { z } from "zod";

export type GroupFormState = { error?: string; savedAt?: number };

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название группы.")
  .refine((name) => [...name].length <= 200, "Название должно быть не длиннее 200 символов.");

export function parseGroupId(value: string): number | null {
  const id = Number(value);
  return /^[1-9]\d{0,9}$/.test(value) && id <= 2_147_483_647 ? id : null;
}
