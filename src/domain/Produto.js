/**
 * @file Produto.js
 * @description Classe que representa a Entidade Produto no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), `Produto` representa os dados intrínsecos e descritivos do item real
 * que está sendo oferecido à venda (ex: um lote de café, um trator usado, sementes de milho). 
 * 
 * Ele possui propriedades de identificação (`id`), rotulagem comercial (`nome`, `descricao`) e valor financeiro (`preco`).
 * Esta entidade é agregada a um `Anuncio` para ser de fato ofertada no marketplace.
 */

class Produto {
  // Atributos privados encapsulados com '#'
  #id;
  #nome;
  #descricao;
  #preco;

  /**
   * Construtor da Entidade Produto.
   * 
   * @param {Object} params - Dados desestruturados para criação do produto.
   * @param {number|string} params.id - O identificador único do produto.
   * @param {string} params.nome - Nome comercial ou técnico do produto.
   * @param {string} params.descricao - Detalhes do estado do produto, características, especificações.
   * @param {number} params.preco - Valor monetário atribuído ao produto.
   */
  constructor({ id, nome, descricao, preco }) {
    this.#id = id;
    this.#nome = nome;
    this.#descricao = descricao;
    this.#preco = preco;
  }

  // ==========================================
  // GETTERS (Leitura controlada de atributos)
  // ==========================================

  get id() { return this.#id; }
  get nome() { return this.#nome; }
  get descricao() { return this.#descricao; }
  get preco() { return this.#preco; }

  // ==========================================
  // SETTERS (Alteração controlada dos dados)
  // ==========================================

  set nome(value) { this.#nome = value; }
  set descricao(value) { this.#descricao = value; }
  set preco(value) { this.#preco = value; }
}

module.exports = Produto;
