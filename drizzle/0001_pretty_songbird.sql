CREATE TABLE `Favorito` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`anuncio_id` integer NOT NULL,
	`data_favorito` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `Usuario`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`anuncio_id`) REFERENCES `Anuncio`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_favorito_cliente` ON `Favorito` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `idx_favorito_anuncio` ON `Favorito` (`anuncio_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_favorito_cliente_anuncio` ON `Favorito` (`cliente_id`,`anuncio_id`);