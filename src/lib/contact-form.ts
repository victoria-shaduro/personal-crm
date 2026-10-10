import { z } from "zod";

// Shared between the server actions and the client form components

export const CONTACT_FIELDS = ["name", "about", "howWeMet", "phone", "email"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactFormValues = Record<ContactField, string>;

export type ContactFormState = {
  errors?: Partial<Record<ContactField, string[]>>;
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
});

export const noteSchema = z
  .string()
  .trim()
  .min(1, "Заметка пустая — напишите хотя бы пару слов")
  .max(10_000, "Заметка слишком длинная — не больше 10 000 символов");

export function readContactForm(formData: FormData): ContactFormValues {
  const read = (field: ContactField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    name: read("name"),
    about: read("about"),
    howWeMet: read("howWeMet"),
    phone: read("phone"),
    email: read("email"),
  };
}
