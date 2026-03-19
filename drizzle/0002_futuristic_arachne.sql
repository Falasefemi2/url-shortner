ALTER TABLE "links" ALTER COLUMN "short_link" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "clicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_short_link_unique" UNIQUE("short_link");