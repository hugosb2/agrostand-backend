/**
 * @file Anunciante.js
 * @description Classe que representa a Entidade Anunciante no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), o `Anunciante` é uma extensão especializada de `Cliente` (e indiretamente de `Usuario`).
 * No contexto do marketplace Agrostand, assume-se que todo vendedor/anunciante também possui características de
 * cliente (como possuir endereços e poder navegar em outros anúncios), porém com capacidades extras de publicação
 * e gestão de seus próprios anúncios de produtos agropecuários.
 */

const Cliente = require('./Cliente');

class Anunciante extends Cliente {
  // Lista privada de anúncios criados por este anunciante.
  // Representa a posse e o ciclo de vida dos anúncios dentro da entidade anunciante.
  #anuncios = [];

  /**
   * Construtor da Entidade Anunciante.
   * Inicializa a classe base (Cliente/Usuario) e carrega a lista de anúncios existentes, se houver.
   * 
   * @param {Object} data - Dados para criação do anunciante, incluindo os campos herdados e a lista de anúncios.
   */
  constructor(data) {
    super(data);
    if (data.anuncios) {
      this.#anuncios = data.anuncios;
    }
  }

  // ==========================================
  // GETTERS & SETTERS
  // ==========================================

  get anuncios() { return this.#anuncios; }
  set anuncios(value) { this.#anuncios = value; }

  // ==========================================
  // MÉTODOS DE COMPORTAMENTO DO DOMÍNIO
  // Gerenciam o ciclo de vida dos anúncios através do anunciante que os possui.
  // ==========================================

  /**
   * Adiciona um novo anúncio à lista do anunciante.
   * Associa este anunciante como dono do anúncio e altera seu estado para ativo (publicado).
   * 
   * @param {Anuncio} anuncio - Instância da entidade Anuncio que será associada ao anunciante.
   */
  publicarAnuncio(anuncio) {
    anuncio.anunciante = this;
    anuncio.publicar();
    this.#anuncios.push(anuncio);
  }

  /**
   * Operação de Domínio: Permite alterar os dados de um anúncio de propriedade deste anunciante.
   * Busca o anúncio correspondente na coleção interna e executa suas edições.
   * 
   * @param {Anuncio} anuncioModificado - Instância do anúncio modificado.
   */
  editarAnuncio(anuncioModificado) {
    if (!anuncioModificado) throw new Error("Anúncio inválido para edição.");
    const index = this.#anuncios.findIndex(a => a.id === anuncioModificado.id);
    if (index === -1) {
      throw new Error("Este anúncio não pertence a este anunciante ou não foi encontrado.");
    }
    
    this.#anuncios[index] = anuncioModificado;
    anuncioModificado.editar();
  }

  /**
   * Remove um anúncio associado a partir de seu identificador único.
   * Filtra a lista interna removendo o item desejado.
   * 
   * @param {number|string} id - O identificador único do anúncio a ser removido.
   */
  removerAnuncio(id) {
    this.#anuncios = this.#anuncios.filter(a => a.id !== id);
  }

  /**
   * Retorna a lista de anúncios ativos para fins de gerenciamento e controle de estoque/produtos.
   * 
   * @returns {Array<Anuncio>} Coleção de anúncios de propriedade do anunciante.
   */
  gerenciarMeusProdutos() {
    return this.#anuncios;
  }

  /**
   * Método de conversão para JSON.
   * Mescla os campos JSON herdados da hierarquia Cliente/Usuario com a serialização
   * recursiva de sua coleção privada de anúncios.
   * 
   * @returns {Object} Representação simples/serializável do anunciante.
   */
  toJSON() {
    return {
      ...super.toJSON(),
      // Serializa recursivamente cada anúncio que possuir o método toJSON()
      anuncios: this.#anuncios.map(a => (typeof a.toJSON === 'function' ? a.toJSON() : a))
    };
  }
}

module.exports = Anunciante;
