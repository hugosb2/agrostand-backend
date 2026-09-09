/**
 * @file factories.js
 * @description Montagem/reconstituição de entidades de domínio a partir das
 * linhas de persistência (Drizzle retorna snake_case legado) e dos dados de
 * entrada dos controllers.
 *
 * Por que este módulo existe:
 * - As entidades (`Usuario`, `Anuncio`, ...) usam camelCase e não conhecem o
 *   formato das tabelas; os DAOs retornam linhas snake_case.
 * - Os controllers usam estas fábricas para trabalhar com o agregado rico
 *   (validações e transições de estado no domínio) e persistem via DAOs.
 * - Nenhuma query vive aqui — persistência continua nos DAOs de `src/dao`.
 */

const Usuario = require('./Usuario');
const Cliente = require('./Cliente');
const Anunciante = require('./Anunciante');
const Anuncio = require('./Anuncio');
const Produto = require('./Produto');
const Categoria = require('./Categoria');
const Endereco = require('./Endereco');
const Imagem = require('./Imagem');
const Favorito = require('./Favorito');
const BloqueioLogin = require('./BloqueioLogin');

/** Linha `Usuario` (findByEmail/findByIdWithPassword) -> entidade com hash. */
function reconstituirUsuario(row) {
  if (!row) return row;
  return new Usuario({
    id: row.id,
    nome: row.nome,
    sobrenome: row.sobrenome,
    email: row.email,
    telefone: row.telefone,
    senhaHash: row.senha_hash !== undefined ? row.senha_hash : row.senhaHash,
    dataCadastro: row.data_cadastro !== undefined ? row.data_cadastro : row.dataCadastro,
  });
}

/** Linha pública (`req.user`, findById) -> anunciante para fluxos de autoria. */
function reconstituirAnunciante(publicRow) {
  if (!publicRow) return publicRow;
  return new Anunciante({
    id: publicRow.id,
    nome: publicRow.nome,
    sobrenome: publicRow.sobrenome,
    email: publicRow.email,
    telefone: publicRow.telefone,
    senhaHash: publicRow.senha_hash,
    dataCadastro: publicRow.data_cadastro,
  });
}

/** Linha `Endereco` (snake_case) -> entidade. */
function reconstituirEndereco(row) {
  if (!row) return row;
  return new Endereco({
    id: row.id,
    clienteId: row.cliente_id !== undefined ? row.cliente_id : row.clienteId,
    rua: row.rua,
    numero: row.numero,
    bairro: row.bairro,
    cep: row.cep,
    cidade: row.cidade,
    uf: row.uf,
    zona: row.zona,
  });
}

/** Linha `Categoria` -> entidade. */
function reconstituirCategoria(row) {
  if (!row) return row;
  return new Categoria({ id: row.id, nome: row.nome, descricao: row.descricao });
}

/**
 * Reconstitui o agregado `Anuncio` a partir do retorno rico de
 * `AnuncioDAO.findById` (aninhados + `imagens` em snake_case legado).
 * O `Produto` deriva dos campos do anúncio (não há tabela Produto —
 * nome/descricao/preco vivem na linha do anúncio).
 */
function reconstituirAgregadoAnuncio(adRow, anuncianteEntidade) {
  if (!adRow) return adRow;
  return new Anuncio({
    id: adRow.id,
    dataPublicacao: adRow.data_publicacao,
    status: adRow.status,
    produto: new Produto({
      id: adRow.id,
      nome: adRow.nome,
      descricao: adRow.descricao,
      preco: adRow.preco,
    }),
    imagens: (adRow.imagens || []).map(
      (img) => new Imagem({ id: img.id, url: img.url, tipo: img.tipo, ordem: img.ordem })
    ),
    anunciante: anuncianteEntidade || null,
    categoria: new Categoria({ id: adRow.categoria_id, nome: adRow.categoria_nome }),
    endereco: new Endereco({
      id: adRow.endereco_id,
      rua: adRow.rua,
      numero: adRow.numero,
      bairro: adRow.bairro,
      cep: adRow.cep,
      cidade: adRow.cidade,
      uf: adRow.uf,
      zona: adRow.zona,
    }),
  });
}

module.exports = {
  reconstituirUsuario,
  reconstituirAnunciante,
  reconstituirEndereco,
  reconstituirCategoria,
  reconstituirAgregadoAnuncio,
  // Re-exporta as entidades para os controllers montarem agregados novos.
  Usuario,
  Cliente,
  Anunciante,
  Anuncio,
  Produto,
  Categoria,
  Endereco,
  Imagem,
  Favorito,
  BloqueioLogin,
};
