/**
 * @file ImagemDAO.js (Drizzle)
 * @description DAO de imagens: persistência da tabela `Imagem` via Drizzle ORM.
 * (Camada DAO — as regras de negócio vivem nas entidades de `src/domain`.)
 * Retornos em snake_case legado (`anuncio_id`, ...). Métodos síncronos com `tx` opcional.
 */

const { eq } = require('drizzle-orm');
const { getDb } = require('../db');
const { imagens } = require('../db/schema');

function toLegacy(row) {
  if (!row) return row;
  return {
    id: row.id,
    anuncio_id: row.anuncioId,
    url: row.url,
    tipo: row.tipo,
    ordem: row.ordem,
  };
}

class ImagemDAO {
  static create({ anuncioId, url, tipo, ordem }, client) {
    const database = client || getDb();
    const result = database
      .insert(imagens)
      .values({ anuncioId: Number(anuncioId), url, tipo, ordem })
      .run();
    return Number(result.lastInsertRowid);
  }

  static findById(id, client) {
    const database = client || getDb();
    const row = database.select().from(imagens).where(eq(imagens.id, id)).get();
    return row ? toLegacy(row) : row;
  }

  static delete(id, client) {
    const database = client || getDb();
    database.delete(imagens).where(eq(imagens.id, id)).run();
    return true;
  }
}

module.exports = ImagemDAO;
