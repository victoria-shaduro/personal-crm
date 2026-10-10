// Fills an empty database with realistic test contacts and notes.
// Refuses to run when contacts already exist, so it never mixes or wipes real data.
import { loadEnvConfig } from "@next/env";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { contacts, notes } from "../src/db/schema";

loadEnvConfig(process.cwd());

const CONTACT_COUNT = 1000;
const BATCH_SIZE = 500;

// Deterministic PRNG (mulberry32) so every seed run produces the same people
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261010);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function chance(probability: number): boolean {
  return random() < probability;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

// Expands {filler} slots and picks the [masculine|feminine] variant for the contact
function fill(template: string, isFemale: boolean): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => pick(FILLERS[key]))
    .replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, masculine: string, feminine: string) =>
      isFemale ? feminine : masculine,
    );
}

const MALE_NAMES = [
  "Александр", "Алексей", "Андрей", "Антон", "Артём", "Борис", "Вадим", "Валентин",
  "Василий", "Виктор", "Виталий", "Владимир", "Владислав", "Вячеслав", "Георгий",
  "Глеб", "Григорий", "Даниил", "Денис", "Дмитрий", "Евгений", "Егор", "Иван",
  "Игорь", "Илья", "Кирилл", "Константин", "Лев", "Леонид", "Максим", "Марк",
  "Матвей", "Михаил", "Никита", "Николай", "Олег", "Павел", "Пётр", "Роман",
  "Руслан", "Семён", "Сергей", "Станислав", "Степан", "Тимофей", "Тимур", "Фёдор",
  "Юрий", "Ярослав",
] as const;

const FEMALE_NAMES = [
  "Алёна", "Алина", "Алиса", "Алла", "Анастасия", "Ангелина", "Анна", "Арина",
  "Валентина", "Валерия", "Вера", "Вероника", "Виктория", "Галина", "Дарья", "Диана",
  "Ева", "Евгения", "Екатерина", "Елена", "Елизавета", "Жанна", "Зоя", "Инна",
  "Ирина", "Карина", "Кира", "Ксения", "Лариса", "Лилия", "Любовь", "Людмила",
  "Маргарита", "Марина", "Мария", "Надежда", "Наталья", "Нина", "Оксана", "Олеся",
  "Ольга", "Полина", "Светлана", "София", "Таисия", "Татьяна", "Ульяна", "Юлия",
  "Яна",
] as const;

// Masculine surname forms; feminine forms are derived below
const SURNAMES = [
  "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов",
  "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров",
  "Павлов", "Козлов", "Степанов", "Николаев", "Орлов", "Андреев", "Макаров", "Никитин",
  "Захаров", "Зайцев", "Соловьёв", "Борисов", "Яковлев", "Григорьев", "Романов", "Воробьёв",
  "Сергеев", "Кузьмин", "Фролов", "Александров", "Дмитриев", "Королёв", "Гусев", "Киселёв",
  "Ильин", "Максимов", "Поляков", "Сорокин", "Виноградов", "Ковалёв", "Белов", "Медведев",
  "Антонов", "Тарасов", "Жуков", "Баранов", "Филиппов", "Комаров", "Давыдов", "Беляев",
  "Герасимов", "Богданов", "Осипов", "Сидоров", "Матвеев", "Титов", "Марков", "Миронов",
  "Крылов", "Куликов", "Карпов", "Власов", "Мельников", "Денисов", "Гаврилов", "Тихонов",
  "Казаков", "Афанасьев", "Данилов", "Савельев", "Тимофеев", "Фомин", "Чернов", "Абрамов",
  "Мартынов", "Ефимов", "Федотов", "Щербаков", "Назаров", "Калинин", "Исаев", "Чернышёв",
  "Быков", "Маслов", "Родионов", "Коновалов", "Лазарев", "Воронин", "Климов", "Филатов",
  "Пономарёв", "Голубев", "Кудрявцев", "Прохоров", "Наумов", "Потапов", "Журавлёв", "Овчинников",
  "Трофимов", "Леонов", "Соболев", "Ермаков", "Колесников", "Гончаров", "Емельянов", "Никифоров",
  "Грачёв", "Котов", "Гришин", "Ефремов", "Архипов", "Громов", "Кириллов", "Малышев",
  "Панов", "Моисеев", "Румянцев", "Акимов", "Кондратьев", "Бирюков", "Горбунов", "Анисимов",
  "Еремин", "Тихомиров", "Галкин", "Лукьянов", "Михеев", "Скворцов", "Юдин", "Белоусов",
  "Нестеров", "Симонов", "Прокофьев", "Харитонов", "Князев", "Цветков", "Левин", "Митрофанов",
  "Воронцов", "Савин", "Шестаков", "Блинов", "Рыбаков", "Суворов", "Зиновьев", "Ершов",
  "Островский", "Вишневский", "Ковальский", "Покровский", "Дубровский", "Залесский",
  "Шевченко", "Бондаренко", "Коваленко", "Ткаченко", "Кравченко", "Ким", "Пак", "Цой",
  "Шевчук", "Гордиенко", "Мельник", "Лысенко", "Руденко", "Карпенко",
] as const;

