/**
 * @file AutenticacaoController.js
 * @description Controller responsável por gerenciar os fluxos de autenticação, registro,
 * login e recuperação de senha dos usuários. Ele atua como um intermediário entre a camada
 * de rotas (HTTP) e a camada de modelos (acesso ao banco de dados SQLite).
 * 
 * Este arquivo ilustra conceitos fundamentais de desenvolvimento backend:
 * 1. Criptografia de senhas usando a biblioteca 'bcryptjs'.
 * 2. Geração e assinatura de JSON Web Tokens (JWT) com 'jsonwebtoken' para autenticação sem estado (stateless).
 * 3. Validação de dados de entrada com expressões regulares (e-mail, telefone, força de senha).
 * 4. Controle transacional em banco de dados SQLite para garantir consistência operacional.
 * 5. Proteção contra enumeração de contas (Account Enumeration) em recuperação de senha.
 * 6. Estrutura de resposta padronizada (JSend-like: status, message, data).
 */

// Importação do bcryptjs: Utilizado para realizar o hash de senhas antes de salvá-las no banco
// e comparar senhas fornecidas em texto limpo com os hashes salvos no banco. É uma biblioteca
// segura que protege as senhas contra ataques de dicionário e força bruta (através de salting).
const bcrypt = require('bcryptjs');

// Importação do jsonwebtoken: Usado para assinar tokens JWT que serão retornados ao cliente
// após um login ou cadastro bem-sucedido. O cliente envia esse token nas requisições subsequentes
// para se identificar de forma segura.
const jwt = require('jsonwebtoken');

// Modelos de dados para interação com o banco de dados SQLite
const UsuarioModel = require('../models/UsuarioModel');
const EnderecoModel = require('../models/EnderecoModel');

// Conexão com o banco de dados SQLite
const { getDatabaseInstance } = require('../config/bancoDeDados');

// Utilitários de validação de dados (e-mail, telefone, força de senha)
const { validatePassword, validateEmail, validatePhone } = require('../utils/validadores');

// Logger para registro de eventos do sistema (auditorias, erros, logs informativos)
const logger = require('../utils/logger');

class AutenticacaoController {
  /**
   * Registra um novo usuário e seu endereço correspondente dentro de uma transação.
   * 
   * @param {Object} req - Objeto de requisição do Express (contém o corpo com os dados do usuário).
   * @param {Object} res - Objeto de resposta do Express para enviar o status e JSON de volta ao cliente.
   * @param {Function} next - Função de callback para passar erros para o middleware de tratamento de erro centralizado.
   */
  static async register(req, res, next) {
    // Obtém a instância de conexão activa com o SQLite
    const db = await getDatabaseInstance();
    
    // Desestrutura os dados enviados no corpo (body) da requisição
    const { 
      nome, sobrenome, email, telefone, senha,
      rua, numero, bairro, cep, cidade, uf, zona
    } = req.body;

    try {
      // 1. Validação de Campos Obrigatórios (Regra de Negócio RN02)
      // Garante que todas as informações fundamentais para criar um usuário e endereço estejam presentes.
      if (!nome || !sobrenome || !email || !telefone || !senha || !rua || !numero || !bairro || !cidade || !uf || !zona) {
        return res.status(400).json({
          status: 'error',
          message: 'Todos os campos obrigatórios de cadastro (nome, sobrenome, email, telefone, senha e endereço completo) devem ser preenchidos.'
        });
      }

      // 2. Validação dos formatos de E-mail e Telefone
      // Garante que o e-mail atenda a uma expressão regular básica e que o telefone contenha DDD.
      if (!validateEmail(email)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de e-mail inválido.'
        });
      }

