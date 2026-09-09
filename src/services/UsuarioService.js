/**
 * @file UsuarioService.js
 * @description Camada de serviço: perfil, senha e exclusão de conta (LGPD).
 * Orquestra a entidade de domínio `Usuario` e o `UsuarioDAO`.
 */

const bcrypt = require('bcryptjs');

const UsuarioDAO = require('../dao/UsuarioDAO');
const { validatePassword, validateEmail, validatePhone } = require('../utils/validadores');
const logger = require('../utils/logger');
const { reconstituirUsuario } = require('../domain/factories');
const { BadRequestError } = require('../errors/AppError');

class UsuarioService {
  /**
   * Atualiza dados cadastrais via operação de domínio `atualizarDados()`.
   * @returns {Promise<Object>} usuário atualizado (público).
   */
  static async updateProfile({ userId, userPublic, nome, sobrenome, email, telefone, ip }) {
    if (!nome || !sobrenome || !email || !telefone) {
      throw new BadRequestError('Todos os campos (nome, sobrenome, email, telefone) devem ser preenchidos.');
    }

    if (!validateEmail(email)) {
      throw new BadRequestError('Formato de e-mail inválido.');
    }

    if (!validatePhone(telefone)) {
      throw new BadRequestError('Formato de telefone inválido.');
    }

    // RN13 — unicidade de e-mail
    const userWithEmail = await UsuarioDAO.findByEmail(email);
    if (userWithEmail && userWithEmail.id !== userId) {
      throw new BadRequestError('O e-mail informado já está em uso por outro usuário.');
    }

    const usuarioEnt = reconstituirUsuario({ ...userPublic, id: userId });
    usuarioEnt.atualizarDados({ nome, sobrenome, email, telefone });
    await UsuarioDAO.update(userId, {
      nome: usuarioEnt.nome,
      sobrenome: usuarioEnt.sobrenome,
      email: usuarioEnt.email,
      telefone: usuarioEnt.telefone,
    });

    logger.audit('Dados cadastrais do usuário atualizados', { userId, ip });

    return {
      id: userId,
      nome: usuarioEnt.nome,
      sobrenome: usuarioEnt.sobrenome,
      email: usuarioEnt.email,
      telefone: usuarioEnt.telefone,
    };
  }

  /** Troca de senha com verificação da atual via `Usuario.autenticar()`. */
  static async updatePassword({ userId, senhaAtual, novaSenha, confirmarNovaSenha, ip }) {
    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      throw new BadRequestError('Todos os campos de senha (senha atual, nova senha e confirmação) são obrigatórios.');
    }

    if (novaSenha !== confirmarNovaSenha) {
      throw new BadRequestError('A nova senha e a confirmação não conferem.');
    }

    if (!validatePassword(novaSenha)) {
      throw new BadRequestError('A nova senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.');
    }

    const user = await UsuarioDAO.findByIdWithPassword(userId);
    const usuarioEnt = reconstituirUsuario(user);

    if (!usuarioEnt.autenticar(usuarioEnt.email, senhaAtual)) {
      throw new BadRequestError('Senha atual inválida.');
    }

    const newSenhaHash = await bcrypt.hash(novaSenha, 10);
    usuarioEnt.senhaHash = newSenhaHash;

    await UsuarioDAO.updatePassword(userId, usuarioEnt.senhaHash);

    logger.audit('Senha do usuário atualizada com sucesso', { userId, ip });
  }

  /** RS03 LGPD: exclusão definitiva em cascata. */
  static async deleteAccount({ userId, ip }) {
    await UsuarioDAO.delete(userId);

    logger.audit('Conta de usuário excluída (Solicitação LGPD)', { userId, ip });
  }
}

module.exports = UsuarioService;
