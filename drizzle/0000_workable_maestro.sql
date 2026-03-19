CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_link" varchar NOT NULL,
	"long_link" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
