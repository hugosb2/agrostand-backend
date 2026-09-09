/**
 * @file UsuarioDAO.js (Drizzle)
 * @description DAO de usuários: persistência da tabela `Usuario` via Drizzle ORM.
 * (Camada DAO — as regras de negócio vivem nas entidades de `src/domain`.)
 *
 * Compatibilidade:
 * - Assinaturas e formatos de retorno preservam o legado (snake_case:
 *   `senha_hash`, `data_cadastro`, ...).
 * - Métodos são SÍNCRONOS (better-sqlite3 é síncrono). Os Controllers podem
 *   continuar usando `await` — aguardar um valor não-Promise é inofensivo —
 *   e o mesmo método funciona dentro de `db.transaction((tx) => ...)`.
 * - Passe `tx` como último argumento para rodar dentro de uma transação:
 *   `UsuarioDAO.create(dados, tx)`.
 */

const { eq } = require('drizzle-orm');
const { getDb } = require('../db');
const { usuarios } = require('../db/schema');

function toPublic(row) {
  if (!row) return row;
  return {
    id: row.id,
    nome: row.nome,
    sobrenome: row.sobrenome,
    email: row.email,
    telefone: row.telefone,
    data_cadastro: row.dataCadastro,
  };
}

function toFull(row) {
  if (!row) return row;
  return {
    ...toPublic(row),
    senha_hash: row.senhaHash,
  };
}

class UsuarioDAO {
  static create({ nome, sobrenome, email, telefone, senhaHash }, client) {
    const database = client || getDb();
    const result = database
      .insert(usuarios)
      .values({ nome, sobrenome, email, telefone, senhaHash })
      .run();
    return Number(result.lastInsertRowid);
  }

  static findById(id, client) {
    const database = client || getDb();
    const row = database
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        sobrenome: usuarios.sobrenome,
        email: usuarios.email,
        telefone: usuarios.telefone,
        dataCadastro: usuarios.dataCadastro,
      })
      .from(usuarios)
      .where(eq(usuarios.id, id))
      .get();
    return row ? toPublic(row) : row;
  }

  static findByIdWithPassword(id, client) {
    const database = client || getDb();
    const row = database.select().from(usuarios).where(eq(usuarios.id, id)).get();
    return row ? toFull(row) : row;
  }

  static findByEmail(email, client) {
    const database = client || getDb();
    const row = database.select().from(usuarios).where(eq(usuarios.email, email)).get();
    return row ? toFull(row) : row;
  }

  static update(id, { nome, sobrenome, email, telefone }, client) {
    const database = client || getDb();
    database
      .update(usuarios)
      .set({ nome, sobrenome, email, telefone })
      .where(eq(usuarios.id, id))
      .run();
    return true;
  }

  static updatePassword(id, senhaHash, client) {
    const database = client || getDb();
    database.update(usuarios).set({ senhaHash }).where(eq(usuarios.id, id)).run();
    return true;
  }

  /** RS03 LGPD: CASCADE remove endereços/anúncios/imagens/recuperações. */
  static delete(id, client) {
    const database = client || getDb();
    database.delete(usuarios).where(eq(usuarios.id, id)).run();
    return true;
  }
}

module.exports = UsuarioDAO;
