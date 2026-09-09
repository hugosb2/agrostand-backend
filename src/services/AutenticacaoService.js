/**
 * @file AutenticacaoService.js
 * @description Camada de serviço: fluxos de registro, login e recuperação de
 * senha. Orquestra entidades de domínio (`src/domain`), DAOs (`src/dao`) e
 * transações; lança erros de `src/errors` em vez de responder HTTP.
 *
 * Transações usam `getDb().transaction((tx) => ...)` (better-sqlite3: callback
 * SÍNCRONO — todo I/O assíncrono como bcrypt e envio de e-mail ocorre FORA da tx).
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UsuarioDAO = require('../dao/UsuarioDAO');
const EnderecoDAO = require('../dao/EnderecoDAO');
const RecuperacaoSenhaDAO = require('../dao/RecuperacaoSenhaDAO');
const BloqueioLoginDAO = require('../dao/BloqueioLoginDAO');
const TokenRevogadoDAO = require('../dao/TokenRevogadoDAO');

const { getDb } = require('../db');
const { validatePassword, validateEmail, validatePhone } = require('../utils/validadores');
const { hashToken } = require('../utils/tokens');
const logger = require('../utils/logger');
const { Usuario, Endereco, BloqueioLogin, reconstituirUsuario } = require('../domain/factories');
const { BadRequestError, UnauthorizedError, TooManyRequestsError } = require('../errors/AppError');

function isUniqueEmailViolation(error) {
  const msg = String((error && error.message) || error || '');
  return msg.includes('UNIQUE constraint failed') && msg.includes('Usuario.email');
}

function signToken(id, email) {
  return jwt.sign(
    // jti garante unicidade por sessão: dois logins no mesmo segundo não
    // geram o mesmo token (iat tem granularidade de segundos), então o
    // logout (denylist) revoga só a sessão usada.
    { id, email, jti: crypto.randomUUID() },
    process.env.JWT_SECRET || 'secret_key_default',
    { expiresIn: '24h' }
  );
}

class AutenticacaoService {
  /**
   * Registra usuário + endereço de forma atômica.
   * @returns {Promise<{token: string, usuario: Object}>}
   */
  static async register({ nome, sobrenome, email, telefone, senha, rua, numero, bairro, cep, cidade, uf, zona, ip }) {
    // 1. Campos obrigatórios do usuário (RN02)
    if (!nome || !sobrenome || !email || !telefone || !senha) {
      throw new BadRequestError('Todos os campos obrigatórios de cadastro (nome, sobrenome, email, telefone, senha e endereço completo) devem ser preenchidos.');
    }

    if (!validateEmail(email)) {
      throw new BadRequestError('Formato de e-mail inválido.');
    }

    if (!validatePhone(telefone)) {
      throw new BadRequestError('Formato de telefone inválido. Insira DDD + número.');
    }

    // RS07 — senha forte
    if (!validatePassword(senha)) {
      throw new BadRequestError('A senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.');
    }

    // Domínio: a completude do endereço é invariante da entidade Endereco.
    const enderecoEnt = new Endereco({ rua, numero, bairro, cep, cidade, uf, zona });
    if (!enderecoEnt.validar()) {
      throw new BadRequestError('Todos os campos obrigatórios de cadastro (nome, sobrenome, email, telefone, senha e endereço completo) devem ser preenchidos.');
    }

    // RN03 — zona (valores; presença já validada pelo domínio acima)
    const upperZona = String(zona).toUpperCase();
    if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
      throw new BadRequestError('A zona do endereço deve ser classificada como URBANA ou RURAL.');
    }
    enderecoEnt.zona = upperZona;

    // RN13 — e-mail único (checagem antecipada; a UNIQUE do banco é a garantia final)
    const existingUser = await UsuarioDAO.findByEmail(email);
    if (existingUser) {
      throw new BadRequestError('O e-mail informado já está cadastrado.');
    }

    // Hash FORA da transação (bcrypt é assíncrono; tx better-sqlite3 é síncrona)
    const senhaHash = await bcrypt.hash(senha, 10);

    // Domínio: entidade carrega os dados do novo usuário.
    const usuarioEnt = new Usuario({ nome, sobrenome, email, telefone, senhaHash });

    // Transação atômica: Usuario + Endereco (tudo ou nada)
    let clienteId;
    try {
      clienteId = getDb().transaction((tx) => {
        const id = UsuarioDAO.create({
          nome: usuarioEnt.nome,
          sobrenome: usuarioEnt.sobrenome,
          email: usuarioEnt.email,
          telefone: usuarioEnt.telefone,
          senhaHash: usuarioEnt.senhaHash,
        }, tx);
        EnderecoDAO.create({
          clienteId: id,
          rua: enderecoEnt.rua,
          numero: enderecoEnt.numero,
          bairro: enderecoEnt.bairro,
          cep: enderecoEnt.cep,
          cidade: enderecoEnt.cidade,
          uf: enderecoEnt.uf,
          zona: enderecoEnt.zona,
        }, tx);
        return id;
      });
    } catch (error) {
      // Condição de corrida: dois cadastros simultâneos com o mesmo e-mail
      if (isUniqueEmailViolation(error)) {
        throw new BadRequestError('O e-mail informado já está cadastrado.');
      }
      throw error;
    }

    const token = signToken(clienteId, email);

    logger.audit('Novo usuário cadastrado com sucesso', { userId: clienteId, email, ip });

    return {
      token,
      usuario: { id: clienteId, nome, sobrenome, email, telefone },
    };
  }

  /**
   * Autentica via regra de domínio `Usuario.autenticar()`, com bloqueio
   * temporário após N falhas consecutivas (RN19, entidade `BloqueioLogin`).
   * Respostas de credencial seguem genéricas (anti-enumeração).
   * @returns {Promise<{token: string, usuario: Object}>}
   */
  static async login({ email, senha }) {
    if (!email || !senha) {
      throw new BadRequestError('E-mail e senha são obrigatórios.');
    }

    const limite = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '3', 10);
    const minutos = parseFloat(process.env.LOGIN_BLOCK_MINUTES || '15');

    const registro = await BloqueioLoginDAO.findByEmail(email);
    const bloqueio = new BloqueioLogin({
      email,
      tentativas: registro ? registro.tentativas : 0,
      bloqueadoAte: registro ? registro.bloqueado_ate : null,
    });
    if (bloqueio.bloqueado()) {
      throw new TooManyRequestsError('Muitas tentativas. Tente novamente em alguns minutos.');
    }

    const user = await UsuarioDAO.findByEmail(email);
    const usuarioEnt = user ? reconstituirUsuario(user) : null;
    if (!usuarioEnt || !usuarioEnt.autenticar(email, senha)) {
      bloqueio.registrarFalha({ limite, minutos });
      await BloqueioLoginDAO.salvar({
        email,
        tentativas: bloqueio.tentativas,
        bloqueadoAte: bloqueio.bloqueadoAte,
      });
      throw new UnauthorizedError('Credenciais inválidas. E-mail ou senha incorretos.');
    }

    // Sucesso zera a contagem (fim da sequência de falhas)
    await BloqueioLoginDAO.deleteByEmail(email);

    const token = signToken(user.id, user.email);

    logger.info('Usuário autenticado com sucesso', { userId: user.id, email: user.email });

    return {
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        sobrenome: user.sobrenome,
        email: user.email,
        telefone: user.telefone,
      },
    };
  }

  /**
   * UC13: encerra a sessão revogando o JWT atual (denylist até a expiração).
   * Guarda só o hash do token, nunca o token bruto.
   */
  static async logout({ token, userId, ip }) {
    const decoded = jwt.decode(token) || {};
    const expiraEm = decoded.exp
      ? new Date(decoded.exp * 1000).toISOString()
      : new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    await TokenRevogadoDAO.adicionar({ tokenHash: hashToken(token), expiraEm });

    logger.info('Sessão encerrada (logout)', { userId, ip });
  }

  /**
   * Gera código de 6 dígitos (15 min). Silencioso p/ e-mail inexistente
   * (anti-enumeração) — o controller sempre responde o mesmo sucesso.
   */
  static async forgotPassword({ email }) {
    if (!email) {
      throw new BadRequestError('O e-mail é obrigatório.');
    }

    const user = await UsuarioDAO.findByEmail(email);
    if (!user) {
      logger.warn(`Solicitação de recuperação de senha para e-mail não cadastrado: ${email}`);
      return;
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Invalida códigos anteriores + insere o novo atomicamente
    getDb().transaction((tx) => {
      RecuperacaoSenhaDAO.invalidateActiveByUsuarioId(user.id, tx);
      RecuperacaoSenhaDAO.create({ usuarioId: user.id, codigo, expiraEm }, tx);
    });

    // Envio de e-mail APÓS o commit (I/O externo nunca dentro da tx)
    const { sendRecoveryEmail } = require('../utils/email');
    await sendRecoveryEmail(user.email, codigo);

    logger.info(`Código de recuperação gerado com sucesso para o usuário ${user.id}`);
  }

  /** Valida o código e redefine a senha (update senha + consome código em tx). */
  static async resetPassword({ email, codigo, novaSenha, ip }) {
    if (!email || !codigo || !novaSenha) {
      throw new BadRequestError('E-mail, código de verificação e nova senha são obrigatórios.');
    }

    if (!validatePassword(novaSenha)) {
      throw new BadRequestError('A nova senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.');
    }

    const user = await UsuarioDAO.findByEmail(email);
    if (!user) {
      throw new BadRequestError('E-mail inválido ou código de verificação incorreto/expirado.');
    }

    const record = await RecuperacaoSenhaDAO.findActiveByUsuarioAndCodigo(user.id, codigo);
    if (!record) {
      throw new BadRequestError('Código de verificação inválido ou já utilizado.');
    }

    const now = new Date().toISOString();
    if (record.expira_em < now) {
      throw new BadRequestError('O código de verificação expirou. Por favor, solicite um novo código.');
    }

    // Hash fora da tx
    const hash = await bcrypt.hash(novaSenha, 10);

    getDb().transaction((tx) => {
      UsuarioDAO.updatePassword(user.id, hash, tx);
      RecuperacaoSenhaDAO.markAsUsed(record.id, tx);
    });

    logger.audit('Senha redefinida com sucesso via recuperação de senha', {
      userId: user.id,
      email: user.email,
      ip,
    });
  }
}

module.exports = AutenticacaoService;
