/**
 * @file Categoria.js
 * @description Classe que representa a Entidade Categoria no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), a Entidade `Categoria` é responsável por definir a taxonomia ou classificação
 * dos produtos comercializados no marketplace (por exemplo: "Maquinários", "Grãos", "Insumos").
 * Ela possui uma identidade única (`id`) para que, mesmo se o nome ou a descrição da categoria forem modificados,
 * a associação com os produtos cadastrados permaneça intacta e rastreável.
 */

class Categoria {
  // Atributos privados
  #id;
  #nome;
  #descricao;

  /**
   * Construtor da Entidade Categoria.
   * 
   * @param {Object} params - Objeto com parâmetros.
   * @param {number|string} params.id - O identificador único da categoria.
   * @param {string} params.nome - O nome descritivo da categoria (ex: "Sementes").
   * @param {string} params.descricao - Detalhes sobre que tipo de itens pertencem a esta categoria.
   */
  constructor({ id, nome, descricao }) {
    this.#id = id;
    this.#nome = nome;
    this.#descricao = descricao;
  }

  // ==========================================
  // GETTERS (Leitura dos dados privados)
  // ==========================================

  get id() { return this.#id; }
  get nome() { return this.#nome; }
  get descricao() { return this.#descricao; }

  // ==========================================
  // SETTERS (Alteração de campos editáveis)
  // ==========================================

  set nome(value) { this.#nome = value; }
  set descricao(value) { this.#descricao = value; }

  /**
   * Método de conversão para JSON.
   * Facilita a representação plana da categoria na comunicação externa (APIs).
   * 
   * @returns {Object} Representação simples/serializável da categoria.
   */
  toJSON() {
    return {
      id: this.#id,
      nome: this.#nome,
      descricao: this.#descricao
    };
  }
}

module.exports = Categoria;
