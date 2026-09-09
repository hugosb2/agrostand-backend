/**
 * @file anunciar-produto.test.js
 * @description UC2 — Anunciar Produto (RF08; RN04/RN05/RN06): fluxo principal
 * com endereço existente, alternativo com novo endereço, matriz de validação
 * e imagens inválidas. Garantia mínima: nada parcial é persistido.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

const SENHA = 'Forte@123';

function baseForm({ categoriaId, enderecoId, nome = 'Saca de Café', preco = '120.50' }) {
  const fd = new FormData();
  fd.append('nome', nome);
  fd.append('descricao', 'Café especial da safra');
  fd.append('preco', preco);
  fd.append('categoriaId', String(categoriaId));
  if (enderecoId) fd.append('enderecoId', String(enderecoId));
  return fd;
}

async function postAd(base, token, fd) {
  const res = await fetch(base + '/api/ads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  return { status: res.status, body: await res.json() };
}

describe('UC2 — Anunciar Produto', async () => {
  let base;
  let close;
  let token;
  let categoriaId;
  let enderecoId;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('anunciar-produto'));
    uploadsAntes = snapshotUploads();

    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Cafeicultor', sobrenome: 'Teste', email: 'cafe@test.com', telefone: '11999998888', senha: SENHA,
        rua: 'Estrada', numero: '1', bairro: 'Rural', cidade: 'C', uf: 'SP', zona: 'RURAL',
      },
    });
    token = reg.body.data.token;
    categoriaId = (await api(base, 'GET', '/api/categories')).body.data.categorias[0].id;
    enderecoId = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos[0].id;
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('fluxo principal: publica ATIVO com produto + categoria + endereço + imagens', async () => {
    const fd = baseForm({ categoriaId, enderecoId });
    fd.append('imagemPrincipal', pngFile(), 'principal.png');
    fd.append('imagensSecundarias', pngFile(), 'sec1.png');
    fd.append('imagensSecundarias', pngFile(), 'sec2.png');

    const { status, body } = await postAd(base, token, fd);
    assert.equal(status, 201);
    const ad = body.data.anuncio;
    assert.equal(ad.status, 'ATIVO');
    assert.equal(ad.nome, 'Saca de Café');
    assert.equal(ad.preco, 120.5);
    assert.equal(ad.categoria_id, categoriaId);
    assert.equal(ad.endereco_id, enderecoId);
    assert.equal(ad.imagens.length, 3);
    assert.equal(ad.imagens[0].tipo, 'PRINCIPAL');

    // pós-condição: visível na lista pública
    const lista = await api(base, 'GET', '/api/ads?search=Café');
    assert.equal(lista.body.data.pagination.total, 1);
    assert.ok(lista.body.data.data[0].imagem_principal);
  });

  it('alternativo 1 (novo endereço): cria endereço e vincula ao anúncio', async () => {
    const fd = baseForm({ categoriaId, nome: 'Feijão Carioca', preco: '9.90' });
    fd.append('rua', 'Estrada Nova');
    fd.append('numero', 'km 5');
    fd.append('bairro', 'Rural');
    fd.append('cidade', 'C');
    fd.append('uf', 'SP');
    fd.append('zona', 'rural'); // minúsculo: normaliza para RURAL
    fd.append('imagemPrincipal', pngFile(), 'principal.png');

    const antes = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos.length;
    const { status, body } = await postAd(base, token, fd);
    assert.equal(status, 201);
    assert.notEqual(body.data.anuncio.endereco_id, enderecoId);

    const depois = await api(base, 'GET', '/api/addresses', { token });
    assert.equal(depois.body.data.enderecos.length, antes + 1);
    const novo = depois.body.data.enderecos.find((e) => e.id === body.data.anuncio.endereco_id);
    assert.equal(novo.zona, 'RURAL');
    assert.equal(novo.rua, 'Estrada Nova');
  });

  it('alternativo 1.10 (endereço incompleto): 400 sem persistir nada', async () => {
    const adsAntes = (await api(base, 'GET', '/api/ads')).body.data.pagination.total;
    const endAntes = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos.length;

    const fd = baseForm({ categoriaId, nome: 'Incompleto', preco: '10' });
    fd.append('rua', 'Rua X'); // sem numero/bairro/cidade/uf/zona
    fd.append('imagemPrincipal', pngFile(), 'principal.png');

    const { status } = await postAd(base, token, fd);
    assert.equal(status, 400);

    assert.equal((await api(base, 'GET', '/api/ads')).body.data.pagination.total, adsAntes);
    assert.equal((await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos.length, endAntes);
  });

  it('alternativo 2 (validação): campo vazio, preço inválido e categoria inexistente', async () => {
    const adsAntes = (await api(base, 'GET', '/api/ads')).body.data.pagination.total;

    const casos = [
      ['nome vazio', baseForm({ categoriaId, enderecoId, nome: '' })],
      ['preço zero', baseForm({ categoriaId, enderecoId, preco: '0' })],
      ['preço negativo', baseForm({ categoriaId, enderecoId, preco: '-5' })],
      ['preço não numérico', baseForm({ categoriaId, enderecoId, preco: 'grátis' })],
      ['categoria inexistente', baseForm({ categoriaId: 99999, enderecoId })],
    ];
    for (const [rotulo, fd] of casos) {
      fd.append('imagemPrincipal', pngFile(), 'principal.png');
      const { status, body } = await postAd(base, token, fd);
      assert.equal(status, 400, rotulo);
      assert.equal(body.status, 'error');
    }

    // garantia mínima: nenhum anúncio parcial persistido
    assert.equal((await api(base, 'GET', '/api/ads')).body.data.pagination.total, adsAntes);
  });

  it('alternativo 3 (imagem inválida): formato e tamanho rejeitados', async () => {
    // formato: o Multer barra na fileFilter; documenta o comportamento atual (500 + mensagem específica)
    const fdFormato = baseForm({ categoriaId, enderecoId, nome: 'Formato Ruim' });
    fdFormato.append('imagemPrincipal', new Blob(['não é imagem'], { type: 'text/plain' }), 'nota.txt');
    const r1 = await postAd(base, token, fdFormato);
    assert.equal(r1.status, 500);
    assert.match(r1.body.message, /Formato de imagem inválido/);

    // tamanho: acima de 10MB (RNF03)
    const fdTamanho = baseForm({ categoriaId, enderecoId, nome: 'Grande Demais' });
    fdTamanho.append('imagemPrincipal', new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'image/png' }), 'grande.png');
    const r2 = await postAd(base, token, fdTamanho);
    assert.equal(r2.status, 500);
    assert.match(r2.body.message, /File too large/i);
  });

  it('garantia de sucesso: detalhe expõe produto, vendedor e imagens', async () => {
    const lista = await api(base, 'GET', '/api/ads?search=Café');
    const id = lista.body.data.data[0].id;
    const { body } = await api(base, 'GET', `/api/ads/${id}`);
    const ad = body.data.anuncio;
    assert.equal(ad.nome, 'Saca de Café');
    assert.equal(ad.categoria.id, categoriaId);
    assert.ok(ad.localizacao.cidade);
    assert.ok(ad.imagens.length >= 1);
    assert.ok(ad.vendedor.nome);
    assert.match(ad.vendedor.link_whatsapp, /^https:\/\/wa\.me\//);
  });
});
