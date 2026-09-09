CREATE TABLE `TentativaLogin` (
	`email` text PRIMARY KEY NOT NULL,
	`tentativas` integer DEFAULT 0 NOT NULL,
	`bloqueado_ate` text,
	`atualizado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tentativalogin_bloqueio` ON `TentativaLogin` (`bloqueado_ate`);--> statement-breakpoint
CREATE TABLE `TokenRevogado` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`expira_em` text NOT NULL,
	`revogado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TokenRevogado_token_hash_unique` ON `TokenRevogado` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_tokenrevogado_hash` ON `TokenRevogado` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_tokenrevogado_expira` ON `TokenRevogado` (`expira_em`);