/**
 * @file BloqueioLoginDAO.js (Drizzle)
 * @description DAO do contador de falhas de login (RN19). Chave natural: e-mail.
 */

const { eq } = require('drizzle-orm');
const { getDb } = require('../db');
const { tentativasLogin } = require('../db/schema');

function toLegacy(row) {
  if (!row) return row;
  return {
    email: row.email,
    tentativas: row.tentativas,
    bloqueado_ate: row.bloqueadoAte,
    atualizado_em: row.atualizadoEm,
  };
}

class BloqueioLoginDAO {
  static findByEmail(email, client) {
    const database = client || getDb();
    const row = database.select().from(tentativasLogin).where(eq(tentativasLogin.email, email)).get();
    return row ? toLegacy(row) : row;
  }

  static salvar({ email, tentativas, bloqueadoAte }, client) {
    const database = client || getDb();
    database
      .insert(tentativasLogin)
      .values({ email, tentativas, bloqueadoAte: bloqueadoAte ?? null })
      .onConflictDoUpdate({
        target: tentativasLogin.email,
        set: {
          tentativas,
          bloqueadoAte: bloqueadoAte ?? null,
          atualizadoEm: new Date().toISOString(),
        },
      })
      .run();
    return true;
  }

  static deleteByEmail(email, client) {
    const database = client || getDb();
    database.delete(tentativasLogin).where(eq(tentativasLogin.email, email)).run();
    return true;
  }
}

module.exports = BloqueioLoginDAO;