      if (!validatePhone(telefone)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de telefone inválido. Insira DDD + número.'
        });
      }

      // 3. Validação de Força de Senha (Regra de Segurança RS07)
      // Exige que a senha seja forte (letras maiúsculas/minúsculas, números, caracteres especiais e min. 8 caracteres).
      if (!validatePassword(senha)) {
        return res.status(400).json({
          status: 'error',
          message: 'A senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.'
        });
      }

      // 4. Validação da Zona do Endereço (Regra de Negócio RN03)
      // Normaliza para caixa alta e valida se pertence a uma das opções aceitas: URBANA ou RURAL.
      const upperZona = zona.toUpperCase();
      if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
        return res.status(400).json({
          status: 'error',
          message: 'A zona do endereço deve ser classificada como URBANA ou RURAL.'
        });
      }

      // 5. Verificação de Unicidade do E-mail (Regra de Negócio RN13)
      // Impede o cadastro de múltiplos usuários com o mesmo endereço de e-mail.
      const existingUser = await UsuarioModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'O e-mail informado já está cadastrado.'
        });
      }

      // 6. Fluxo Transacional (Transação de Banco de Dados)
      // O registro de um cliente exige a criação simultânea de seu perfil e de seu endereço.
      // Se a criação do endereço falhar (ex: campo inválido), a criação do usuário também deve ser cancelada.
      // Iniciamos a transação com 'BEGIN TRANSACTION'.
      await db.run('BEGIN TRANSACTION');
      
      // Criptografia de senha com bcryptjs
      // O segundo parâmetro (10) representa o número de "rounds" de salt. Quanto maior o valor, mais lento
      // e computacionalmente caro fica o algoritmo de hash, o que dificulta ataques de força bruta offline.
      const senhaHash = await bcrypt.hash(senha, 10);
      
      // Cria o registro do Usuário no banco e recupera o ID gerado (chave primária)
      const clienteId = await UsuarioModel.create({
        nome,
        sobrenome,
        email,
        telefone,
        senhaHash
      });

      // Cria o endereço associado ao ID do cliente recém-criado
      await EnderecoModel.create({
        clienteId,
        rua,
        numero,
        bairro,
        cep,
        cidade,
        uf,
        zona: upperZona
      });

      // Confirmamos as alterações no banco de dados. Ambas as tabelas (Usuario e Endereco) são atualizadas
      // de forma atômica (tudo ou nada).
      await db.run('COMMIT');

      // 7. Geração do Token JWT (JSON Web Token)
      // O payload do token contém o ID e o e-mail do usuário cadastrado.
      // O token é assinado usando uma chave secreta exclusiva do servidor (JWT_SECRET) para garantir que
      // não possa ser adulterado no lado do cliente. Definimos uma expiração padrão de 24 horas.
      const token = jwt.sign(
        { id: clienteId, email },
        process.env.JWT_SECRET || 'secret_key_default',
        { expiresIn: '24h' }
      );

      // Registro de Auditoria (Requisito Não Funcional RNF11)
      // Registra a criação de uma conta com dados relevantes, excluindo informações sensíveis.
      logger.audit('Novo usuário cadastrado com sucesso', {
        userId: clienteId,
        email,
        ip: req.ip
      });

      // Retorna uma resposta estruturada de sucesso (Status 201 Created)
      return res.status(201).json({
        status: 'success',
        message: 'Cadastro realizado com sucesso.',
        data: {
          token,
          usuario: {
            id: clienteId,
            nome,
            sobrenome,
            email,
            telefone
          }
        }
      });

    } catch (error) {
      // Em caso de qualquer erro durante o bloco try, a transação é desfeita (ROLLBACK),
      // garantindo que nenhuma alteração parcial seja salva no banco de dados.
      await db.run('ROLLBACK');
      next(error);
    }
  }

  /**
   * Realiza a autenticação (login) de um usuário existente.
   * 
   * @param {Object} req - Objeto de requisição contendo e-mail e senha informados.
   * @param {Object} res - Objeto de resposta para enviar o JWT e dados do usuário.
   * @param {Function} next - Callback de erro do Express.
   */
  static async login(req, res, next) {
    const { email, senha } = req.body;

    try {
      // Validação rápida de preenchimento dos campos essenciais
      if (!email || !senha) {
        return res.status(400).json({
          status: 'error',
          message: 'E-mail e senha são obrigatórios.'
        });
      }

      // Busca o usuário no banco de dados através do e-mail
      const user = await UsuarioModel.findByEmail(email);
      if (!user) {
        // Por motivos de segurança, retornamos uma mensagem genérica "E-mail ou senha incorretos"
        // para evitar que um atacante descubra quais e-mails estão cadastrados no sistema.
        return res.status(401).json({
          status: 'error',
          message: 'Credenciais inválidas. E-mail ou senha incorretos.'
        });
      }

      // Verificação da Senha
      // A senha enviada em texto limpo pelo cliente é criptografada e comparada de forma segura
      // com a hash armazenada no banco através do método bcrypt.compare(). Esse processo é resistente
      // a ataques de temporização (Timing Attacks).
      const isPasswordValid = await bcrypt.compare(senha, user.senha_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          status: 'error',
          message: 'Credenciais inválidas. E-mail ou senha incorretos.'
        });
      }

      // Geração do JSON Web Token (JWT)
      // Caso as credenciais estejam corretas, criamos um token JWT contendo a identificação do usuário
      // assinado digitalmente, permitindo acesso autenticado às rotas privadas.
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'secret_key_default',
        { expiresIn: '24h' }
      );

      // Log informativo do login
      logger.info('Usuário autenticado com sucesso', {
        userId: user.id,
        email: user.email
      });

      // Retorna uma resposta estruturada de sucesso (Status 200 OK)
      return res.status(200).json({
        status: 'success',
        message: 'Autenticação bem-sucedida.',
        data: {
          token,
          usuario: {
            id: user.id,
            nome: user.nome,
            sobrenome: user.sobrenome,
            email: user.email,
            telefone: user.telefone
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Inicia o fluxo de recuperação de senha gerando um código temporário de 6 dígitos.
   * 
   * @param {Object} req - Requisição contendo o e-mail para recuperação.
   * @param {Object} res - Resposta informando o envio do código.
   * @param {Function} next - Callback de erro do Express.
   */
  static async forgotPassword(req, res, next) {
    const { email } = req.body;

    try {
      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'O e-mail é obrigatório.'
        });
      }

      // Busca o usuário correspondente ao e-mail
      const user = await UsuarioModel.findByEmail(email);
      
      // Prevenção de Enumeração de Contas (Account Enumeration Prevention)
      // Se o e-mail não existir, retornamos a mesma resposta de sucesso simulada.
      // Isso impede que agentes mal-intencionados verifiquem se uma conta existe apenas tentando recuperar a senha dela.
      if (!user) {
        logger.warn(`Solicitação de recuperação de senha para e-mail não cadastrado: ${email}`);
        return res.status(200).json({
          status: 'success',
          message: 'Se o e-mail informado estiver cadastrado, um código de verificação será enviado.'
        });
      }

      // Geração de um código numérico de 6 dígitos
      // Um número aleatório no intervalo [100000, 999999] convertido para string.
      const codigo = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Definição da data de expiração
      // O código gerado terá validade de 15 minutos (Date.now() + 15 * 60 segundos * 1000 milissegundos).
      const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const db = await getDatabaseInstance();
      
      // Invalidação de códigos anteriores ativos (usado = 1)
      // Garante que apenas o código mais recente enviado para o e-mail seja válido.
      await db.run(
        'UPDATE RecuperacaoSenha SET usado = 1 WHERE usuario_id = ? AND usado = 0',
        [user.id]
      );

      // Inserção do novo código de recuperação no banco de dados SQLite
      await db.run(
        `INSERT INTO RecuperacaoSenha (usuario_id, codigo, expira_em, usado)
         VALUES (?, ?, ?, 0)`,
        [user.id, codigo, expiraEm]
      );

      // Envio do e-mail de recuperação de forma assíncrona
      // Importação sob demanda (lazy load) para evitar acoplamento desnecessário no escopo global
      const { sendRecoveryEmail } = require('../utils/email');
      await sendRecoveryEmail(user.email, codigo);

      logger.info(`Código de recuperação gerado com sucesso para o usuário ${user.id}`);

      return res.status(200).json({
        status: 'success',
        message: 'Se o e-mail informado estiver cadastrado, um código de verificação será enviado.'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Valida o código de verificação enviado por e-mail e redefine a senha do usuário.
   * 
   * @param {Object} req - Requisição contendo o e-mail, código e a nova senha desejada.
   * @param {Object} res - Resposta indicando o sucesso ou falha da redefinição.
   * @param {Function} next - Callback de erro do Express.
   */
  static async resetPassword(req, res, next) {
    const { email, codigo, novaSenha } = req.body;

    try {
      // Valida se todos os parâmetros fundamentais para a operação foram fornecidos
      if (!email || !codigo || !novaSenha) {
        return res.status(400).json({
          status: 'error',
          message: 'E-mail, código de verificação e nova senha são obrigatórios.'
        });
      }

      // Validação de Força da Nova Senha (Regra de Segurança RS07)
      // A nova senha precisa passar pelo mesmo padrão de segurança exigido no cadastro.
      if (!validatePassword(novaSenha)) {
        return res.status(400).json({
          status: 'error',
          message: 'A nova senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.'
        });
      }

      // Verifica se o usuário existe no banco de dados
      const user = await UsuarioModel.findByEmail(email);
      if (!user) {
        return res.status(400).json({
          status: 'error',
          message: 'E-mail inválido ou código de verificação incorreto/expirado.'
        });
      }

      const db = await getDatabaseInstance();
      
      // Busca o último código de recuperação ativo (não utilizado) para esse usuário
      const record = await db.get(
        `SELECT * FROM RecuperacaoSenha 
         WHERE usuario_id = ? AND codigo = ? AND usado = 0 
         ORDER BY id DESC LIMIT 1`,
        [user.id, codigo]
      );

      // Se não houver nenhum registro correspondente ativo
      if (!record) {
        return res.status(400).json({
          status: 'error',
          message: 'Código de verificação inválido ou já utilizado.'
        });
      }

      // Validação do Tempo de Expiração do Código
      // Compara a data/hora atual com a data limite de expiração armazenada no banco.
      const now = new Date().toISOString();
      if (record.expira_em < now) {
        return res.status(400).json({
          status: 'error',
          message: 'O código de verificação expirou. Por favor, solicite um novo código.'
        });
      }

      // Geração da Hash da nova senha
      const hash = await bcrypt.hash(novaSenha, 10);
      
      // Execução transacional das atualizações no banco de dados
      // Precisamos garantir que tanto a senha seja alterada quanto o código seja marcado como usado.
      // Se um dos dois passos falhar, toda a operação é cancelada para evitar inconsistências.
      await db.run('BEGIN TRANSACTION');

      // Atualiza o hash da senha na tabela de Usuário
      await UsuarioModel.updatePassword(user.id, hash);

      // Marca o código de verificação correspondente como usado (usado = 1)
      await db.run(
        'UPDATE RecuperacaoSenha SET usado = 1 WHERE id = ?',
        [record.id]
      );

      // Confirma e consolida as mudanças
      await db.run('COMMIT');

      // Log de auditoria para fins de segurança
      logger.audit('Senha redefinida com sucesso via recuperação de senha', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(200).json({
        status: 'success',
        message: 'Senha redefinida com sucesso. Você já pode fazer login com a sua nova senha.'
      });

    } catch (error) {
      // Tratamento robusto de rollback se algo der errado dentro do bloco try
      const db = await getDatabaseInstance();
      try {
        await db.run('ROLLBACK');
      } catch (err) {
        // Ignora erros ao tentar reverter a transação caso ela já não estivesse ativa
      }
      next(error);
    }
  }
}

module.exports = AutenticacaoController;
