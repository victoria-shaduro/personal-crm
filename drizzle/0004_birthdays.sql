ALTER TABLE "contacts" ADD COLUMN "birth_month" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_day" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_year" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_date_check" CHECK (
      ("contacts"."birth_month" IS NULL AND "contacts"."birth_day" IS NULL AND "contacts"."birth_year" IS NULL)
      OR ("contacts"."birth_month" IS NOT NULL AND "contacts"."birth_month" BETWEEN 1 AND 12
        AND "contacts"."birth_day" IS NOT NULL AND "contacts"."birth_day" BETWEEN 1 AND 31
        AND ("contacts"."birth_year" IS NULL OR "contacts"."birth_year" BETWEEN 1 AND 9999))
    );