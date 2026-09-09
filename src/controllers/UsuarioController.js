/**
 * @file UsuarioController.js
 * @description Thin adapter HTTP para perfil/conta. Regras no UsuarioService;
 * exclusão definitiva (LGPD) em cascata no DAO.
 */

const UsuarioService = require('../services/UsuarioService');

class UsuarioController {
  /**
   * @route GET /users/profile
   * Sem regra de negócio — retorna o usuário já anexado pelo authMiddleware.
   */
  static async getProfile(req, res, next) {
    try {
      return res.status(200).json({
        status: 'success',
        data: {
          usuario: req.user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /** @route PUT /users/profile */
  static async updateProfile(req, res, next) {
    try {
      const usuario = await UsuarioService.updateProfile({
        userId: req.user.id,
        userPublic: req.user,
        ...req.body,
        ip: req.ip,
      });
      return res.status(200).json({
        status: 'success',
        message: 'Dados cadastrais atualizados com sucesso.',
        data: { usuario }
      });
    } catch (error) {
      next(error);
    }
  }

  /** @route PUT /users/password */
  static async updatePassword(req, res, next) {
    try {
      await UsuarioService.updatePassword({ userId: req.user.id, ...req.body, ip: req.ip });
      return res.status(200).json({
        status: 'success',
        message: 'Senha atualizada com sucesso.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route DELETE /users/account
   * RS03 LGPD: exclusão definitiva da conta e dados associados.
   */
  static async deleteAccount(req, res, next) {
    try {
      await UsuarioService.deleteAccount({ userId: req.user.id, ip: req.ip });
      return res.status(200).json({
        status: 'success',
        message: 'Sua conta e todos os dados associados foram excluídos com sucesso, em conformidade com a LGPD.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UsuarioController;
