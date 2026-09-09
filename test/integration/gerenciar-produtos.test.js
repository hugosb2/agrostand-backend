/**
 * @file gerenciar-produtos.test.js
 * @description UC7 — Gerenciar Produtos (RF09; RN11/RN15): painel "Meus Produtos",
 * edição completa (passos 7–19 da spec), imagem inválida na edição, remoção
 * para a lixeira (imagens mantidas p/ auditoria), restore e purga +30 dias.
 * Garantia mínima: ninguém edita/remove anúncio alheio.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const fs = require('fs');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

const SENHA = 'Forte@123';

function arquivoDaUrl(url) {
  // Mesmo diretório isolado configurado pelo helper (process.env.UPLOAD_DIR)
  const dir = process.env.UPLOAD_DIR || path.resolve(__dirname, '..', '..', 'public', 'uploads');
  return path.join(dir, decodeURIComponent(new URL(url).pathname.split('/').pop()));
}

async function registrar(base, email, telefone = '11999998888') {
  const { body } = await api(base, 'POST', '/api/auth/register', {
    body: {
      nome: 'Anunciante', sobrenome: 'Gestor', email, telefone, senha: SENHA,
      rua: 'Estrada', numero: '1', bairro: 'Rural', cidade: 'C', uf: 'SP', zona: 'RURAL',
    },
  });
  return body.data.token;
}

async function publicar(base, token, categoriaId, enderecoId, nome = 'Soja em Grãos') {
  const fd = new FormData();
  fd.append('nome', nome);
  fd.append('descricao', 'Saca 60kg');
  fd.append('preco', '180');
  fd.append('categoriaId', String(categoriaId));
  fd.append('enderecoId', String(enderecoId));
  fd.append('imagemPrincipal', pngFile(), 'principal.png');
  fd.append('imagensSecundarias', pngFile(), 'sec.png');
  const res = await fetch(base + '/api/ads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  assert.equal(res.status, 201);
  return (await res.json()).data.anuncio;
}

describe('UC7 — Gerenciar Produtos', async () => {
  let base;
  let close;
  let tokenA;
  let tokenB;
  let categoriaA;
  let categoriaB;
  let endA1;
  let endA2;
  let ad1;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('gerenciar-produtos'));
    uploadsAntes = snapshotUploads();

    tokenA = await registrar(base, 'gestor-a@test.com');
    tokenB = await registrar(base, 'gestor-b@test.com', '11777776666');

    const cats = (await api(base, 'GET', '/api/categories')).body.data.categorias;
    categoriaA = cats[0].id;
    categoriaB = cats[1].id;

    endA1 = (await api(base, 'GET', '/api/addresses', { token: tokenA })).body.data.enderecos[0].id;
    endA2 = (await api(base, 'POST', '/api/addresses', {
      token: tokenA,
      body: { rua: 'Galpão', numero: 'S/N', bairro: 'Rural', cidade: 'C', uf: 'SP', zona: 'RURAL' },
    })).body.data.endereco.id;

    ad1 = await publicar(base, tokenA, categoriaA, endA1);
    const endB = (await api(base, 'GET', '/api/addresses', { token: tokenB })).body.data.enderecos[0].id;
    await publicar(base, tokenB, categoriaA, endB, 'Anúncio do B');
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('Meus Produtos lista só os do anunciante, por status', async () => {
    const meusA = await api(base, 'GET', '/api/ads/me/products', { token: tokenA });
    assert.equal(meusA.body.data.pagination.total, 1);
    assert.equal(meusA.body.data.data[0].id, ad1.id);

    const meusB = await api(base, 'GET', '/api/ads/me/products', { token: tokenB });
    assert.equal(meusB.body.data.pagination.total, 1);
    assert.notEqual(meusB.body.data.data[0].id, ad1.id);

    const lixeiraVazia = await api(base, 'GET', '/api/ads/me/products?status=EM_LIXEIRA', { token: tokenA });
    assert.equal(lixeiraVazia.body.data.pagination.total, 0);

    const invalido = await api(base, 'GET', '/api/ads/me/products?status=FOO', { token: tokenA });
    assert.equal(invalido.status, 400);
  });

  it('fluxo principal: edita tudo (passos 7–19) e troca arquivos em disco', async () => {
    const antes = (await api(base, 'GET', `/api/ads/${ad1.id}`)).body.data.anuncio;
    const principalAntiga = antes.imagens.find((i) => i.tipo === 'PRINCIPAL');
    const secundariaAntiga = antes.imagens.find((i) => i.tipo === 'SECUNDARIA');
    assert.ok(fs.existsSync(arquivoDaUrl(principalAntiga.url)));

    const fd = new FormData();
    fd.append('nome', 'Soja Premium'); // 7
    fd.append('descricao', 'Saca 60kg peneirada'); // 8
    fd.append('preco', '199.90'); // 9
    fd.append('categoriaId', String(categoriaB)); // 10
    fd.append('imagemPrincipal', pngFile(), 'nova-principal.png'); // 11–12
    fd.append('imagensSecundarias', pngFile(), 'nova-sec.png'); // 13–14
    fd.append('deletarImagensIds', String(secundariaAntiga.id)); // 15–16
    fd.append('enderecoId', String(endA2)); // 17–18
    const res = await fetch(base + `/api/ads/${ad1.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: fd,
    });
    assert.equal(res.status, 200);
    const ad = (await res.json()).data.anuncio;

    assert.equal(ad.nome, 'Soja Premium');
    assert.equal(ad.preco, 199.9);
    assert.equal(ad.categoria_id, categoriaB);
    assert.equal(ad.endereco_id, endA2);

    const principais = ad.imagens.filter((i) => i.tipo === 'PRINCIPAL');
    assert.equal(principais.length, 1);
    assert.notEqual(principais[0].url, principalAntiga.url);
    assert.ok(!ad.imagens.some((i) => i.id === secundariaAntiga.id));

    // arquivo físico da principal antiga foi removido pós-commit
    assert.equal(fs.existsSync(arquivoDaUrl(principalAntiga.url)), false);
  });

  it('alternativo 2 (imagem inválida na edição): mantém tudo como estava', async () => {
    const antes = (await api(base, 'GET', `/api/ads/${ad1.id}`)).body.data.anuncio;

    const fd = new FormData();
    fd.append('nome', 'Tentativa');
    fd.append('descricao', 'x');
    fd.append('preco', '10');
    fd.append('categoriaId', String(categoriaA));
    fd.append('enderecoId', String(endA2));
    fd.append('imagemPrincipal', new Blob(['texto'], { type: 'text/plain' }), 'ruim.txt');
    const res = await fetch(base + `/api/ads/${ad1.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: fd,
    });
    assert.equal(res.status, 500);

    const depois = (await api(base, 'GET', `/api/ads/${ad1.id}`)).body.data.anuncio;
    assert.equal(depois.nome, antes.nome);
    assert.deepEqual(
      depois.imagens.map((i) => i.id).sort(),
      antes.imagens.map((i) => i.id).sort()
    );
  });

  it('garantia mínima: dono alheio não edita, remove nem restaura', async () => {
    const fd = new FormData();
    fd.append('nome', 'Hack');
    fd.append('descricao', 'x');
    fd.append('preco', '1');
    fd.append('categoriaId', String(categoriaA));
    fd.append('enderecoId', String(endA2));
    const edit = await fetch(base + `/api/ads/${ad1.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: fd,
    });
    assert.equal(edit.status, 403);

    assert.equal((await api(base, 'DELETE', `/api/ads/${ad1.id}`, { token: tokenB })).status, 403);
    assert.equal((await api(base, 'POST', `/api/ads/${ad1.id}/restore`, { token: tokenB })).status, 403);
    assert.equal((await api(base, 'DELETE', '/api/ads/99999', { token: tokenA })).status, 404);
  });

  it('alternativo 3 (remover): lixeira esconde do público mas mantém imagens (RN15)', async () => {
    const del = await api(base, 'DELETE', `/api/ads/${ad1.id}`, { token: tokenA });
    assert.equal(del.status, 200);

    assert.equal((await api(base, 'GET', `/api/ads/${ad1.id}`)).status, 404);
    assert.equal((await api(base, 'GET', '/api/ads?search=Soja')).body.data.pagination.total, 0);

    // RN15: registros (anúncio + imagens) preservados para auditoria
    const AnuncioDAO = require('../../src/dao/AnuncioDAO');
    const naLixeira = await AnuncioDAO.findById(ad1.id, true);
    assert.equal(naLixeira.status, 'EM_LIXEIRA');
    assert.ok(naLixeira.imagens.length >= 1);

    const meus = await api(base, 'GET', '/api/ads/me/products?status=EM_LIXEIRA', { token: tokenA });
    assert.equal(meus.body.data.pagination.total, 1);
  });

  it('restore reativa; restore de ativo falha (400)', async () => {
    const ok = await api(base, 'POST', `/api/ads/${ad1.id}/restore`, { token: tokenA });
    assert.equal(ok.status, 200);
    assert.equal((await api(base, 'GET', `/api/ads/${ad1.id}`)).status, 200);

    const deNovo = await api(base, 'POST', `/api/ads/${ad1.id}/restore`, { token: tokenA });
    assert.equal(deNovo.status, 400);
  });

  it('purga: lixeira +30 dias é excluída com imagens; recente é mantida', async () => {
    // A -> lixeira e envelhece 31 dias; B -> lixeira recente
    await api(base, 'DELETE', `/api/ads/${ad1.id}`, { token: tokenA });
    const adB = (await api(base, 'GET', '/api/ads/me/products', { token: tokenB })).body.data.data[0].id;
    await api(base, 'DELETE', `/api/ads/${adB}`, { token: tokenB });

    const { getDb } = require('../../src/db');
    const schema = require('../../src/db/schema');
    const { eq } = require('drizzle-orm');
    const limite = new Date();
    limite.setDate(limite.getDate() - 31);
    getDb().update(schema.anuncios).set({ dataRemocao: limite.toISOString() }).where(eq(schema.anuncios.id, ad1.id)).run();

    const AnuncioDAO = require('../../src/dao/AnuncioDAO');
    const ImagemDAO = require('../../src/dao/ImagemDAO');
    const imgAntiga = (await AnuncioDAO.findById(ad1.id, true)).imagens[0].id;

    const purge = await api(base, 'POST', '/api/ads/cleanup');
    assert.equal(purge.status, 200);
    assert.equal(purge.body.data.anuncios_excluidos_definitivamente, 1);

    assert.equal(await AnuncioDAO.findById(ad1.id, true), null);
    assert.equal(await ImagemDAO.findById(imgAntiga), undefined);
    assert.equal((await AnuncioDAO.findById(adB, true)).status, 'EM_LIXEIRA');
  });
});
