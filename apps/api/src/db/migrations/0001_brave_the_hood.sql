CREATE TABLE `book_page_translations` (
	`page_id` text NOT NULL,
	`locale` text NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`page_id`, `locale`),
	FOREIGN KEY (`page_id`) REFERENCES `book_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "book_page_translations_locale_check" CHECK("book_page_translations"."locale" in ('id'))
);
--> statement-breakpoint
CREATE TABLE `book_translations` (
	`book_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	PRIMARY KEY(`book_id`, `locale`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "book_translations_locale_check" CHECK("book_translations"."locale" in ('id'))
);
