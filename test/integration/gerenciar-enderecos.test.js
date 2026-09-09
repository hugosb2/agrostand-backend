/**
 * @file gerenciar-enderecos.test.js
 * @description UC6 — Gerenciar Endereços (RF03; RN02/RN18): listar, adicionar
 * (urbana/rural), obrigatoriedade por zona, edição, remoção e garantia mínima
 * (nada incompleto é salvo).
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api } = require('../helpers');

const URBANO = { rua: 'Rua das Palmeiras', numero: '100', bairro: 'Centro', cidade: 'SP', uf: 'SP', zona: 'URBANA' };
const RURAL = { rua: 'Estrada do Sítio', numero: 'km 8', bairro: 'Rural', cidade: 'Itaí', uf: 'SP', zona: 'RURAL' };

describe('UC6 — Gerenciar Endereços', async () => {
  let base;
  let close;
  let token;

  before(async () => {
    ({ base, close } = await startServer('enderecos'));

    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Morador', sobrenome: 'Teste', email: 'morador@test.com', telefone: '11999998888', senha: 'Forte@123',
        ...URBANO,
      },
    });
    token = reg.body.data.token;
  });

  after(async () => {
    await close();
  });

  it('lista exibe os endereços já cadastrados (passo 2)', async () => {
    const { status, body } = await api(base, 'GET', '/api/addresses', { token });
    assert.equal(status, 200);
    assert.equal(body.data.enderecos.length, 1);
    assert.equal(body.data.enderecos[0].rua, URBANO.rua);
  });

  it('adiciona endereço urbano e rural (RN02: múltiplos por cliente)', async () => {
    const urbano = await api(base, 'POST', '/api/addresses', { token, body: { ...URBANO, numero: '200' } });
    assert.equal(urbano.status, 201);
    assert.equal(urbano.body.data.endereco.zona, 'URBANA');

    const rural = await api(base, 'POST', '/api/addresses', { token, body: RURAL });
    assert.equal(rural.status, 201);
    assert.equal(rural.body.data.endereco.zona, 'RURAL');

    const lista = await api(base, 'GET', '/api/addresses', { token });
    assert.equal(lista.body.data.enderecos.length, 3);
  });

  it('zona é normalizada (minúscula vira maiúscula)', async () => {
    const { body } = await api(base, 'POST', '/api/addresses', {
      token,
      body: { ...RURAL, numero: 'km 9', zona: 'rural' },
    });
    assert.equal(body.data.endereco.zona, 'RURAL');
  });

  it('alternativo 1 (RN18): campo da zona em branco é rejeitado sem salvar', async () => {
    const antes = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos.length;

    const casos = [
      ['sem rua', { ...URBANO, rua: '' }],
      ['sem número', { ...URBANO, numero: '' }],
      ['sem bairro', { ...URBANO, bairro: '' }],
      ['sem cidade', { ...URBANO, cidade: '' }],
      ['sem UF', { ...URBANO, uf: '' }],
      ['sem zona', { ...URBANO, zona: undefined }],
      ['zona inválida', { ...URBANO, zona: 'SUBURBANA' }],
    ];
    for (const [rotulo, payload] of casos) {
      const { status, body } = await api(base, 'POST', '/api/addresses', { token, body: payload });
      assert.equal(status, 400, rotulo);
      assert.equal(body.status, 'error');
    }
    assert.match(
      (await api(base, 'POST', '/api/addresses', { token, body: { ...URBANO, zona: 'X' } })).body.message,
      /URBANA ou RURAL/
    );

    // garantia mínima: nada incompleto foi salvo
    const depois = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos.length;
    assert.equal(depois, antes);
  });

  it('edita e remove endereço da conta', async () => {
    const id = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos[0].id;

    const upd = await api(base, 'PUT', `/api/addresses/${id}`, {
      token,
      body: { ...URBANO, numero: '101' },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.endereco.numero, '101');

    const del = await api(base, 'DELETE', `/api/addresses/${id}`, { token });
    assert.equal(del.status, 200);

    const lista = await api(base, 'GET', '/api/addresses', { token });
    assert.ok(!lista.body.data.enderecos.some((e) => e.id === id));
  });
});
