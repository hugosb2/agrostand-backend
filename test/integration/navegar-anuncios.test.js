/**
 * @file navegar-anuncios.test.js
 * @description UC9 — Navegar por Anúncios (RF04): vitrine inicial, paginação
 * (próxima/anterior/fim da lista), filtro por categoria e catálogo vazio.
 * Garantia: só ATIVOS navegáveis, cada item com imagem principal, nome e preço.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

async function publicar(base, token, categoriaId, enderecoId, nome, preco = '10') {
  const fd = new FormData();
  fd.append('nome', nome);
  fd.append('descricao', `Descrição de ${nome}`);
  fd.append('preco', preco);
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

describe('UC9 — Navegar por Anúncios', async () => {
  let base;
  let close;
  let frutasId;
  let legumesId;
  let verdurasId;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('navegar'));
    uploadsAntes = snapshotUploads();

    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Vitrine', sobrenome: 'Teste', email: 'vitrine@test.com', telefone: '11999998888', senha: 'Forte@123',
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
    const token = reg.body.data.token;
    const cats = (await api(base, 'GET', '/api/categories')).body.data.categorias;
    frutasId = cats.find((c) => c.nome === 'Frutas').id;
    legumesId = cats.find((c) => c.nome === 'Legumes').id;
    verdurasId = cats.find((c) => c.nome === 'Verduras').id;
    const endId = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos[0].id;

    await publicar(base, token, frutasId, endId, 'Maçã Gala', '5.50');
    await publicar(base, token, frutasId, endId, 'Banana Prata', '3.20');
    await publicar(base, token, frutasId, endId, 'Manga Tommy', '4.10');
    await publicar(base, token, legumesId, endId, 'Cenoura', '2.80');
    await publicar(base, token, legumesId, endId, 'Beterraba', '3.00');

    const lixeira = await publicar(base, token, frutasId, endId, 'Uva Passada');
    await api(base, 'DELETE', `/api/ads/${lixeira.id}`, { token });
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('vitrine inicial: só ATIVOS com imagem principal, nome e preço', async () => {
    const { body } = await api(base, 'GET', '/api/ads');
    assert.equal(body.data.pagination.total, 5);
    for (const item of body.data.data) {
      assert.ok(item.imagem_principal, `sem imagem principal: ${item.nome}`);
      assert.ok(item.nome);
      assert.equal(typeof item.preco, 'number');
    }
    assert.ok(!body.data.data.some((a) => a.nome === 'Uva Passada'));
  });

  it('paginação: páginas disjuntas cobrem o total; além do fim vem vazio', async () => {
    const p1 = (await api(base, 'GET', '/api/ads?limit=2&page=1')).body.data;
    const p2 = (await api(base, 'GET', '/api/ads?limit=2&page=2')).body.data;
    const p3 = (await api(base, 'GET', '/api/ads?limit=2&page=3')).body.data;

    assert.deepEqual(p1.pagination, { total: 5, page: 1, limit: 2, pages: 3 });
    assert.equal(p2.data.length, 2);
    assert.equal(p3.data.length, 1);

    const ids1 = new Set(p1.data.map((a) => a.id));
    assert.ok(p2.data.every((a) => !ids1.has(a.id)), 'páginas não podem repetir itens');
    assert.equal(new Set([...p1.data, ...p2.data, ...p3.data].map((a) => a.id)).size, 5);

    const alemDoFim = (await api(base, 'GET', '/api/ads?limit=2&page=99')).body.data;
    assert.deepEqual(alemDoFim.data, []);
    assert.equal(alemDoFim.pagination.total, 5);
  });

  it('filtro por categoria retorna só itens dela', async () => {
    const { body } = await api(base, 'GET', `/api/ads?categoriaId=${legumesId}`);
    assert.equal(body.data.pagination.total, 2);
    assert.ok(body.data.data.every((a) => a.categoria_nome === 'Legumes'));
  });

  it('alternativo 2 (categoria sem produtos): total 0 e lista vazia', async () => {
    const { body } = await api(base, 'GET', `/api/ads?categoriaId=${verdurasId}`);
    assert.equal(body.data.pagination.total, 0);
    assert.deepEqual(body.data.data, []);
  });
});
