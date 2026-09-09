/**
 * @file index.js (src/db)
 * @description Conexão Drizzle ORM (better-sqlite3) + inicialização do banco.
 *
 * Substitui o antigo `src/config/bancoDeDados.js` (sqlite/sqlite3 + SQL cru).
 * - Uma única conexão better-sqlite3 (síncrona) envolvida pelo Drizzle.
 * - `PRAGMA foreign_keys = ON` preservado.
 * - DDL com `IF NOT EXISTS` para reaproveitar `database.sqlite` legado.
 * - Seed de categorias padrão se a tabela estiver vazia.
 * - Transações via `db.transaction((tx) => ...)` (síncronas — não usar await I/O dentro).
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { count } = require('drizzle-orm');
const schema = require('./schema');

// Caminho do arquivo SQLite. Permite override via env para testes/CI.
const dbPath =
  process.env.DATABASE_PATH || path.resolve(__dirname, '../../database.sqlite');

let sqlite = null;
let db = null;

function getSqlite() {
  if (sqlite) return sqlite;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  sqlite = new Database(dbPath);
  // Integridade referencial (era PRAGMA no driver antigo)
  sqlite.pragma('foreign_keys = ON');
  // WAL melhora concorrência leitura/escrita no Express
  try {
    sqlite.pragma('journal_mode = WAL');
  } catch {
    // ignora se o FS não suportar WAL
  }
  return sqlite;
}

function getDb() {
  if (db) return db;
  db = drizzle(getSqlite(), { schema });
  return db;
}

// Inicializa singleton no load para que os DAOs possam importar `db` diretamente.
getDb();

/**
 * Cria tabelas/índices se não existirem e popula categorias padrão.
 * Idempotente — seguro rodar em todo boot (preserva dados existentes).
 */
async function initializeDatabase() {
  const client = getSqlite();

  client.exec(`
    CREATE TABLE IF NOT EXISTS Usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      sobrenome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      telefone TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      data_cadastro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Endereco (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      rua TEXT NOT NULL,
      numero TEXT NOT NULL,
      bairro TEXT NOT NULL,
      cep TEXT,
      cidade TEXT NOT NULL,
      uf TEXT NOT NULL,
      zona TEXT NOT NULL CHECK(zona IN ('URBANA', 'RURAL')),
      FOREIGN KEY (cliente_id) REFERENCES Usuario(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Categoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      descricao TEXT
    );

    CREATE TABLE IF NOT EXISTS Anuncio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anunciante_id INTEGER NOT NULL,
      categoria_id INTEGER NOT NULL,
      endereco_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL,
      preco REAL NOT NULL,
      data_publicacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'ATIVO' CHECK(status IN ('ATIVO', 'EM_LIXEIRA', 'REMOVIDO')),
      data_remocao TEXT,
      FOREIGN KEY (anunciante_id) REFERENCES Usuario(id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_id) REFERENCES Categoria(id) ON DELETE RESTRICT,
      FOREIGN KEY (endereco_id) REFERENCES Endereco(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Imagem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anuncio_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('PRINCIPAL', 'SECUNDARIA')),
      ordem INTEGER NOT NULL,
      FOREIGN KEY (anuncio_id) REFERENCES Anuncio(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS RecuperacaoSenha (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      codigo TEXT NOT NULL,
      expira_em TEXT NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES Usuario(id) ON DELETE CASCADE
    );

    -- RN17: UNIQUE impede favoritar o mesmo anúncio duas vezes; CASCADEs
    -- limpam favoritos ao excluir conta (RN20) ou anúncio purgado
    CREATE TABLE IF NOT EXISTS Favorito (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      anuncio_id INTEGER NOT NULL,
      data_favorito TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES Usuario(id) ON DELETE CASCADE,
      FOREIGN KEY (anuncio_id) REFERENCES Anuncio(id) ON DELETE CASCADE,
      UNIQUE(cliente_id, anuncio_id)
    );

    CREATE INDEX IF NOT EXISTS idx_usuario_email ON Usuario(email);
    CREATE INDEX IF NOT EXISTS idx_endereco_cliente ON Endereco(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_anuncio_anunciante_status ON Anuncio(anunciante_id, status);
    CREATE INDEX IF NOT EXISTS idx_anuncio_categoria_status ON Anuncio(categoria_id, status);
    CREATE INDEX IF NOT EXISTS idx_anuncio_endereco ON Anuncio(endereco_id);
    CREATE INDEX IF NOT EXISTS idx_imagem_anuncio ON Imagem(anuncio_id);
    CREATE INDEX IF NOT EXISTS idx_recuperacaosenha_usuario ON RecuperacaoSenha(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_favorito_cliente ON Favorito(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_favorito_anuncio ON Favorito(anuncio_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_favorito_cliente_anuncio
      ON Favorito(cliente_id, anuncio_id);

    -- RN19: falhas consecutivas de login por e-mail (bloqueio temporário)
    CREATE TABLE IF NOT EXISTS TentativaLogin (
      email TEXT PRIMARY KEY,
      tentativas INTEGER NOT NULL DEFAULT 0,
      bloqueado_ate TEXT,
      atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tentativalogin_bloqueio ON TentativaLogin(bloqueado_ate);

    -- UC13: denylist de JWTs revogados no logout (purgada de forma amortizada)
    CREATE TABLE IF NOT EXISTS TokenRevogado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em TEXT NOT NULL,
      revogado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tokenrevogado_hash ON TokenRevogado(token_hash);
    CREATE INDEX IF NOT EXISTS idx_tokenrevogado_expira ON TokenRevogado(expira_em);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_anuncio_imagem_principal
      ON Imagem(anuncio_id) WHERE tipo = 'PRINCIPAL';
  `);

  // Seed de categorias via Drizzle (contagem + insert)
  // NOTE(better-sqlite3): a API é síncrona — execução exige .all()/.get()/.run().
  const database = getDb();
  const [{ value: total }] = database
    .select({ value: count() })
    .from(schema.categorias)
    .all();

  if (total === 0) {
    const defaults = [
      { nome: 'Frutas', descricao: 'Frutas frescas colhidas diretamente do produtor' },
      { nome: 'Legumes', descricao: 'Legumes e hortaliças frescas e variadas' },
      { nome: 'Verduras', descricao: 'Folhas verdes e ervas frescas' },
      { nome: 'Grãos', descricao: 'Grãos, cereais, feijão, arroz e sementes' },
      { nome: 'Outros', descricao: 'Outros produtos agrícolas e derivados artesanais' },
    ];
    database.insert(schema.categorias).values(defaults).run();
  }

  console.log('Database initialized successfully (Drizzle).');
}

function closeDatabase() {
  if (sqlite) {
    try {
      sqlite.close();
    } catch {
      // ignora erro de fechamento duplo
    }
    sqlite = null;
    db = null;
  }
}

module.exports = {
  getDb,
  initializeDatabase,
  closeDatabase,
};
