CREATE TABLE IF NOT EXISTS "refresh_token_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family" varchar(64) NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "servers" DROP CONSTRAINT "servers_registered_by_users_id_fk";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rtf_user_idx" ON "refresh_token_families" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capabilities_server_idx" ON "capabilities" ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capabilities_category_idx" ON "capabilities" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "health_checks_server_checked_idx" ON "health_checks" ("server_id","checked_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "servers" ADD CONSTRAINT "servers_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_token_families" ADD CONSTRAINT "refresh_token_families_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