function feminineSurname(surname: string): string {
  if (/(ов|ев|ёв|ин|ын)$/.test(surname)) return `${surname}а`;
  if (surname.endsWith("ский")) return surname.replace(/ский$/, "ская");
  if (surname.endsWith("цкий")) return surname.replace(/цкий$/, "цкая");
  return surname;
}

const COMPANIES = [
  "Яндексе", "Сбере", "Т-Банке", "Ozon", "VK", "Авито", "МТС", "Wildberries",
  "2ГИС", "Лаборатории Касперского", "Альфа-Банке", "Skyeng", "hh.ru", "Самокате",
  "небольшой веб-студии", "архитектурном бюро", "рекламном агентстве", "издательстве",
  "IT-стартапе", "консалтинге", "банке", "школе программирования", "кофейне на Тверской",
] as const;

const FILLERS: Record<string, readonly string[]> = {
  company: COMPANIES,
  city: [
    "Москве", "Петербурге", "Казани", "Екатеринбурге", "Новосибирске", "Нижнем Новгороде",
    "Сочи", "Калининграде", "Тбилиси", "Ереване", "Стамбуле", "Белграде", "Алматы",
  ],
  event: [
    "Highload++", "TeamLead Conf", "Epic Growth", "RIW", "ProductSense", "HolyJS",
    "Moscow Python Conf", "Дизайн-выходные", "Петербургский книжный салон",
  ],
  year: ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"],
  university: ["МГУ", "СПбГУ", "ВШЭ", "МФТИ", "МГТУ им. Баумана", "ИТМО", "УрФУ", "КФУ", "РЭУ им. Плеханова"],
  hobby: ["йоги", "бега", "танцев", "керамики", "плавания", "тенниса", "скалолазания", "вокала", "рисования"],
  course: ["английского", "UX-дизайна", "фотографии", "Python", "итальянского", "управления продуктом", "публичных выступлений"],
  friend: ["Маши", "Саши", "Димы", "Оли", "Кати", "Лёши", "Ани", "Миши", "Насти", "Серёжи"],
  topic: [
    "новый проект", "переезд в другой город", "ремонт квартиры", "поиск работы",
    "отпуск в Грузии", "курсы английского", "день рождения дочери", "свадьбу",
    "запуск своего дела", "смену профессии", "поступление сына в вуз", "покупку машины",
    "книгу, которую [он|она] сейчас пишет", "идею совместного проекта", "марафон в Казани",
    "выставку в Манеже", "аренду дачи на лето", "новую должность",
  ],
  agreement: [
    "созвониться через две недели", "встретиться в субботу на кофе",
    "переслать контакты хорошего юриста", "обменяться книгами", "сходить вместе на выставку",
    "пересечься на конференции в ноябре", "помочь с резюме", "прислать фотографии с поездки",
    "познакомить с нужным человеком", "собраться всей компанией после праздников",
    "обсудить идею подробнее за обедом", "отправить ссылку на курс", "вернуться к разговору в январе",
    "поддержать проект на старте", "поздравить с днём рождения в марте",
  ],
  detail: [
    "Рассказывает, что очень [доволен|довольна] новой работой.",
    "Ищет хорошего стоматолога — посоветовать нашего.",
    "Собирается в отпуск в Турцию в конце месяца.",
    "Недавно [завёл|завела] собаку, корги по кличке Бублик.",
    "Переезжает в новую квартиру, нужна помощь с вещами.",
    "[Предложил|Предложила] вместе пробежать полумарафон весной.",
    "Сейчас много работает, лучше писать, а не звонить.",
    "Интересуется темой ИИ в медицине.",
    "Дети пошли в первый класс, много хлопот.",
    "Ищет людей в команду: нужен аналитик данных.",
    "[Взял|Взяла] паузу в работе, путешествует по Азии.",
    "[Посоветовал|Посоветовала] книгу «Атлант расправил плечи».",
  ],
};

const ABOUT_TEMPLATES = [
  "Дизайнер в {company}", "Разработчик в {company}", "Продакт-менеджер в {company}",
  "Аналитик в {company}", "[Бывший коллега|Бывшая коллега] по работе в {company}",
  "Руководитель отдела продаж в {company}", "Маркетолог в {company}", "HR в {company}",
  "[Однокурсник|Однокурсница] по {university}", "[Сосед|Соседка] по дому", "[Сосед|Соседка] по даче",
  "Тренер по теннису", "Врач-стоматолог", "[Друг|Подруга] {friend}", "Фотограф",
  "Юрист, консультирует по договорам", "[Основатель|Основательница] стартапа", "Риелтор",
  "Преподаватель английского", "Бухгалтер-фрилансер", "Мастер по ремонту", "Ментор по карьере",
  "Архитектор", "Журналист", "Психолог", "[Двоюродный брат|Двоюродная сестра] {friend}",
  "[Знакомый|Знакомая] из группы {hobby}", "Организатор митапов", "Инвестор",
  "[Владелец|Владелица] кофейни", "Переводчик", "Ветеринар", "Финансовый консультант",
  "[Учитель|Учительница] сына", "Коллега мамы",
] as const;

