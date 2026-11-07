CREATE TABLE `book_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`text` text NOT NULL,
	`image_url` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "book_pages_number_check" CHECK("book_pages"."page_number" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_pages_book_page_idx` ON `book_pages` (`book_id`,`page_number`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`title` text NOT NULL,
	`author_name` text NOT NULL,
	`description` text NOT NULL,
	`cover_url` text NOT NULL,
	`age_min` integer NOT NULL,
	`age_max` integer NOT NULL,
	`price_idr` integer NOT NULL,
	`status` text NOT NULL,
	`preview_page_count` integer DEFAULT 2 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "books_status_check" CHECK("books"."status" in ('published', 'archived')),
	CONSTRAINT "books_price_check" CHECK("books"."price_idr" > 0),
	CONSTRAINT "books_preview_check" CHECK("books"."preview_page_count" >= 0),
	CONSTRAINT "books_age_check" CHECK("books"."age_min" <= "books"."age_max")
);
--> statement-breakpoint
CREATE INDEX `books_status_created_idx` ON `books` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `books_creator_idx` ON `books` (`creator_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`book_id` text,
	`props` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_name_created_idx` ON `events` (`name`,`created_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`book_id` text,
	`plan_id` text,
	`amount_idr` integer NOT NULL,
	`status` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`subscription_overlap_ack` integer DEFAULT false NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`provider_ref` text,
	`failure_reason` text,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_type_check" CHECK("orders"."type" in ('book', 'subscription')),
	CONSTRAINT "orders_status_check" CHECK("orders"."status" in ('pending', 'paid', 'failed')),
	CONSTRAINT "orders_amount_check" CHECK("orders"."amount_idr" > 0),
	CONSTRAINT "orders_target_check" CHECK(("orders"."type" = 'book' and "orders"."book_id" is not null) or ("orders"."type" = 'subscription' and "orders"."plan_id" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_user_idempotency_idx` ON `orders` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_idr` integer NOT NULL,
	`period_days` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "plans_price_check" CHECK("plans"."price_idr" > 0),
	CONSTRAINT "plans_period_check" CHECK("plans"."period_days" > 0)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`order_id` text NOT NULL,
	`price_paid_idr` integer NOT NULL,
	`purchased_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_user_book_idx` ON `purchases` (`user_id`,`book_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text NOT NULL,
	`current_period_start` integer NOT NULL,
	`current_period_end` integer NOT NULL,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_order_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subscriptions_status_check" CHECK("subscriptions"."status" in ('active', 'expired')),
	CONSTRAINT "subscriptions_period_check" CHECK("subscriptions"."current_period_end" > "subscriptions"."current_period_start")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_one_active_idx` ON `subscriptions` (`user_id`) WHERE "subscriptions"."status" = 'active';--> statement-breakpoint
CREATE INDEX `subscriptions_user_status_idx` ON `subscriptions` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pin_hash` text,
	`pin_failed_attempts` integer DEFAULT 0 NOT NULL,
	`pin_locked_until` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('parent', 'creator'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);