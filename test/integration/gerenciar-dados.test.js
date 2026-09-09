/**
 * @file gerenciar-dados.test.js
 * @description UC8 — Gerenciar Dados Pessoais: leitura e atualização cadastral,
 * unicidade de e-mail (RN13) e formatos. Garantia mínima: nada inválido persiste.
 * (Username/RN21 e confirmação por senha não existem nesta implementação.)
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api } = require('../helpers');

describe('UC8 — Gerenciar Dados Pessoais', async () => {
  let base;
  let close;
  let token;

  before(async () => {
    ({ base, close } = await startServer('dados'));

    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Maria', sobrenome: 'Silva', email: 'maria@test.com', telefone: '11999998888', senha: 'Forte@123',
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
    token = reg.body.data.token;

    await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'João', sobrenome: 'Souza', email: 'joao@test.com', telefone: '11777776666', senha: 'Forte@123',
        rua: 'R', numero: '2', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
  });

  after(async () => {
    await close();
  });

  it('exibe os dados atuais (passo 2 da spec)', async () => {
    const { status, body } = await api(base, 'GET', '/api/users/profile', { token });
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body.data.usuario).sort(), [
      'data_cadastro', 'email', 'id', 'nome', 'sobrenome', 'telefone',
    ]);
    assert.ok(!('senha_hash' in body.data.usuario), 'hash nunca vaza no perfil');
  });

  it('atualiza dados válidos e reflete na leitura seguinte', async () => {
    const upd = await api(base, 'PUT', '/api/users/profile', {
      token,
      body: { nome: 'Maria Clara', sobrenome: 'Silva', email: 'maria@test.com', telefone: '11666665555' },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.usuario.nome, 'Maria Clara');

    const relido = await api(base, 'GET', '/api/users/profile', { token });
    assert.equal(relido.body.data.usuario.telefone, '11666665555');
  });

  it('alternativo 1 (RN13): e-mail de outro usuário é rejeitado', async () => {
    const { status, body } = await api(base, 'PUT', '/api/users/profile', {
      token,
      body: { nome: 'Maria', sobrenome: 'Silva', email: 'joao@test.com', telefone: '11666665555' },
    });
    assert.equal(status, 400);
    assert.deepEqual(body, { status: 'error', message: 'O e-mail informado já está em uso por outro usuário.' });

    // garantia mínima: manteve o e-mail antigo
    const perfil = await api(base, 'GET', '/api/users/profile', { token });
    assert.equal(perfil.body.data.usuario.email, 'maria@test.com');
  });

  it('formatos inválidos e campos faltando são rejeitados', async () => {
    const casos = [
      ['e-mail inválido', { nome: 'M', sobrenome: 'S', email: 'sem-arroba', telefone: '11666665555' }],
      ['telefone inválido', { nome: 'M', sobrenome: 'S', email: 'maria@test.com', telefone: '123' }],
      ['campos faltando', { nome: 'M', sobrenome: 'S', email: 'maria@test.com' }],
    ];
    for (const [rotulo, payload] of casos) {
      const { status, body } = await api(base, 'PUT', '/api/users/profile', { token, body: payload });
      assert.equal(status, 400, rotulo);
      assert.equal(body.status, 'error');
    }
  });
});
