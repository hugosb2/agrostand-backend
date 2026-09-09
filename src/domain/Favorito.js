/**
 * @file Favorito.js
 * @description Classe que representa a Entidade Favorito no modelo de domínio.
 *
 * Liga um `Cliente` a um `Anuncio` marcado como favorito (UC10). A unicidade
 * do par (RN17) é garantida no banco (UNIQUE); aqui vive a invariante de
 * associação válida (cliente + anúncio presentes).
 */

class Favorito {
  #id;
  #clienteId;
  #anuncioId;
  #dataFavorito;

  /**
   * @param {Object} params
   * @param {number|string} params.id - Identificador único do favorito.
   * @param {number|string} params.clienteId - Dono do favorito.
   * @param {number|string} params.anuncioId - Anúncio favoritado.
   * @param {string} params.dataFavorito - Data/hora do registro.
   */
  constructor({ id, clienteId, anuncioId, dataFavorito }) {
    this.#id = id;
    this.#clienteId = clienteId;
    this.#anuncioId = anuncioId;
    this.#dataFavorito = dataFavorito;
  }

  get id() { return this.#id; }
  get clienteId() { return this.#clienteId; }
  get anuncioId() { return this.#anuncioId; }
  get dataFavorito() { return this.#dataFavorito; }

  /**
   * Invariante: favorito sempre vincula um cliente a um anúncio.
   * @returns {boolean}
   */
  validar() {
    return !!(this.#clienteId && this.#anuncioId);
  }
}

module.exports = Favorito;
