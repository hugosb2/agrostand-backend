/**
 * @file seguranca.test.js
 * @description UC12 alt. 2 (RN19: bloqueio após 3 falhas) + UC13 logout
 * (denylist de JWT). E-mail inexistente conta sem revelar nada (401 genérico).
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { startServer, api } = require('../helpers');

const EMAIL = 'alvo@test.com';
const SENHA = 'Forte@123';
const ERRADA = 'Errada@123';
const BLOQUEIO_MSG = 'Muitas tentativas. Tente novamente em alguns minutos.';
const CRED_MSG = 'Credenciais inválidas. E-mail ou senha incorretos.';

describe('RN19 + UC13 — Segurança de sessão', async () => {
  let base;
  let close;

  before(async () => {
    ({ base, close } = await startServer('seguranca'));

    await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Alvo', sobrenome: 'Teste', email: EMAIL, telefone: '11999998888', senha: SENHA,
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
  });

  after(async () => {
    await close();
  });

  it('sucesso zera a contagem: 2 falhas + acerto nunca bloqueia', async () => {
    for (let i = 0; i < 2; i++) {
      assert.equal((await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: ERRADA } })).status, 401);
    }
    assert.equal((await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: SENHA } })).status, 200);
    for (let i = 0; i < 2; i++) {
      assert.equal((await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: ERRADA } })).status, 401);
    }
    assert.equal((await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: SENHA } })).status, 200);
  });

  it('3 falhas bloqueiam; até a senha certa recebe 429', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: ERRADA } });
      assert.equal(r.status, 401);
      assert.deepEqual(r.body, { status: 'error', message: CRED_MSG });
    }
    const bloqueado = await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: SENHA } });
    assert.equal(bloqueado.status, 429);
    assert.deepEqual(bloqueado.body, { status: 'error', message: BLOQUEIO_MSG });
  });

  it('fim da janela desbloqueia (backdate determinístico, sem espera)', async () => {
    const BloqueioLoginDAO = require('../../src/dao/BloqueioLoginDAO');
    const passado = new Date(Date.now() - 1000).toISOString();
    await BloqueioLoginDAO.salvar({ email: EMAIL, tentativas: 3, bloqueadoAte: passado });

    const ok = await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: SENHA } });
    assert.equal(ok.status, 200);
  });

  it('e-mail inexistente conta sem revelar (401 iguais, depois 429)', async () => {
    const corpos = [];
    for (let i = 0; i < 3; i++) {
      const r = await api(base, 'POST', '/api/auth/login', { body: { email: 'ninguem@test.com', senha: ERRADA } });
      assert.equal(r.status, 401);
      corpos.push(r.body);
    }
    assert.ok(corpos.every((b) => JSON.stringify(b) === JSON.stringify(corpos[0])));
    const quarto = await api(base, 'POST', '/api/auth/login', { body: { email: 'ninguem@test.com', senha: ERRADA } });
    assert.equal(quarto.status, 429);
    assert.deepEqual(quarto.body, { status: 'error', message: BLOQUEIO_MSG });
  });

  it('UC13: logout revoga só o token usado', async () => {
    const t1 = (await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: SENHA } })).body.data.token;
    const t2 = (await api(base, 'POST', '/api/auth/login', { body: { email: EMAIL, senha: SENHA } })).body.data.token;

    assert.equal((await api(base, 'GET', '/api/users/profile', { token: t1 })).status, 200);
    const out = await api(base, 'POST', '/api/auth/logout', { token: t1 });
    assert.equal(out.status, 200);
    assert.equal(out.body.message, 'Sessão encerrada com sucesso.');

    const revogado = await api(base, 'GET', '/api/users/profile', { token: t1 });
    assert.equal(revogado.status, 401);
    assert.deepEqual(revogado.body, { status: 'error', message: 'Sessão encerrada. Faça login novamente.' });

    // outro token da mesma conta segue válido
    assert.equal((await api(base, 'GET', '/api/users/profile', { token: t2 })).status, 200);
  });

  it('UC13: logout sem token ou com token inválido/expirado dá 401', async () => {
    assert.equal((await api(base, 'POST', '/api/auth/logout')).status, 401);

    const expirado = jwt.sign({ id: 1, email: EMAIL, exp: Math.floor(Date.now() / 1000) - 10 }, 'test-secret');
    const r = await api(base, 'POST', '/api/auth/logout', { token: expirado });
    assert.equal(r.status, 401);
  });
});
