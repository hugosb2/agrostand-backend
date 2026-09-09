/**
 * @file AutenticacaoController.js
 * @description Thin adapter HTTP: extrai entrada, delega ao AutenticacaoService
 * e monta o envelope de resposta. Erros de negócio (AppError) vão ao
 * errorMiddleware via next() — sem try/catch de regra aqui.
 */

const AutenticacaoService = require('../services/AutenticacaoService');

class AutenticacaoController {
  static async register(req, res, next) {
    try {
      const { token, usuario } = await AutenticacaoService.register({ ...req.body, ip: req.ip });
      return res.status(201).json({
        status: 'success',
        message: 'Cadastro realizado com sucesso.',
        data: { token, usuario },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { token, usuario } = await AutenticacaoService.login(req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Autenticação bem-sucedida.',
        data: { token, usuario },
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      await AutenticacaoService.forgotPassword(req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Se o e-mail informado estiver cadastrado, um código de verificação será enviado.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      await AutenticacaoService.resetPassword({ ...req.body, ip: req.ip });
      return res.status(200).json({
        status: 'success',
        message: 'Senha redefinida com sucesso. Você já pode fazer login com a sua nova senha.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      await AutenticacaoService.logout({ token: req.token, userId: req.user.id, ip: req.ip });
      return res.status(200).json({
        status: 'success',
        message: 'Sessão encerrada com sucesso.',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AutenticacaoController;
