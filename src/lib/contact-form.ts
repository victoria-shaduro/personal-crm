import { z } from "zod";

import { parseGroupId } from "@/lib/group-form";

// Shared between the server actions and the client form components

export const CONTACT_FIELDS = ["name", "about", "howWeMet", "phone", "email"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactFormValues = Record<ContactField | "birthDay" | "birthMonth" | "birthYear", string>;

export type ContactFormState = {
  errors?: Partial<Record<ContactField | "groupId" | "birthday", string[]>>;
  message?: string;
};

export type NoteFormState = {
  body?: string;
  error?: string;
  savedAt?: number;
};

const emptyToNull = (value: string) => (value === "" ? null : value);

const optionalText = (maxLength: number, tooLongMessage: string) =>
  z.string().trim().max(maxLength, tooLongMessage).transform(emptyToNull);

const GROUP_SELECTION_ERROR = "Выберите группу из списка.";
const INVALID_BIRTHDAY = "Укажите корректную дату рождения.";

const birthdayPart = z.string({ error: INVALID_BIRTHDAY }).trim();
const birthdaySchema = z.object({
  day: birthdayPart,
  month: birthdayPart,
  year: birthdayPart,
}).transform(({ day, month, year }, context) => {
  if (day === "" && month === "" && year === "") {
    return { birthDay: null, birthMonth: null, birthYear: null };
  }

  if (day === "" || month === "") {
    context.addIssue({ code: "custom", message: "Укажите день и месяц рождения." });
    return z.NEVER;
  }

  const birthDay = Number(day);
  const birthMonth = Number(month);
  const birthYear = year === "" ? null : Number(year);
  if (!/^\d{1,2}$/.test(day) || birthDay < 1 || birthDay > 31
    || !/^\d{1,2}$/.test(month) || birthMonth < 1 || birthMonth > 12
    || (birthYear !== null && (!/^\d{1,4}$/.test(year) || birthYear < 1))) {
    context.addIssue({ code: "custom", message: INVALID_BIRTHDAY });
    return z.NEVER;
  }

  // A leap year lets a birthday on February 29 be saved with an unknown year.
  const date = new Date(0);
  date.setUTCFullYear(birthYear ?? 2000, birthMonth - 1, birthDay);
  if (date.getUTCMonth() !== birthMonth - 1) {
    context.addIssue({ code: "custom", message: INVALID_BIRTHDAY });
    return z.NEVER;
  }

  return { birthDay, birthMonth, birthYear };
});

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(200, "Имя слишком длинное — не больше 200 символов"),
  about: optionalText(500, "Слишком длинно — не больше 500 символов"),
  howWeMet: optionalText(500, "Слишком длинно — не больше 500 символов"),
  phone: z
    .string()
    .trim()
    .max(50, "Телефон слишком длинный")
    .refine(
      (value) => value === "" || /^\+?[\d\s()\-.]{5,}$/.test(value),
      "Телефон может содержать только цифры, пробелы, скобки, дефисы и + в начале",
    )
    .transform(emptyToNull),
  email: z
    .string()
    .trim()
    .max(254, "Адрес почты слишком длинный")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Похоже, в адресе почты ошибка",
    )
    .transform(emptyToNull),
  groupId: z.string({ error: GROUP_SELECTION_ERROR })
    .refine((value) => value === "" || parseGroupId(value) !== null, GROUP_SELECTION_ERROR)
    .transform(parseGroupId)
    .optional(),
  birthday: birthdaySchema.optional(),
}).transform(({ birthday, ...contact }) => ({ ...contact, ...birthday }));

export const noteSchema = z
  .string()
  .trim()
  .min(1, "Заметка пустая — напишите хотя бы пару слов")
  .max(10_000, "Заметка слишком длинная — не больше 10 000 символов");

export function readContactForm(formData: FormData) {
  const read = (field: ContactField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  const day = formData.get("birthDay");
  const month = formData.get("birthMonth");
  const year = formData.get("birthYear");
  // Older forms omit all three fields. Empty fields in the current form clear the date.
  const birthday = day === null && month === null && year === null
    ? undefined
    : { day: day ?? "", month: month ?? "", year: year ?? "" };
  return {
    name: read("name"),
    about: read("about"),
    howWeMet: read("howWeMet"),
    phone: read("phone"),
    email: read("email"),
    groupId: formData.get("groupId") ?? undefined,
    birthday,
  };
}

export type DeleteContactState = { message?: string };

export type KeepInTouchFormState = { error?: string; savedAt?: number };
export type MarkContactedState = { error?: string; savedAt?: number };
