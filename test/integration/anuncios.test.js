/**
 * @file anuncios.test.js
 * @description UC2 — Marketplace (integração): publicar com imagem, buscar,
 * editar, lixeira/restaurar e propriedade, via multipart real (Multer).
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

const SENHA = 'Forte@123';

async function registrar(base, email, telefone = '11999998888') {
  const { body } = await api(base, 'POST', '/api/auth/register', {
    body: {
      nome: 'Anunciante', sobrenome: 'Teste', email, telefone, senha: SENHA,
      rua: 'Estrada', numero: '1', bairro: 'Rural', cidade: 'C', uf: 'SP', zona: 'RURAL',
    },
  });
  return body.data;
}

function formAnuncio({ categoriaId, enderecoId, nome = 'Milho Verde', preco = '25.90', principal = true }) {
  const fd = new FormData();
  fd.append('nome', nome);
  fd.append('descricao', 'Colheita fresca');
  fd.append('preco', preco);
  fd.append('categoriaId', String(categoriaId));
  fd.append('enderecoId', String(enderecoId));
  if (principal) fd.append('imagemPrincipal', pngFile(), 'principal.png');
  return fd;
}

describe('UC2 — Anúncios', async () => {
  let base;
  let close;
  let token;
  let categoriaId;
  let enderecoId;
  let anuncioId;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('anuncios'));
    uploadsAntes = snapshotUploads();

    const { token: t } = await registrar(base, 'anunciante@test.com');
    token = t;
    const cats = await api(base, 'GET', '/api/categories');
    categoriaId = cats.body.data.categorias[0].id;
    const addrs = await api(base, 'GET', '/api/addresses', { token });
    enderecoId = addrs.body.data.enderecos[0].id;
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('exige imagem principal (400)', async () => {
    const fd = formAnuncio({ categoriaId, enderecoId, principal: false });
    const res = await fetch(base + '/api/ads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, {
      status: 'error',
      message: 'Todo anúncio deve conter obrigatoriamente uma imagem principal.',
    });
  });

  it('publica anúncio com principal + secundária (201, PRINCIPAL primeiro)', async () => {
    const fd = formAnuncio({ categoriaId, enderecoId });
    fd.append('imagensSecundarias', pngFile(), 'sec1.png');
    const res = await fetch(base + '/api/ads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    anuncioId = body.data.anuncio.id;
    assert.equal(body.data.anuncio.imagens.length, 2);
    assert.equal(body.data.anuncio.imagens[0].tipo, 'PRINCIPAL');
  });

  it('expõe detalhe com link WhatsApp e busca por termo/categoria', async () => {
    const detalhe = await api(base, 'GET', `/api/ads/${anuncioId}`);
    assert.equal(detalhe.status, 200);
    assert.match(detalhe.body.data.anuncio.vendedor.link_whatsapp, /^https:\/\/wa\.me\//);

    const busca = await api(base, 'GET', '/api/ads?search=Milho');
    assert.equal(busca.body.data.pagination.total, 1);

    const porCategoria = await api(base, 'GET', `/api/ads?categoriaId=${categoriaId}`);
    assert.equal(porCategoria.body.data.pagination.total, 1);

    const vazia = await api(base, 'GET', '/api/ads?search=trator-inexistente');
    assert.equal(vazia.body.data.pagination.total, 0);
  });

  it('edita preço/nome e exclui imagem secundária', async () => {
    const antes = await api(base, 'GET', `/api/ads/${anuncioId}`);
    const sec = antes.body.data.anuncio.imagens.find((i) => i.tipo === 'SECUNDARIA');

    const fd = new FormData();
    fd.append('nome', 'Milho Verde Premium');
    fd.append('descricao', 'Colheita fresca');
    fd.append('preco', '30');
    fd.append('categoriaId', String(categoriaId));
    fd.append('enderecoId', String(enderecoId));
    fd.append('deletarImagensIds', String(sec.id));
    const res = await fetch(base + `/api/ads/${anuncioId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.anuncio.nome, 'Milho Verde Premium');
    assert.equal(body.data.anuncio.imagens.length, 1);
  });

  it('impede dono alheio de editar/remover (403)', async () => {
    const { token: outro } = await registrar(base, 'outro@test.com', '11777776666');

    const fd = new FormData();
    fd.append('nome', 'Hack');
    fd.append('descricao', 'x');
    fd.append('preco', '1');
    fd.append('categoriaId', String(categoriaId));
    fd.append('enderecoId', String(enderecoId));
    const edit = await fetch(base + `/api/ads/${anuncioId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${outro}` },
      body: fd,
    });
    assert.equal(edit.status, 403);

    const del = await api(base, 'DELETE', `/api/ads/${anuncioId}`, { token: outro });
    assert.equal(del.status, 403);
  });

  it('lixeira esconde, restore reativa', async () => {
    const del = await api(base, 'DELETE', `/api/ads/${anuncioId}`, { token });
    assert.equal(del.status, 200);

    const some = await api(base, 'GET', `/api/ads/${anuncioId}`);
    assert.equal(some.status, 404);

    const lixeira = await api(base, 'GET', '/api/ads/me/products?status=EM_LIXEIRA', { token });
    assert.equal(lixeira.body.data.pagination.total, 1);

    const restore = await api(base, 'POST', `/api/ads/${anuncioId}/restore`, { token });
    assert.equal(restore.status, 200);

    const volta = await api(base, 'GET', `/api/ads/${anuncioId}`);
    assert.equal(volta.status, 200);
  });
});
