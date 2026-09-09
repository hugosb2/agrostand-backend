/**
 * @file EnderecoDAO.js (Drizzle)
 * @description DAO de endereços: persistência da tabela `Endereco` via Drizzle ORM.
 * (Camada DAO — as regras de negócio vivem nas entidades de `src/domain`.)
 * Retornos preservam o legado snake_case (`cliente_id`, ...).
 * Métodos síncronos — aceitam `tx` opcional para transações.
 */

const { eq } = require('drizzle-orm');
const { getDb } = require('../db');
const { enderecos } = require('../db/schema');

function toLegacy(row) {
  if (!row) return row;
  return {
    id: row.id,
    cliente_id: row.clienteId,
    rua: row.rua,
    numero: row.numero,
    bairro: row.bairro,
    cep: row.cep,
    cidade: row.cidade,
    uf: row.uf,
    zona: row.zona,
  };
}

class EnderecoDAO {
  static create({ clienteId, rua, numero, bairro, cep, cidade, uf, zona }, client) {
    const database = client || getDb();
    const result = database
      .insert(enderecos)
      .values({
        clienteId,
        rua,
        numero,
        bairro,
        cep: cep ?? null,
        cidade,
        uf,
        zona: zona.toUpperCase(),
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  static findById(id, client) {
    const database = client || getDb();
    const row = database.select().from(enderecos).where(eq(enderecos.id, id)).get();
    return row ? toLegacy(row) : row;
  }

  static findByClienteId(clienteId, client) {
    const database = client || getDb();
    const rows = database
      .select()
      .from(enderecos)
      .where(eq(enderecos.clienteId, clienteId))
      .all();
    return rows.map(toLegacy);
  }

  static update(id, { rua, numero, bairro, cep, cidade, uf, zona }, client) {
    const database = client || getDb();
    database
      .update(enderecos)
      .set({ rua, numero, bairro, cep: cep ?? null, cidade, uf, zona: zona.toUpperCase() })
      .where(eq(enderecos.id, id))
      .run();
    return true;
  }

  static delete(id, client) {
    const database = client || getDb();
    database.delete(enderecos).where(eq(enderecos.id, id)).run();
    return true;
  }
}

module.exports = EnderecoDAO;
