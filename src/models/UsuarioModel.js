/**
 * @file UsuarioModel.js
 * @description Modelo de dados para a entidade Usuário (Usuario).
 * Este arquivo define a classe `UsuarioModel`, que gerencia a persistência de dados de usuários
 * (anunciantes e compradores) na tabela `Usuario` do banco de dados SQLite.
 * 
 * Aspectos de Segurança e LGPD:
 * - Senhas são salvas no formato Hash (`senha_hash`) para que não fiquem expostas em texto plano.
 * - O método `findById` oculta intencionalmente o hash de senha para proteger dados sensíveis.
 * - O método `delete` realiza a exclusão definitiva do usuário, disparando deleções em cascata
 *   (ON DELETE CASCADE) para endereços e anúncios vinculados. Isso garante conformidade com a LGPD (RS03).
 */

const { getDatabaseInstance } = require('../config/bancoDeDados');

class UsuarioModel {
  /**
   * Registra um novo usuário no banco de dados.
   * 
   * @param {Object} params - Dados de cadastro do usuário.
   * @param {string} params.nome - Nome do usuário.
   * @param {string} params.sobrenome - Sobrenome do usuário.
   * @param {string} params.email - E-mail de login (único).
   * @param {string} params.telefone - Número de telefone de contato (geralmente celular/WhatsApp).
   * @param {string} params.senhaHash - Hash da senha previamente criptografado (normalmente com bcrypt).
   * @returns {Promise<number>} Retorna o ID gerado pelo banco para o usuário (`lastID`).
   * 
   * Operação DB:
   * - Executa o comando INSERT INTO Usuario (nome, sobrenome, email, telefone, senha_hash).
   * - O SQLite atribui um ID sequencial automático para o novo usuário.
   * - Utiliza `db.run()` para realizar a inserção de forma segura contra SQL injection.
   */
  static async create({ nome, sobrenome, email, telefone, senhaHash }) {
    const db = await getDatabaseInstance();
    const result = await db.run(
      `INSERT INTO Usuario (nome, sobrenome, email, telefone, senha_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [nome, sobrenome, email, telefone, senhaHash]
    );
    return result.lastID;
  }

  /**
   * Busca os dados públicos/seguros de um usuário pelo seu ID.
   * Exclui o hash da senha da projeção SQL para evitar exposição desnecessária na camada de API.
   * 
   * @param {number} id - ID do usuário.
   * @returns {Promise<Object|undefined>} Retorna dados básicos do usuário ou `undefined` se não encontrado.
   * 
   * Operação DB:
   * - Executa SELECT id, nome, sobrenome, email, telefone, data_cadastro FROM Usuario WHERE id = ?.
   * - Utiliza `db.get()` para ler a primeira linha correspondente.
   */
  static async findById(id) {
    const db = await getDatabaseInstance();
    return await db.get(
      'SELECT id, nome, sobrenome, email, telefone, data_cadastro FROM Usuario WHERE id = ?',
      [id]
    );
  }

  /**
   * Busca todos os dados do usuário, incluindo o hash de sua senha.
   * Método de uso interno, essencial durante fluxos de alteração de senha onde é necessário validar a senha antiga.
   * 
   * @param {number} id - ID do usuário.
   * @returns {Promise<Object|undefined>} Retorna os dados completos do usuário ou `undefined`.
   * 
   * Operação DB:
   * - Executa SELECT * FROM Usuario WHERE id = ?.
   * - Utiliza `db.get()`.
   */
  static async findByIdWithPassword(id) {
    const db = await getDatabaseInstance();
    return await db.get(
      'SELECT * FROM Usuario WHERE id = ?',
      [id]
    );
  }

  /**
   * Busca um usuário com base no e-mail fornecido.
   * Muito utilizado no processo de autenticação (Login) para localizar o usuário e obter o hash da senha para verificação.
   * 
   * @param {string} email - E-mail de cadastro do usuário.
   * @returns {Promise<Object|undefined>} Retorna os dados completos do usuário associados ao e-mail ou `undefined`.
   * 
   * Operação DB:
   * - Executa SELECT * FROM Usuario WHERE email = ?.
   * - Utiliza `db.get()`.
   */
  static async findByEmail(email) {
    const db = await getDatabaseInstance();
    return await db.get(
      'SELECT * FROM Usuario WHERE email = ?',
      [email]
    );
  }

  /**
   * Atualiza os dados cadastrais (exceto senha) do usuário.
   * 
   * @param {number} id - ID do usuário a ser atualizado.
   * @param {Object} params - Dados a serem atualizados.
   * @param {string} params.nome - Novo nome.
   * @param {string} params.sobrenome - Novo sobrenome.
   * @param {string} params.email - Novo e-mail.
   * @param {string} params.telefone - Novo telefone.
   * @returns {Promise<boolean>} Retorna `true` após a execução do comando.
   * 
   * Operação DB:
   * - Executa UPDATE Usuario SET nome = ?, sobrenome = ?, email = ?, telefone = ? WHERE id = ?.
   * - Utiliza `db.run()`.
   */
  static async update(id, { nome, sobrenome, email, telefone }) {
    const db = await getDatabaseInstance();
    await db.run(
      `UPDATE Usuario 
       SET nome = ?, sobrenome = ?, email = ?, telefone = ?
       WHERE id = ?`,
      [nome, sobrenome, email, telefone, id]
    );
    return true;
  }

  /**
   * Atualiza especificamente a senha do usuário.
   * 
   * @param {number} id - ID do usuário.
   * @param {string} senhaHash - O novo hash da senha criptografado.
   * @returns {Promise<boolean>} Retorna `true` após atualizar a senha.
   * 
   * Operação DB:
   * - Executa UPDATE Usuario SET senha_hash = ? WHERE id = ?.
   * - Utiliza `db.run()`.
   */
  static async updatePassword(id, senhaHash) {
    const db = await getDatabaseInstance();
    await db.run(
      'UPDATE Usuario SET senha_hash = ? WHERE id = ?',
      [senhaHash, id]
    );
    return true;
  }

  /**
   * RS03: LGPD Compliance.
   * Exclui definitivamente um usuário e todos os seus dados pessoais do sistema.
   * Devido à definição de chaves estrangeiras com a cláusula `ON DELETE CASCADE` no banco de dados,
   * a exclusão do registro do usuário acarreta a exclusão automática de seus endereços (`Endereco`) 
   * e anúncios (`Anuncio`) associados, bem como as imagens desses anúncios.
   * 
   * @param {number} id - ID do usuário a ser removido.
   * @returns {Promise<boolean>} Retorna `true` após a deleção física bem-sucedida.
   * 
   * Operação DB:
   * - Executa DELETE FROM Usuario WHERE id = ?.
   * - Utiliza `db.run()`.
   */
  static async delete(id) {
    const db = await getDatabaseInstance();
    await db.run('DELETE FROM Usuario WHERE id = ?', [id]);
    return true;
  }
}

module.exports = UsuarioModel;
