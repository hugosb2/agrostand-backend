/**
 * @file CategoriaController.js
 * @description Thin adapter HTTP para o catálogo de categorias (leitura pública).
 */

const CategoriaService = require('../services/CategoriaService');

class CategoriaController {
  /** @route GET /categories */
  static async list(req, res, next) {
    try {
      const data = await CategoriaService.list();
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CategoriaController;
