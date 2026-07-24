/**
 * @file Imagem.js
 * @description Classe que representa a Entidade Imagem no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), `Imagem` atua como uma entidade de suporte que contém metadados de mídias
 * visuais associadas a um Anúncio. 
 * 
 * A propriedade `ordem` é crítica para determinar a ordem de exibição das fotos na galeria (por exemplo, 
 * definir qual será a imagem de capa principal/miniatura e quais serão exibidas na galeria secundária).
 */

class Imagem {
  // Atributos privados encapsulados com '#'
  #id;
  #url;
  #tipo;   // Ex: 'PRINCIPAL', 'SECUNDARIA', 'MINIATURA'
  #ordem;  // Representa a posição na ordenação de exibição da galeria

  /**
   * Construtor da Entidade Imagem.
   * 
   * @param {Object} params - Dados desestruturados para criação do objeto.
   * @param {number|string} params.id - O identificador único da imagem.
   * @param {string} params.url - O link ou caminho físico onde o arquivo de imagem está armazenado (ex: S3 ou uploads local).
   * @param {string} params.tipo - Tipo de imagem (usado para categorização de exibição).
   * @param {number} params.ordem - O índice de ordenação na galeria do anúncio.
   */
  constructor({ id, url, tipo, ordem }) {
    this.#id = id;
    this.#url = url;
    this.#tipo = tipo;
    this.#ordem = ordem;
  }

  // ==========================================
  // GETTERS (Leitura controlada)
  // ==========================================

  get id() { return this.#id; }
  get url() { return this.#url; }
  get tipo() { return this.#tipo; }
  get ordem() { return this.#ordem; }

  // ==========================================
  // SETTERS (Modificação controlada de valores)
  // ==========================================

  set url(value) { this.#url = value; }
  set tipo(value) { this.#tipo = value; }
  set ordem(value) { this.#ordem = value; }

  /**
   * Método de conversão para JSON.
   * 
   * @returns {Object} JSON contendo os metadados estruturados da imagem.
   */
  toJSON() {
    return {
      id: this.#id,
      url: this.#url,
      tipo: this.#tipo,
      ordem: this.#ordem
    };
  }
}

module.exports = Imagem;
