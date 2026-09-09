/**
 * @file FavoritoController.js
 * @description Thin adapter HTTP para favoritos (UC10/UC11).
 */

const FavoritoService = require('../services/FavoritoService');

class FavoritoController {
  /** POST /favorites/toggle — liga/desliga o coração. */
  static async toggle(req, res, next) {
    try {
      const result = await FavoritoService.toggle({
        clienteId: req.user.id,
        anuncioId: req.body.anuncioId,
      });
      return res.status(200).json({
        status: 'success',
        message: result.favoritado ? 'Anúncio adicionado aos favoritos.' : 'Anúncio removido dos favoritos.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /** GET /favorites — Meus Favoritos. */
  static async list(req, res, next) {
    try {
      const data = await FavoritoService.list({ clienteId: req.user.id });
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /favorites/:id — remove direto pela lista. */
  static async remove(req, res, next) {
    try {
      await FavoritoService.remove({ clienteId: req.user.id, id: req.params.id });
      return res.status(200).json({
        status: 'success',
        message: 'Favorito removido com sucesso.',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FavoritoController;
