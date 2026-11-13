ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_interval_days" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "next_contact_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "contacts_next_contact_at_id_idx" ON "contacts" USING btree ("next_contact_at","id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_keep_in_touch_check" CHECK (
      ("contacts"."keep_in_touch_interval_days" IS NULL AND "contacts"."next_contact_at" IS NULL)
      OR ("contacts"."keep_in_touch_interval_days" IS NOT NULL
        AND "contacts"."keep_in_touch_interval_days" IN (7, 30, 90, 365)
        AND "contacts"."next_contact_at" IS NOT NULL)
    );