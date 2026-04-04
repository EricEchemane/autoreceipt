CREATE TABLE "receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_file_name" text NOT NULL,
	"source_file_url" text NOT NULL,
	"source_mime_type" text NOT NULL,
	"source_file_hash" text NOT NULL,
	"receipt_fingerprint" text,
	"merchant_name" text NOT NULL,
	"tin_number" text NOT NULL,
	"official_receipt_number" text NOT NULL,
	"total_amount_due" integer NOT NULL,
	"taxable_sales" integer NOT NULL,
	"vat_amount" integer NOT NULL,
	"confidence" integer NOT NULL,
	"purchase_date" text NOT NULL,
	"notes" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_id_user_unique" ON "receipt" USING btree ("user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_user_hash_unique" ON "receipt" USING btree ("user_id","source_file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_user_fingerprint_unique" ON "receipt" USING btree ("user_id","receipt_fingerprint");