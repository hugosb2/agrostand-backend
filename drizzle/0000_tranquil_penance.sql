CREATE TABLE `Usuario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`sobrenome` text NOT NULL,
	`email` text NOT NULL,
	`telefone` text NOT NULL,
	`senha_hash` text NOT NULL,
	`data_cadastro` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Usuario_email_unique` ON `Usuario` (`email`);--> statement-breakpoint
CREATE INDEX `idx_usuario_email` ON `Usuario` (`email`);--> statement-breakpoint
CREATE TABLE `Endereco` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`rua` text NOT NULL,
	`numero` text NOT NULL,
	`bairro` text NOT NULL,
	`cep` text,
	`cidade` text NOT NULL,
	`uf` text NOT NULL,
	`zona` text NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `Usuario`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_endereco_zona" CHECK("Endereco"."zona" IN ('URBANA', 'RURAL'))
);
--> statement-breakpoint
CREATE INDEX `idx_endereco_cliente` ON `Endereco` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `Categoria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`descricao` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Categoria_nome_unique` ON `Categoria` (`nome`);--> statement-breakpoint
CREATE TABLE `Anuncio` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anunciante_id` integer NOT NULL,
	`categoria_id` integer NOT NULL,
	`endereco_id` integer NOT NULL,
	`nome` text NOT NULL,
	`descricao` text NOT NULL,
	`preco` real NOT NULL,
	`data_publicacao` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	`data_remocao` text,
	FOREIGN KEY (`anunciante_id`) REFERENCES `Usuario`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categoria_id`) REFERENCES `Categoria`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`endereco_id`) REFERENCES `Endereco`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_anuncio_status" CHECK("Anuncio"."status" IN ('ATIVO', 'EM_LIXEIRA', 'REMOVIDO'))
);
--> statement-breakpoint
CREATE INDEX `idx_anuncio_anunciante_status` ON `Anuncio` (`anunciante_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_anuncio_categoria_status` ON `Anuncio` (`categoria_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_anuncio_endereco` ON `Anuncio` (`endereco_id`);--> statement-breakpoint
CREATE TABLE `Imagem` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anuncio_id` integer NOT NULL,
	`url` text NOT NULL,
	`tipo` text NOT NULL,
	`ordem` integer NOT NULL,
	FOREIGN KEY (`anuncio_id`) REFERENCES `Anuncio`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_imagem_tipo" CHECK("Imagem"."tipo" IN ('PRINCIPAL', 'SECUNDARIA'))
);
--> statement-breakpoint
CREATE INDEX `idx_imagem_anuncio` ON `Imagem` (`anuncio_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_anuncio_imagem_principal` ON `Imagem` (`anuncio_id`) WHERE "Imagem"."tipo" = 'PRINCIPAL';--> statement-breakpoint
CREATE TABLE `RecuperacaoSenha` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`codigo` text NOT NULL,
	`expira_em` text NOT NULL,
	`usado` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `Usuario`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_recuperacaosenha_usuario` ON `RecuperacaoSenha` (`usuario_id`);