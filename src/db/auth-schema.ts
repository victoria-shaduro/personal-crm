import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const date = (name: string) => timestamp(name, { withTimezone: true });
const auditDates = () => ({
  createdAt: date("created_at").defaultNow().notNull(),
  updatedAt: date("updated_at").defaultNow().notNull(),
});

export const user = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...auditDates(),
});

export const session = pgTable("auth_session", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  token: text("token").unique().notNull(),
  expiresAt: date("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...auditDates(),
}, (table) => [index("session_user_idx").on(table.userId)]);

export const account = pgTable("auth_account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: date("access_token_expires_at"),
  refreshTokenExpiresAt: date("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  ...auditDates(),
});

export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: date("expires_at").notNull(),
  ...auditDates(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const mailDelivery = pgTable("mail_delivery", {
  fingerprint: text("fingerprint").primaryKey(),
  email: text("email").notNull(),
  sentAt: date("sent_at").defaultNow().notNull(),
  active: boolean("active").default(true).notNull(),
}, (table) => [index("mail_delivery_email_time_idx").on(table.email, table.sentAt)]);
