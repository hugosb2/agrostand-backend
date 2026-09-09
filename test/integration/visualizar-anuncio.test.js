/**
 * @file visualizar-anuncio.test.js
 * @description UC3 — Visualizar Anúncio: detalhe expõe produto, imagens
 * (principal + carrossel), preço, localização e vendedor; anúncio removido
 * ou inexistente responde "indisponível" (fluxo alternativo 1).
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

describe('UC3 — Visualizar Anúncio', async () => {
  let base;
  let close;
  let anuncioId;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('visualizar'));
    uploadsAntes = snapshotUploads();

    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Vendedor', sobrenome: 'Feira', email: 'feira@test.com', telefone: '11999998888', senha: 'Forte@123',
        rua: 'Praça', numero: 'S/N', bairro: 'Centro', cidade: 'Holambra', uf: 'SP', zona: 'URBANA',
      },
    });
    const token = reg.body.data.token;
    const categoriaId = (await api(base, 'GET', '/api/categories')).body.data.categorias[0].id;
    const enderecoId = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos[0].id;

    const fd = new FormData();
    fd.append('nome', 'Orquídea Branca');
    fd.append('descricao', 'Muda florida em vaso');
    fd.append('preco', '45.90');
    fd.append('categoriaId', String(categoriaId));
    fd.append('enderecoId', String(enderecoId));
    fd.append('imagemPrincipal', pngFile(), 'capa.png');
    fd.append('imagensSecundarias', pngFile(), 'gal1.png');
    fd.append('imagensSecundarias', pngFile(), 'gal2.png');
    const res = await fetch(base + '/api/ads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    assert.equal(res.status, 201);
    anuncioId = (await res.json()).data.anuncio.id;
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('fluxo principal: exibe produto, imagens, preço, localização e vendedor', async () => {
    const { status, body } = await api(base, 'GET', `/api/ads/${anuncioId}`);
    assert.equal(status, 200);
    const ad = body.data.anuncio;

    assert.equal(ad.nome, 'Orquídea Branca'); // passo 3
    assert.equal(ad.imagens[0].tipo, 'PRINCIPAL'); // passo 4
    assert.equal(ad.imagens.length, 3); // passo 5 (carrossel)
    assert.equal(ad.descricao, 'Muda florida em vaso'); // passo 6
    assert.equal(ad.preco, 45.9); // passo 7
    assert.equal(ad.localizacao.cidade, 'Holambra'); // passo 8
    assert.equal(ad.localizacao.uf, 'SP');
    assert.match(ad.vendedor.nome, /Vendedor/); // passo 9
    assert.ok(ad.vendedor.telefone); // passo 10
    assert.match(ad.vendedor.link_whatsapp, /^https:\/\/wa\.me\//); // passo 11
  });

  it('alternativo 1 (removido): "Anúncio indisponível" (404)', async () => {
    const { status, body } = await api(base, 'GET', '/api/ads/99999');
    assert.equal(status, 404);
    assert.deepEqual(body, { status: 'error', message: 'Anúncio indisponível ou não encontrado.' });
  });
});
