CREATE TABLE "groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	CONSTRAINT "groups_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_group_id_idx" ON "contacts" USING btree ("group_id");