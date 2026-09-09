/**
 * @file EnderecoController.js
 * @description Thin adapter HTTP para o CRUD de endereços. Regras
 * (propriedade, invariante de completude, zona) no EnderecoService.
 */

const EnderecoService = require('../services/EnderecoService');

class EnderecoController {
  /** @route GET /addresses */
  static async list(req, res, next) {
    try {
      const data = await EnderecoService.list({ userId: req.user.id });
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  /** @route POST /addresses */
  static async create(req, res, next) {
    try {
      const data = await EnderecoService.create({ userId: req.user.id, ...req.body });
      return res.status(201).json({
        status: 'success',
        message: 'Endereço cadastrado com sucesso.',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /** @route PUT /addresses/:id */
  static async update(req, res, next) {
    try {
      const data = await EnderecoService.update({ userId: req.user.id, id: req.params.id, ...req.body });
      return res.status(200).json({
        status: 'success',
        message: 'Endereço atualizado com sucesso.',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /** @route DELETE /addresses/:id */
  static async delete(req, res, next) {
    try {
      await EnderecoService.delete({ userId: req.user.id, id: req.params.id });
      return res.status(200).json({
        status: 'success',
        message: 'Endereço removido com sucesso.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EnderecoController;
