/**
 * @file UsuarioController.js
 * @description Controller responsável por gerenciar as operações do perfil e conta do usuário.
 * Ele lida com a recuperação de perfil, atualização de dados cadastrais, alteração de senha e
 * exclusão definitiva de conta em conformidade com as diretrizes da LGPD (Lei Geral de Proteção de Dados).
 * 
 * Interações no fluxo da aplicação:
 * - Middleware de Autenticação (`authMiddleware`): Pré-processa as requisições autenticadas e anexa o usuário em `req.user`.
 * - Validadores (`validadores`): Validam formatos de e-mail, senha e telefone antes de persistir no banco.
 * - Criptografia (`bcryptjs`): Utilizado para comparar senhas antigas e gerar hash seguro para novas senhas.
 * - Log de Auditoria (`logger`): Registra ações críticas (alteração de dados, senha, exclusão de conta) para fins de segurança.
 * - Camada de Persistência (`UsuarioModel`): Executa as operações correspondentes no banco de dados SQLite.
 */

// Importa a biblioteca bcryptjs para criptografia e verificação de hashes de senhas de forma segura.
const bcrypt = require('bcryptjs');

// Importa o modelo UsuarioModel para acesso direto às tabelas e manipulação dos dados de usuário no SQLite.
const UsuarioModel = require('../models/UsuarioModel');

// Importa funções utilitárias para validação de formatos específicos de senha, e-mail e telefone.
const { validatePassword, validateEmail, validatePhone } = require('../utils/validadores');

// Importa o serviço de log para registrar logs de auditoria de ações sensíveis executadas pelos usuários.
const logger = require('../utils/logger');

class UsuarioController {
  /**
   * @route GET /users/profile (ou equivalente)
   * @description Retorna as informações do perfil do usuário atualmente autenticado.
   * 
   * @param {Object} req - Objeto de requisição do Express (contém a propriedade `user` injetada pelo middleware de autenticação).
   * @param {Object} res - Objeto de resposta do Express.
   * @param {Function} next - Callback para encaminhar erros inesperados.
   * 
   * @returns {Response} Retorna status 200 com os dados do usuário conectado.
   */
  static async getProfile(req, res, next) {
    try {
      // O objeto do usuário autenticado já foi anexado à requisição (req.user) pelo middleware de autenticação.
      // Desta forma, não é necessário fazer uma nova consulta ao banco de dados para recuperar as informações básicas.
      return res.status(200).json({
        status: 'success',
        data: {
          usuario: req.user
        }
      });
    } catch (error) {
      // Repassa qualquer exceção ao middleware de tratamento centralizado de erros do Express.
      next(error);
    }
  }

  /**
   * @route PUT /users/profile (ou equivalente)
   * @description Atualiza os dados de cadastro básicos do usuário (nome, sobrenome, email, telefone).
   * 
   * @param {Object} req - Objeto de requisição. O corpo (`req.body`) deve conter `nome`, `sobrenome`, `email` e `telefone`.
   * @param {Object} res - Objeto de resposta.
   * @param {Function} next - Callback para encaminhar erros.
   * 
   * @returns {Promise<Response>} Retorna status 200 com os dados atualizados em caso de sucesso, ou 400 se houver falha de validação ou conflito de e-mail.
   */
  static async updateProfile(req, res, next) {
    // Recupera o ID do usuário autenticado a partir do token decodificado pelo middleware de segurança.
    const userId = req.user.id;
    // Desestrutura os novos dados enviados no corpo da requisição (JSON).
    const { nome, sobrenome, email, telefone } = req.body;

    try {
      // 1. Validação de Campos Obrigatórios: Garante que todos os campos necessários estejam presentes.
      if (!nome || !sobrenome || !email || !telefone) {
        return res.status(400).json({
          status: 'error',
          message: 'Todos os campos (nome, sobrenome, email, telefone) devem ser preenchidos.'
        });
      }

      // 2. Validação de Formato do E-mail: Utiliza regex para verificar se a estrutura do e-mail é válida.
      if (!validateEmail(email)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de e-mail inválido.'
        });
      }

