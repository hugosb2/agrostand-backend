/**
 * @file favoritos.test.js
 * @description UC10/UC11 — Favoritar/Desfavoritar e Meus Favoritos (RN17):
 * toggle, unicidade, 401 sem login, indisponível p/ lixeira, lista só
 * própria (recentes primeiro, indisponíveis sinalizados), remoção e RN20.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

async function publicar(base, token, categoriaId, enderecoId, nome) {
  const fd = new FormData();
  fd.append('nome', nome);
  fd.append('descricao', 'x');
  fd.append('preco', '10');
  fd.append('categoriaId', String(categoriaId));
  fd.append('enderecoId', String(enderecoId));
  fd.append('imagemPrincipal', pngFile(), 'p.png');
  const res = await fetch(base + '/api/ads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  assert.equal(res.status, 201);
  return (await res.json()).data.anuncio;
}

describe('UC10/UC11 — Favoritos', async () => {
  let base;
  let close;
  let tokenA;
  let tokenB;
  let ad1;
  let ad2;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('favoritos'));
    uploadsAntes = snapshotUploads();

    const regA = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Fã', sobrenome: 'A', email: 'fa@test.com', telefone: '11999998888', senha: 'Forte@123',
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
    tokenA = regA.body.data.token;
    tokenB = (await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Fã', sobrenome: 'B', email: 'fb@test.com', telefone: '11777776666', senha: 'Forte@123',
        rua: 'R', numero: '2', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    })).body.data.token;

    const categoriaId = (await api(base, 'GET', '/api/categories')).body.data.categorias[0].id;
    const endA = (await api(base, 'GET', '/api/addresses', { token: tokenA })).body.data.enderecos[0].id;
    ad1 = await publicar(base, tokenA, categoriaId, endA, 'Cesta Orgânica');
    ad2 = await publicar(base, tokenA, categoriaId, endA, 'Mel Puro');
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('toggle liga e desliga o coração (UC10 principal + alternativo 1)', async () => {
    const on = await api(base, 'POST', '/api/favorites/toggle', { token: tokenA, body: { anuncioId: ad1.id } });
    assert.equal(on.status, 200);
    assert.equal(on.body.data.favoritado, true);
    assert.ok(on.body.data.id);

    const off = await api(base, 'POST', '/api/favorites/toggle', { token: tokenA, body: { anuncioId: ad1.id } });
    assert.equal(off.status, 200);
    assert.equal(off.body.data.favoritado, false);

    const vazia = await api(base, 'GET', '/api/favorites', { token: tokenA });
    assert.deepEqual(vazia.body.data.favoritos, []);
  });

  it('RN17: sem duplicar — liga/desliga/liga acumula 1 registro', async () => {
    await api(base, 'POST', '/api/favorites/toggle', { token: tokenA, body: { anuncioId: ad1.id } });
    await api(base, 'POST', '/api/favorites/toggle', { token: tokenA, body: { anuncioId: ad1.id } });
    await api(base, 'POST', '/api/favorites/toggle', { token: tokenA, body: { anuncioId: ad1.id } });
    const lista = await api(base, 'GET', '/api/favorites', { token: tokenA });
    assert.equal(lista.body.data.favoritos.filter((f) => f.anuncio_id === ad1.id).length, 1);

    // UNIQUE no banco como garantia final
    const FavoritoDAO = require('../../src/dao/FavoritoDAO');
    const UsuarioDAO = require('../../src/dao/UsuarioDAO');
    const uid = (await UsuarioDAO.findByEmail('fa@test.com')).id;
    assert.throws(() => FavoritoDAO.create({ clienteId: uid, anuncioId: ad1.id }), /UNIQUE constraint failed/);
  });

  it('alternativo 2 (sem login): 401', async () => {
    const { status } = await api(base, 'POST', '/api/favorites/toggle', { body: { anuncioId: ad1.id } });
    assert.equal(status, 401);
    assert.equal((await api(base, 'GET', '/api/favorites')).status, 401);
  });

  it('alternativo 3 (indisponível): lixeira não favorita e aparece sinalizada', async () => {
    await api(base, 'DELETE', `/api/ads/${ad2.id}`, { token: tokenA });

    const tentativa = await api(base, 'POST', '/api/favorites/toggle', { token: tokenA, body: { anuncioId: ad2.id } });
    assert.equal(tentativa.status, 404);
    assert.deepEqual(tentativa.body, { status: 'error', message: 'Anúncio indisponível.' });

    // favorita antes de ir p/ lixeira: UC11 alt. 2 marca indisponível
    const favAd1 = (await api(base, 'GET', '/api/favorites', { token: tokenA })).body.data.favoritos;
    assert.ok(favAd1.length >= 1);
    await api(base, 'DELETE', `/api/ads/${ad1.id}`, { token: tokenA });
    const lista = (await api(base, 'GET', '/api/favorites', { token: tokenA })).body.data.favoritos;
    const item = lista.find((f) => f.anuncio_id === ad1.id);
    assert.equal(item.disponivel, false);
    assert.equal(item.anuncio.status, 'EM_LIXEIRA');
  });

  it('UC11: só os próprios, recentes primeiro, com dados do anúncio', async () => {
    await api(base, 'POST', `/api/ads/${ad1.id}/restore`, { token: tokenA });
    await api(base, 'POST', '/api/favorites/toggle', { token: tokenB, body: { anuncioId: ad1.id } });

    const meusA = (await api(base, 'GET', '/api/favorites', { token: tokenA })).body.data.favoritos;
    const meusB = (await api(base, 'GET', '/api/favorites', { token: tokenB })).body.data.favoritos;
    assert.ok(meusA.length >= 1 && meusB.length === 1);
    assert.notEqual(meusA[0].id, meusB[0].id);

    const item = meusB[0];
    assert.equal(item.anuncio.nome, 'Cesta Orgânica');
    assert.equal(typeof item.anuncio.preco, 'number');
    assert.ok(item.anuncio.imagem_principal);
    assert.equal(item.disponivel, true);
  });

  it('UC11 alt. 3: remove pela lista com propriedade', async () => {
    const meusB = (await api(base, 'GET', '/api/favorites', { token: tokenB })).body.data.favoritos;
    const alheio = (await api(base, 'GET', '/api/favorites', { token: tokenA })).body.data.favoritos[0].id;

    assert.equal((await api(base, 'DELETE', `/api/favorites/${alheio}`, { token: tokenB })).status, 403);
    assert.equal((await api(base, 'DELETE', '/api/favorites/99999', { token: tokenB })).status, 404);

    const del = await api(base, 'DELETE', `/api/favorites/${meusB[0].id}`, { token: tokenB });
    assert.equal(del.status, 200);
    assert.deepEqual((await api(base, 'GET', '/api/favorites', { token: tokenB })).body.data.favoritos, []);
  });

  it('RN20: excluir conta remove os favoritos', async () => {
    const FavoritoDAO = require('../../src/dao/FavoritoDAO');
    const UsuarioDAO = require('../../src/dao/UsuarioDAO');
    const uid = (await UsuarioDAO.findByEmail('fb@test.com')).id;

    await api(base, 'POST', '/api/favorites/toggle', { token: tokenB, body: { anuncioId: ad1.id } });
    assert.equal((await FavoritoDAO.listByCliente(uid)).length, 1);

    assert.equal((await api(base, 'DELETE', '/api/users/account', { token: tokenB })).status, 200);
    assert.deepEqual(await FavoritoDAO.listByCliente(uid), []);
  });
});
