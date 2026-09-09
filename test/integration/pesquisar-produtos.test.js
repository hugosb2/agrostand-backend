/**
 * @file pesquisar-produtos.test.js
 * @description UC5 — Pesquisar Produtos (RF05): busca por nome ou categoria
 * retorna só ATIVOS; lixeira nunca aparece; zero resultados.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

async function publicar(base, token, categoriaId, enderecoId, nome) {
  const fd = new FormData();
  fd.append('nome', nome);
  fd.append('descricao', `Descrição de ${nome}`);
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

describe('UC5 — Pesquisar Produtos', async () => {
  let base;
  let close;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('pesquisar'));
    uploadsAntes = snapshotUploads();

    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Busca', sobrenome: 'Teste', email: 'busca@test.com', telefone: '11999998888', senha: 'Forte@123',
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
    const token = reg.body.data.token;
    const cats = (await api(base, 'GET', '/api/categories')).body.data.categorias;
    const graos = cats.find((c) => c.nome === 'Grãos').id;
    const frutas = cats.find((c) => c.nome === 'Frutas').id;
    const endId = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos[0].id;

    await publicar(base, token, graos, endId, 'Milho Verde');
    await publicar(base, token, frutas, endId, 'Suco de Laranja');
    await publicar(base, token, frutas, endId, 'Café da Serra');

    // vai para a lixeira: nunca pode aparecer em busca
    const velho = await publicar(base, token, graos, endId, 'Milho Antigo');
    await api(base, 'DELETE', `/api/ads/${velho.id}`, { token });
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('busca por nome do produto (case-insensitive)', async () => {
    const { body } = await api(base, 'GET', '/api/ads?search=Milho');
    assert.equal(body.data.pagination.total, 1);
    assert.equal(body.data.data[0].nome, 'Milho Verde');

    const minuscula = await api(base, 'GET', '/api/ads?search=milho');
    assert.equal(minuscula.body.data.pagination.total, 1);
  });

  it('busca por nome da categoria', async () => {
    const { body } = await api(base, 'GET', '/api/ads?search=Grãos');
    assert.ok(body.data.pagination.total >= 1);
    assert.ok(body.data.data.every((a) => a.categoria_nome === 'Grãos'));
  });

  it('garantia mínima: lixeira nunca aparece nos resultados', async () => {
    const { body } = await api(base, 'GET', '/api/ads?search=Antigo');
    assert.equal(body.data.pagination.total, 0);
    assert.deepEqual(body.data.data, []);
  });

  it('alternativo 1 (zero resultados): total 0 e lista vazia', async () => {
    const { body } = await api(base, 'GET', '/api/ads?search=trator-espacial-xyz');
    assert.equal(body.data.pagination.total, 0);
    assert.deepEqual(body.data.data, []);
    assert.equal(body.data.pagination.pages, 0);
  });
});
