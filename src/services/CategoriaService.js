/**
 * @file CategoriaService.js
 * @description Camada de serviço: catálogo de categorias (leitura pública).
 */

const CategoriaDAO = require('../dao/CategoriaDAO');

class CategoriaService {
  static async list() {
    const categories = await CategoriaDAO.findAll();
    return { categorias: categories };
  }
}

module.exports = CategoriaService;
