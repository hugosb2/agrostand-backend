/**
 * @file FavoritoService.js
 * @description Camada de serviço: favoritar/desfavoritar (UC10, RN17) e
 * Meus Favoritos (UC11). toggle() é a ação do coração (liga/desliga).
 */

const AnuncioDAO = require('../dao/AnuncioDAO');
const FavoritoDAO = require('../dao/FavoritoDAO');
const logger = require('../utils/logger');
const { Favorito } = require('../domain/factories');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../errors/AppError');

function isUniqueViolation(error) {
  return String((error && error.message) || '').includes('UNIQUE constraint failed');
}

class FavoritoService {
  /**
   * Liga/desliga o favorito. Anúncio precisa existir e estar ATIVO,
   * senão "Anúncio indisponível" sem registrar nada (UC10 alt. 3).
   * @returns {Promise<{favoritado: boolean, id: number|null}>}
   */
  static async toggle({ clienteId, anuncioId }) {
    const numericId = Number(anuncioId);
    if (!numericId) {
      throw new BadRequestError('O anuncioId é obrigatório.');
    }

    const ad = await AnuncioDAO.findById(numericId, true);
    if (!ad || ad.status !== 'ATIVO') {
      throw new NotFoundError('Anúncio indisponível.');
    }

    const favoritoEnt = new Favorito({ clienteId, anuncioId: numericId });
    if (!favoritoEnt.validar()) {
      throw new BadRequestError('Favorito inválido.');
    }

    const existente = await FavoritoDAO.find(clienteId, numericId);
    if (existente) {
      await FavoritoDAO.deleteById(existente.id);
      logger.info('Anúncio desfavoritado', { userId: clienteId, anuncioId: numericId });
      return { favoritado: false, id: null };
    }

    try {
      const id = await FavoritoDAO.create({ clienteId, anuncioId: numericId });
      logger.info('Anúncio favoritado', { userId: clienteId, anuncioId: numericId });
      return { favoritado: true, id };
    } catch (error) {
      // Corrida: outro toggle criou primeiro — converge para desfavoritar
      if (isUniqueViolation(error)) {
        const atual = await FavoritoDAO.find(clienteId, numericId);
        if (atual) {
          await FavoritoDAO.deleteById(atual.id);
          return { favoritado: false, id: null };
        }
      }
      throw error;
    }
  }

  /** UC11: só os próprios, recentes primeiro, indisponíveis sinalizados. */
  static async list({ clienteId }) {
    const favoritos = await FavoritoDAO.listByCliente(clienteId);
    return { favoritos };
  }

  /** UC11 alt. 3: remover direto pela lista, com propriedade. */
  static async remove({ clienteId, id }) {
    const fav = await FavoritoDAO.findById(id);
    if (!fav) {
      throw new NotFoundError('Favorito não encontrado.');
    }
    if (fav.cliente_id !== clienteId) {
      throw new ForbiddenError('Você não tem permissão para remover favoritos de outros usuários.');
    }
    await FavoritoDAO.deleteById(id);
    logger.info('Favorito removido pela lista', { userId: clienteId, favoritoId: Number(id) });
  }
}

module.exports = FavoritoService;
