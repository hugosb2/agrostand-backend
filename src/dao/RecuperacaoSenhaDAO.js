/**
 * @file RecuperacaoSenhaDAO.js (Drizzle)
 * @description DAO da tabela `RecuperacaoSenha` via Drizzle ORM.
 * (Camada DAO — as regras de negócio vivem nas entidades de `src/domain`.)
 * Retornos em snake_case legado.
 */

const { eq, and, desc } = require('drizzle-orm');
const { getDb } = require('../db');
const { recuperacaoSenhas } = require('../db/schema');

function toLegacy(row) {
  if (!row) return row;
  return {
    id: row.id,
    usuario_id: row.usuarioId,
    codigo: row.codigo,
    expira_em: row.expiraEm,
    usado: row.usado,
  };
}

class RecuperacaoSenhaDAO {
  static invalidateActiveByUsuarioId(usuarioId, client) {
    const database = client || getDb();
    database
      .update(recuperacaoSenhas)
      .set({ usado: 1 })
      .where(and(eq(recuperacaoSenhas.usuarioId, usuarioId), eq(recuperacaoSenhas.usado, 0)))
      .run();
    return true;
  }

  static create({ usuarioId, codigo, expiraEm }, client) {
    const database = client || getDb();
    const result = database
      .insert(recuperacaoSenhas)
      .values({ usuarioId, codigo, expiraEm, usado: 0 })
      .run();
    return Number(result.lastInsertRowid);
  }

  static findActiveByUsuarioAndCodigo(usuarioId, codigo, client) {
    const database = client || getDb();
    const row = database
      .select()
      .from(recuperacaoSenhas)
      .where(
        and(
          eq(recuperacaoSenhas.usuarioId, usuarioId),
          eq(recuperacaoSenhas.codigo, codigo),
          eq(recuperacaoSenhas.usado, 0)
        )
      )
      .orderBy(desc(recuperacaoSenhas.id))
      .limit(1)
      .get();
    return row ? toLegacy(row) : row;
  }

  static markAsUsed(id, client) {
    const database = client || getDb();
    database.update(recuperacaoSenhas).set({ usado: 1 }).where(eq(recuperacaoSenhas.id, id)).run();
    return true;
  }
}

module.exports = RecuperacaoSenhaDAO;
