/**
 * @file schema.js
 * @description Schema Drizzle ORM — fonte única de verdade das tabelas SQLite.
 *
 * Convenções:
 * - Nomes de TABELAS e COLUNAS preservam o legado (Usuario, Endereco, ... + snake_case)
 *   para reutilizar o arquivo `database.sqlite` existente sem migração destrutiva.
 * - Nomes de PROPRIEDADES JS usam camelCase idiomático do Drizzle
 *   (ex: `clienteId` <-> coluna `cliente_id`).
 * - A camada de DAOs (`src/dao`) traduz a saída para o formato snake_case legado
 *   esperado pelos Controllers (`cliente_id`, `senha_hash`, `anunciante_id`, ...),
 *   mantendo a API HTTP estável.
 */

const { sqliteTable, text, integer, real, index, uniqueIndex, check } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');

// ─── Usuario ───
const usuarios = sqliteTable(
  'Usuario',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nome: text('nome').notNull(),
    sobrenome: text('sobrenome').notNull(),
    email: text('email').notNull().unique(),
    telefone: text('telefone').notNull(),
    senhaHash: text('senha_hash').notNull(),
    dataCadastro: text('data_cadastro')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index('idx_usuario_email').on(t.email),
  ]
);

// ─── Endereco ───
const enderecos = sqliteTable(
  'Endereco',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    rua: text('rua').notNull(),
    numero: text('numero').notNull(),
    bairro: text('bairro').notNull(),
    cep: text('cep'),
    cidade: text('cidade').notNull(),
    uf: text('uf').notNull(),
    zona: text('zona').notNull(),
  },
  (t) => [
    index('idx_endereco_cliente').on(t.clienteId),
    check('chk_endereco_zona', sql`${t.zona} IN ('URBANA', 'RURAL')`),
  ]
);

// ─── Categoria ───
const categorias = sqliteTable('Categoria', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull().unique(),
  descricao: text('descricao'),
});

// ─── Anuncio ───
const anuncios = sqliteTable(
  'Anuncio',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anuncianteId: integer('anunciante_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    categoriaId: integer('categoria_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'restrict' }),
    enderecoId: integer('endereco_id')
      .notNull()
      .references(() => enderecos.id, { onDelete: 'restrict' }),
    nome: text('nome').notNull(),
    descricao: text('descricao').notNull(),
    preco: real('preco').notNull(),
    dataPublicacao: text('data_publicacao')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    status: text('status').default('ATIVO').notNull(),
    dataRemocao: text('data_remocao'),
  },
  (t) => [
    index('idx_anuncio_anunciante_status').on(t.anuncianteId, t.status),
    index('idx_anuncio_categoria_status').on(t.categoriaId, t.status),
    index('idx_anuncio_endereco').on(t.enderecoId),
    check(
      'chk_anuncio_status',
      sql`${t.status} IN ('ATIVO', 'EM_LIXEIRA', 'REMOVIDO')`
    ),
  ]
);

// ─── Imagem ───
const imagens = sqliteTable(
  'Imagem',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anuncioId: integer('anuncio_id')
      .notNull()
      .references(() => anuncios.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    tipo: text('tipo').notNull(),
    ordem: integer('ordem').notNull(),
  },
  (t) => [
    index('idx_imagem_anuncio').on(t.anuncioId),
    check('chk_imagem_tipo', sql`${t.tipo} IN ('PRINCIPAL', 'SECUNDARIA')`),
    // Garante no nível do banco no máximo 1 PRINCIPAL por anúncio.
    // Equivalente ao índice parcial legado:
    //   CREATE UNIQUE INDEX ... ON Imagem(anuncio_id) WHERE tipo = 'PRINCIPAL'
    uniqueIndex('idx_anuncio_imagem_principal')
      .on(t.anuncioId)
      .where(sql`${t.tipo} = 'PRINCIPAL'`),
  ]
);

// ─── RecuperacaoSenha ───
const recuperacaoSenhas = sqliteTable(
  'RecuperacaoSenha',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    codigo: text('codigo').notNull(),
    expiraEm: text('expira_em').notNull(),
    usado: integer('usado').default(0).notNull(),
  },
  (t) => [index('idx_recuperacaosenha_usuario').on(t.usuarioId)]
);

// ─── Favorito ───
// RN17: um cliente não favorita o mesmo anúncio duas vezes (UNIQUE).
const favoritos = sqliteTable(
  'Favorito',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    anuncioId: integer('anuncio_id')
      .notNull()
      .references(() => anuncios.id, { onDelete: 'cascade' }),
    dataFavorito: text('data_favorito')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index('idx_favorito_cliente').on(t.clienteId),
    index('idx_favorito_anuncio').on(t.anuncioId),
    uniqueIndex('uq_favorito_cliente_anuncio').on(t.clienteId, t.anuncioId),
  ]
);

// ─── TentativaLogin (RN19) ───
// Contador de falhas consecutivas por e-mail para bloqueio temporário.
// Sem janela de expiração: só um login bem-sucedido zera a contagem.
const tentativasLogin = sqliteTable(
  'TentativaLogin',
  {
    email: text('email').primaryKey(),
    tentativas: integer('tentativas').default(0).notNull(),
    bloqueadoAte: text('bloqueado_ate'),
    atualizadoEm: text('atualizado_em')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [index('idx_tentativalogin_bloqueio').on(t.bloqueadoAte)]
);

// ─── TokenRevogado (UC13 logout) ───
// Denylist de JWTs: guarda o hash SHA-256 do token até sua expiração.
// Linhas expiradas são purgadas de forma amortizada a cada logout.
const tokensRevogados = sqliteTable(
  'TokenRevogado',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenHash: text('token_hash').notNull().unique(),
    expiraEm: text('expira_em').notNull(),
    revogadoEm: text('revogado_em')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index('idx_tokenrevogado_hash').on(t.tokenHash),
    index('idx_tokenrevogado_expira').on(t.expiraEm),
  ]
);

module.exports = {
  usuarios,
  enderecos,
  categorias,
  anuncios,
  imagens,
  recuperacaoSenhas,
  favoritos,
  tentativasLogin,
  tokensRevogados,
};
