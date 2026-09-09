/**
 * @file TokenRevogadoDAO.js (Drizzle)
 * @description Denylist de JWTs (UC13 logout). Guarda o hash do token até a
 * expiração original; purge amortizado nas escritas.
 */

const { eq, lt } = require('drizzle-orm');
const { getDb } = require('../db');
const { tokensRevogados } = require('../db/schema');

class TokenRevogadoDAO {
  static existePorHash(tokenHash, client) {
    const database = client || getDb();
    const row = database
      .select({ id: tokensRevogados.id })
      .from(tokensRevogados)
      .where(eq(tokensRevogados.tokenHash, tokenHash))
      .get();
    return !!row;
  }

  static adicionar({ tokenHash, expiraEm }, client) {
    const database = client || getDb();
    database
      .insert(tokensRevogados)
      .values({ tokenHash, expiraEm })
      .onConflictDoNothing({ target: tokensRevogados.tokenHash })
      .run();
    // Amortizado: limpa expirados a cada revogação (sem write por request)
    database
      .delete(tokensRevogados)
      .where(lt(tokensRevogados.expiraEm, new Date().toISOString()))
      .run();
    return true;
  }
}

module.exports = TokenRevogadoDAO;
