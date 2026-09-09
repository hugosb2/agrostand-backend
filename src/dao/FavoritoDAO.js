/**
 * @file FavoritoDAO.js (Drizzle)
 * @description DAO de favoritos: persistência da tabela `Favorito` via Drizzle ORM.
 * (Camada DAO — as regras de negócio vivem nas entidades de `src/domain`.)
 * RN17: UNIQUE(cliente_id, anuncio_id). CASCADEs limpam ao excluir conta/anúncio.
 */

const { eq, and, desc } = require('drizzle-orm');
const { getDb } = require('../db');
const { favoritos, anuncios, imagens } = require('../db/schema');

function toLegacy(row) {
  if (!row) return row;
  return {
    id: row.id,
    cliente_id: row.clienteId,
    anuncio_id: row.anuncioId,
    data_favorito: row.dataFavorito,
  };
}

class FavoritoDAO {
  static find(clienteId, anuncioId, client) {
    const database = client || getDb();
    const row = database
      .select()
      .from(favoritos)
      .where(and(eq(favoritos.clienteId, clienteId), eq(favoritos.anuncioId, Number(anuncioId))))
      .get();
    return row ? toLegacy(row) : row;
  }

  static findById(id, client) {
    const database = client || getDb();
    const row = database.select().from(favoritos).where(eq(favoritos.id, Number(id))).get();
    return row ? toLegacy(row) : row;
  }

  static create({ clienteId, anuncioId }, client) {
    const database = client || getDb();
    const result = database
      .insert(favoritos)
      .values({ clienteId, anuncioId: Number(anuncioId) })
      .run();
    return Number(result.lastInsertRowid);
  }

  static deleteById(id, client) {
    const database = client || getDb();
    database.delete(favoritos).where(eq(favoritos.id, Number(id))).run();
    return true;
  }

  /**
   * UC11: favoritos do cliente com dados do anúncio (LEFT JOIN — anúncio
   * purgado aparece como `anuncio: null`) + imagem principal, do mais
   * recente ao mais antigo (id como desempate do timestamp de 1s).
   */
  static listByCliente(clienteId, client) {
    const database = client || getDb();
    const rows = database
      .select({
        id: favoritos.id,
        cliente_id: favoritos.clienteId,
        anuncio_id: favoritos.anuncioId,
        data_favorito: favoritos.dataFavorito,
        anuncio_nome: anuncios.nome,
        anuncio_preco: anuncios.preco,
        anuncio_status: anuncios.status,
        imagem_principal: imagens.url,
      })
      .from(favoritos)
      .leftJoin(anuncios, eq(favoritos.anuncioId, anuncios.id))
      .leftJoin(
        imagens,
        and(eq(imagens.anuncioId, anuncios.id), eq(imagens.tipo, 'PRINCIPAL'))
      )
      .where(eq(favoritos.clienteId, clienteId))
      .orderBy(desc(favoritos.dataFavorito), desc(favoritos.id))
      .all();

    return rows.map((r) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      anuncio_id: r.anuncio_id,
      data_favorito: r.data_favorito,
      disponivel: r.anuncio_status === 'ATIVO',
      anuncio: r.anuncio_nome
        ? {
            id: r.anuncio_id,
            nome: r.anuncio_nome,
            preco: r.anuncio_preco,
            status: r.anuncio_status,
            imagem_principal: r.imagem_principal ?? null,
          }
        : null,
    }));
  }
}

module.exports = FavoritoDAO;
