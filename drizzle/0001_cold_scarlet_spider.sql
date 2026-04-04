ALTER TABLE "billing_customer" RENAME COLUMN "stripe_customer_id" TO "provider_customer_id";--> statement-breakpoint
ALTER TABLE "billing_customer" RENAME COLUMN "stripe_subscription_id" TO "provider_subscription_id";--> statement-breakpoint
ALTER TABLE "billing_customer" RENAME COLUMN "stripe_price_id" TO "provider_plan_id";--> statement-breakpoint
DROP INDEX "billing_customer_stripe_customer_unique";--> statement-breakpoint
ALTER TABLE "billing_customer" ADD COLUMN "provider" text DEFAULT 'xendit' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customer_provider_customer_unique" ON "billing_customer" USING btree ("provider_customer_id");