      // 3. Validação de Formato do Telefone: Verifica se o número atende ao padrão esperado de telefone brasileiro.
      if (!validatePhone(telefone)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de telefone inválido.'
        });
      }

      // 4. Regra de Negócio (RN13) - Unicidade de E-mail:
      // Busca no banco se já existe outro usuário cadastrado com o e-mail que está sendo tentado definir.
      const userWithEmail = await UsuarioModel.findByEmail(email);
      // Se encontrar um usuário cadastrado com esse e-mail E o ID desse usuário for diferente do usuário atual,
      // impede a atualização para evitar duplicidade de e-mails na plataforma.
      if (userWithEmail && userWithEmail.id !== userId) {
        return res.status(400).json({
          status: 'error',
          message: 'O e-mail informado já está em uso por outro usuário.'
        });
      }

      // 5. Atualização dos Dados: Persiste as novas informações básicas no banco de dados SQLite.
      await UsuarioModel.update(userId, { nome, sobrenome, email, telefone });

      // 6. Registro de Auditoria: Grava uma entrada de log para rastreabilidade de alterações cadastrais.
      logger.audit('Dados cadastrais do usuário atualizados', {
        userId,
        ip: req.ip
      });

      // 7. Retorno da Resposta: Envia resposta HTTP 200 contendo a estrutura de sucesso e os dados já atualizados.
      return res.status(200).json({
        status: 'success',
        message: 'Dados cadastrais atualizados com sucesso.',
        data: {
          usuario: {
            id: userId,
            nome,
            sobrenome,
            email,
            telefone
          }
        }
      });

    } catch (error) {
      // Em caso de erro (ex: problemas na conexão ou erro do banco), repassa a exceção para o middleware do Express.
      next(error);
    }
  }

  /**
   * @route PUT /users/password (ou equivalente)
   * @description Altera a senha do usuário com base na validação da senha atual.
   * 
   * @param {Object} req - Objeto de requisição. O corpo (`req.body`) deve conter `senhaAtual`, `novaSenha` e `confirmarNovaSenha`.
   * @param {Object} res - Objeto de resposta.
   * @param {Function} next - Callback para encaminhar erros.
   * 
   * @returns {Promise<Response>} Retorna status 200 em caso de sucesso, ou 400 se houver inconsistências de validação/autenticação.
   */
  static async updatePassword(req, res, next) {
    const userId = req.user.id;
    const { senhaAtual, novaSenha, confirmarNovaSenha } = req.body;

    try {
      // 1. Validação de Campos: Verifica se os campos requeridos para a troca de senha foram fornecidos.
      if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
        return res.status(400).json({
          status: 'error',
          message: 'Todos os campos de senha (senha atual, nova senha e confirmação) são obrigatórios.'
        });
      }

      // 2. Confirmação de Senha: Confirma se a nova senha e a redigitação são idênticas.
      if (novaSenha !== confirmarNovaSenha) {
        return res.status(400).json({
          status: 'error',
          message: 'A nova senha e a confirmação não conferem.'
        });
      }

      // 3. Validação de Complexidade de Senha:
      // Exige critérios fortes como tamanho mínimo, letras maiúsculas, minúsculas, números e símbolos.
      if (!validatePassword(novaSenha)) {
        return res.status(400).json({
          status: 'error',
          message: 'A nova senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.'
        });
      }

      // 4. Busca do Usuário no Banco (incluindo o hash da senha):
      // Por padrão de segurança, consultas normais de usuário excluem a senha do retorno.
      // Aqui usamos um método específico para trazer o hash da senha atual a fim de validá-lo.
      const user = await UsuarioModel.findByIdWithPassword(userId);
      
      // 5. Verificação da Senha Atual:
      // Como a senha no banco de dados está criptografada com hash, precisamos usar bcrypt.compare
      // para comparar a senha informada em texto plano com o hash armazenado no banco.
      const isPasswordValid = await bcrypt.compare(senhaAtual, user.senha_hash);
      if (!isPasswordValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Senha atual inválida.'
        });
      }

      // 6. Criptografia da Nova Senha:
      // Gera um novo hash para a nova senha utilizando bcrypt com um fator de custo (salts) igual a 10.
      // O fator 10 representa um bom equilíbrio entre segurança (tempo de processamento) e performance.
      const newSenhaHash = await bcrypt.hash(novaSenha, 10);
      
      // 7. Atualização no Banco: Salva o novo hash gerado.
      await UsuarioModel.updatePassword(userId, newSenhaHash);

      // 8. Log de Auditoria: Registra o evento de alteração de senha.
      logger.audit('Senha do usuário atualizada com sucesso', {
        userId,
        ip: req.ip
      });

      // 9. Resposta: Confirmação de sucesso da alteração de senha.
      return res.status(200).json({
        status: 'success',
        message: 'Senha atualizada com sucesso.'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * @route DELETE /users/account (ou equivalente)
   * @description RS03: Conformidade com a LGPD.
   * Permite que o próprio usuário autenticado solicite a exclusão completa e definitiva
   * de sua conta e de todos os dados associados a ela na plataforma.
   * 
   * @param {Object} req - Objeto de requisição com `user` injetado pelo middleware.
   * @param {Object} res - Objeto de resposta.
   * @param {Function} next - Callback para encaminhar erros.
   * 
   * @returns {Promise<Response>} Retorna status 200 após concluir a remoção definitiva do registro.
   */
  static async deleteAccount(req, res, next) {
    const userId = req.user.id;

    try {
      // Executa o método de exclusão no banco. A implementação interna deve tratar a remoção
      // em cascata ou a exclusão manual dos dados correlacionados (como endereços, etc.) para evitar órfãos.
      await UsuarioModel.delete(userId);

      // Registra a exclusão da conta no sistema de logs para fins de auditoria histórica de segurança.
      logger.audit('Conta de usuário excluída (Solicitação LGPD)', {
        userId,
        ip: req.ip
      });

      // Retorna uma resposta amigável informando que a solicitação em conformidade com a LGPD foi concluída.
      return res.status(200).json({
        status: 'success',
        message: 'Sua conta e todos os dados associados foram excluídos com sucesso, em conformidade com a LGPD.'
      });
    } catch (error) {
      next(error);
    }
  }
}

// Exporta o UsuarioController pronto para ser associado aos endpoints de rotas do Express.
module.exports = UsuarioController;