const HOW_WE_MET_TEMPLATES = [
  "Познакомились на конференции {event} в {year}",
  "Учились вместе в {university}",
  "Работали вместе в {company}",
  "Познакомились на дне рождения у {friend}",
  "Соседи по дому",
  "Через общих друзей",
  "Вместе ходили на курсы {course}",
  "Познакомились в отпуске в {city}",
  "Вместе занимаемся в группе {hobby}",
  "Чат выпускников",
  "Познакомились на свадьбе {friend}",
  "Сидели в одном коворкинге",
  "Познакомились на митапе в {city}",
  "Родители дружат",
  "Нашлись через LinkedIn по работе",
  "Познакомились в поезде, ехали в одном купе",
] as const;

const NOTE_TEMPLATES = [
  "Созвонились, обсудили {topic}. Договорились {agreement}.",
  "Встретились на кофе. {detail}",
  "Переписывались в мессенджере про {topic}. Договорились {agreement}.",
  "Пересеклись на мероприятии. {detail}",
  "Поздравили с днём рождения. {detail}",
  "Обсудили {topic}. {detail}",
  "Договорились {agreement}.",
  "Долго говорили про {topic}. Нужно не забыть: {agreement}.",
  "Короткий звонок. {detail}",
] as const;

const EMAIL_DOMAINS = ["gmail.com", "yandex.ru", "mail.ru", "outlook.com", "icloud.com", "ya.ru", "bk.ru"] as const;

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(text: string): string {
  return [...text.toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("");
}

function makeEmail(firstName: string, lastName: string): string {
  const first = transliterate(firstName);
  const last = transliterate(lastName);
  const local = pick([
    `${first}.${last}`,
    `${first}${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${randomInt(1, 99)}`,
    `${last}${randomInt(70, 99)}`,
  ]);
  return `${local}@${pick(EMAIL_DOMAINS)}`;
}

function makePhone(): string {
  const code = pick(["900", "903", "905", "910", "915", "916", "925", "926", "929", "958", "977", "985", "999"]);
  const digits = (length: number) => Array.from({ length }, () => randomInt(0, 9)).join("");
  return `+7 ${code} ${digits(3)}-${digits(2)}-${digits(2)}`;
}

function randomDateBetween(start: Date, end: Date): Date {
  return new Date(start.getTime() + random() * (end.getTime() - start.getTime()));
}

type NewContact = typeof contacts.$inferInsert;
type NewNote = Omit<typeof notes.$inferInsert, "contactId">;

function makeContact(now: Date): { contact: NewContact; contactNotes: NewNote[] } {
  const isFemale = chance(0.5);
  const firstName = pick(isFemale ? FEMALE_NAMES : MALE_NAMES);
  const baseSurname = pick(SURNAMES);
  const lastName = isFemale ? feminineSurname(baseSurname) : baseSurname;

  const createdAt = randomDateBetween(new Date("2023-01-01T09:00:00Z"), new Date(now.getTime() - 3 * 86_400_000));

  const noteCount = pick([0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6]);
  const contactNotes: NewNote[] = Array.from({ length: noteCount }, () => ({
    body: fill(pick(NOTE_TEMPLATES), isFemale),
    createdAt: randomDateBetween(createdAt, now),
  }));

  const lastActivity = contactNotes.reduce(
    (latest, note) => (note.createdAt! > latest ? note.createdAt! : latest),
    createdAt,
  );

  return {
    contact: {
      name: `${firstName} ${lastName}`,
      about: chance(0.9) ? fill(pick(ABOUT_TEMPLATES), isFemale) : null,
      howWeMet: chance(0.8) ? fill(pick(HOW_WE_MET_TEMPLATES), isFemale) : null,
      phone: chance(0.85) ? makePhone() : null,
      email: chance(0.7) ? makeEmail(firstName, lastName) : null,
      createdAt,
      updatedAt: lastActivity,
    },
    contactNotes,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(contacts);
    if (existing > 0) {
      console.log(`Seed skipped: the database already has ${existing} contacts.`);
      return;
    }

    const now = new Date();
    const generated = Array.from({ length: CONTACT_COUNT }, () => makeContact(now));

    await db.transaction(async (tx) => {
      for (let start = 0; start < generated.length; start += BATCH_SIZE) {
        const batch = generated.slice(start, start + BATCH_SIZE);
        const inserted = await tx
          .insert(contacts)
          .values(batch.map((item) => item.contact))
          .returning({ id: contacts.id });

        const batchNotes = batch.flatMap((item, index) =>
          item.contactNotes.map((note) => ({ ...note, contactId: inserted[index].id })),
        );
        if (batchNotes.length > 0) {
          await tx.insert(notes).values(batchNotes);
        }
      }
    });

    const noteTotal = generated.reduce((sum, item) => sum + item.contactNotes.length, 0);
    console.log(`Seeded ${generated.length} contacts and ${noteTotal} notes.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
