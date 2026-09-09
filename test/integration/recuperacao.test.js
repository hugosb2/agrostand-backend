/**
 * @file recuperacao.test.js
 * @description UC3 — Recuperação de senha (integração): solicitar código,
 * redefinir, invalidação, expiração e anti-enumeração. E-mail stubado.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, stubEmail } = require('../helpers');

const EMAIL = 'esquecido@test.com';
const SENHA = 'Forte@123';
const NOVA = 'Nova@1234';

describe('UC3 — Recuperação de senha', async () => {
  let base;
  let close;
  let email;
  let usuarioId;

  before(async () => {
    ({ base, close } = await startServer('recuperacao'));
    email = stubEmail();

    await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Esquecido', sobrenome: 'Teste', email: EMAIL, telefone: '11999998888', senha: SENHA,
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });

    // DAOs no mesmo processo enxergam o mesmo banco temporário
    const UsuarioDAO = require('../../src/dao/UsuarioDAO');
    usuarioId = (await UsuarioDAO.findByEmail(EMAIL)).id;
  });

  after(async () => {
    email.restore();
    await close();
  });

  it('solicita código e o e-mail sai com 6 dígitos', async () => {
    const { status, body } = await api(base, 'POST', '/api/auth/forgot-password', { body: { email: EMAIL } });
    assert.equal(status, 200);
    assert.match(body.message, /código de verificação/);
    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0].to, EMAIL);
    assert.match(email.sent[0].code, /^\d{6}$/);
  });

  it('não revela e-mail inexistente (mesma resposta, sem envio)', async () => {
    const antes = email.sent.length;
    const { status, body } = await api(base, 'POST', '/api/auth/forgot-password', {
      body: { email: 'fantasma@test.com' },
    });
    assert.equal(status, 200);
    assert.match(body.message, /código de verificação/);
    assert.equal(email.sent.length, antes);
  });

  it('rejeita código errado e aceita o correto (uso único)', async () => {
    const codigo = email.sent[email.sent.length - 1].code;

    const errado = await api(base, 'POST', '/api/auth/reset-password', {
      body: { email: EMAIL, codigo: '000000', novaSenha: NOVA },
    });
    assert.equal(errado.status, 400);

    const ok = await api(base, 'POST', '/api/auth/reset-password', {
      body: { email: EMAIL, codigo, novaSenha: NOVA },
    });
    assert.equal(ok.status, 200);

    const reuso = await api(base, 'POST', '/api/auth/reset-password', {
      body: { email: EMAIL, codigo, novaSenha: 'Outra@123' },
    });
    assert.equal(reuso.status, 400);

    const login = await api(base, 'POST', '/api/auth/login', {
      body: { email: EMAIL, senha: NOVA },
    });
    assert.equal(login.status, 200);
  });

  it('rejeita código expirado', async () => {
    const RecuperacaoSenhaDAO = require('../../src/dao/RecuperacaoSenhaDAO');
    const passado = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await RecuperacaoSenhaDAO.create({ usuarioId, codigo: '123456', expiraEm: passado });

    const { status, body } = await api(base, 'POST', '/api/auth/reset-password', {
      body: { email: EMAIL, codigo: '123456', novaSenha: 'Outra@123' },
    });
    assert.equal(status, 400);
    assert.match(body.message, /expirou/);
  });
});
