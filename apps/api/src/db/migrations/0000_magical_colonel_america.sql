DO $$ BEGIN
 CREATE TYPE "health_check_status" AS ENUM('healthy', 'unhealthy', 'timeout', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "permission" AS ENUM('discover', 'view_details', 'execute');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "server_status" AS ENUM('healthy', 'unhealthy', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('admin', 'developer', 'viewer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid,
	"capability_id" uuid,
	"user_id" uuid,
	"role" varchar(50),
	"team_id" varchar(100),
	"permission" "permission" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"permissions" jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"tags" text[] DEFAULT  NOT NULL,
	"schema" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"status" "health_check_status" NOT NULL,
	"response_time_ms" integer NOT NULL,
	"status_code" integer,
	"error_message" text,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability_id" uuid NOT NULL,
	"uri" varchar(2048) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"mime_type" varchar(100),
	"schema" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"url" varchar(2048) NOT NULL,
	"health_endpoint" varchar(2048),
	"status" "server_status" DEFAULT 'unknown' NOT NULL,
	"last_health_check" timestamp,
	"health_check_interval" integer DEFAULT 60 NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"registered_by" uuid,
	"metadata" jsonb,
	CONSTRAINT "servers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"input_schema" jsonb NOT NULL,
	"output_schema" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "api_keys" ("key_prefix");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "servers" ADD CONSTRAINT "servers_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tools" ADD CONSTRAINT "tools_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
