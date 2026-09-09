/**
 * @file dominio.test.js
 * @description Unitários das entidades de domínio (sem banco, sem HTTP).
 */
process.env.DATABASE_PATH = ':memory:';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  Usuario,
  Anunciante,
  Anuncio,
  Produto,
  Categoria,
  Endereco,
  Imagem,
} = require('../../src/domain/factories');

function anuncianteBase() {
  return new Anunciante({
    id: 1,
    nome: 'Ana',
    sobrenome: 'Silva',
    email: 'ana@test.com',
    telefone: '11999998888',
  });
}

function agregadoValido(anunciante) {
  return {
    produto: new Produto({ nome: 'Café', descricao: 'Especial', preco: 50 }),
    imagens: [new Imagem({ url: 'http://x/p.png', tipo: 'PRINCIPAL', ordem: 1 })],
    anunciante,
    categoria: new Categoria({ id: 1, nome: 'Grãos' }),
    endereco: new Endereco({ rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'RURAL' }),
    status: 'ATIVO',
  };
}

describe('Usuario (domínio)', () => {
  it('autenticar() aceita credenciais corretas e rejeita erradas', () => {
    const hash = bcrypt.hashSync('Forte@123', 4);
    const u = new Usuario({ id: 1, nome: 'A', sobrenome: 'B', email: 'a@b.com', telefone: '11', senhaHash: hash });
    assert.equal(u.autenticar('a@b.com', 'Forte@123'), true);
    assert.equal(u.autenticar('a@b.com', 'Errada@123'), false);
    assert.equal(u.autenticar('outro@b.com', 'Forte@123'), false);
  });

  it('atualizarDados() mescla só os campos informados', () => {
    const u = new Usuario({ id: 1, nome: 'A', sobrenome: 'B', email: 'a@b.com', telefone: '11' });
    u.atualizarDados({ nome: 'Novo', telefone: '22' });
    assert.equal(u.nome, 'Novo');
    assert.equal(u.telefone, '22');
    assert.equal(u.sobrenome, 'B');
    assert.equal(u.email, 'a@b.com');
  });
});

describe('Endereco (domínio)', () => {
  it('validar() exige rua, numero, bairro, cidade, uf e zona', () => {
    const ok = new Endereco({ rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA' });
    assert.equal(ok.validar(), true);
    const semZona = new Endereco({ rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP' });
    assert.equal(semZona.validar(), false);
    const vazio = new Endereco({});
    assert.equal(vazio.validar(), false);
  });
});

describe('Anuncio (agregado)', () => {
  it('publicar() ativa anúncio consistente', () => {
    const anunciante = anuncianteBase();
    const anuncio = new Anuncio(agregadoValido(anunciante));
    anunciante.publicarAnuncio(anuncio);
    assert.equal(anuncio.status, 'ATIVO');
    assert.equal(anuncio.anunciante, anunciante);
    assert.equal(anunciante.anuncios.length, 1);
  });

  it('publicar() barra anúncio sem imagem', () => {
    const anunciante = anuncianteBase();
    const params = agregadoValido(anunciante);
    params.imagens = [];
    const anuncio = new Anuncio(params);
    assert.throws(() => anunciante.publicarAnuncio(anuncio), /inconsistente/);
  });

  it('editar() aplica mudanças e revalida invariantes', () => {
    const anuncio = new Anuncio(agregadoValido(anuncianteBase()));
    anuncio.editar({ produto: new Produto({ nome: 'Milho', descricao: 'Verde', preco: 30 }) });
    assert.equal(anuncio.produto.nome, 'Milho');
    assert.throws(() => anuncio.editar({ imagens: [] }), /consistente/);
  });

  it('moverParaLixeira()/restaurar() alternam ATIVO <-> EM_LIXEIRA', () => {
    const anuncio = new Anuncio(agregadoValido(anuncianteBase()));
    anuncio.moverParaLixeira();
    assert.equal(anuncio.status, 'EM_LIXEIRA');
    anuncio.restaurar();
    assert.equal(anuncio.status, 'ATIVO');
  });
});
